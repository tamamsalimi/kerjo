package httpapi

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"

	conversationapp "kerjo/backend/internal/conversation/application"
	conversationdomain "kerjo/backend/internal/conversation/domain"
	identityapp "kerjo/backend/internal/identity/application"
	identitydomain "kerjo/backend/internal/identity/domain"
	marketplaceapp "kerjo/backend/internal/marketplace/application"
	marketplacedomain "kerjo/backend/internal/marketplace/domain"
	matchingapp "kerjo/backend/internal/matching/application"
	matchingdomain "kerjo/backend/internal/matching/domain"
	"kerjo/backend/internal/platform/id"
	platformstorage "kerjo/backend/internal/platform/storage"
	verificationapp "kerjo/backend/internal/verification/application"
	verificationdomain "kerjo/backend/internal/verification/domain"
)

type Handler struct {
	identity        *identityapp.Service
	marketplace     *marketplaceapp.Service
	matching        *matchingapp.Service
	conversation    *conversationapp.Service
	verification    *verificationapp.Service
	storage         platformstorage.Store
	verifier        *oidc.IDTokenVerifier
	googleClientIDs map[string]bool
	db              *sql.DB
	logger          *slog.Logger
}

type Dependencies struct {
	Identity        *identityapp.Service
	Marketplace     *marketplaceapp.Service
	Matching        *matchingapp.Service
	Conversation    *conversationapp.Service
	Verification    *verificationapp.Service
	Storage         platformstorage.Store
	Verifier        *oidc.IDTokenVerifier
	GoogleClientIDs []string
	DB              *sql.DB
	Logger          *slog.Logger
}

func New(dependencies Dependencies) *Handler {
	clientIDs := map[string]bool{}
	for _, clientID := range dependencies.GoogleClientIDs {
		clientIDs[clientID] = true
	}
	return &Handler{
		identity: dependencies.Identity, marketplace: dependencies.Marketplace,
		matching: dependencies.Matching, conversation: dependencies.Conversation,
		verification: dependencies.Verification,
		storage:      dependencies.Storage, verifier: dependencies.Verifier,
		googleClientIDs: clientIDs, db: dependencies.DB, logger: dependencies.Logger,
	}
}

func (h *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/{$}", h.root)
	mux.HandleFunc("GET /health/live", h.live)
	mux.HandleFunc("GET /health/ready", h.ready)
	mux.HandleFunc("POST /api/auth/google", h.googleSignIn)
	mux.Handle("GET /api/auth/me", h.auth(http.HandlerFunc(h.me)))
	mux.Handle("POST /api/auth/logout", h.auth(http.HandlerFunc(h.logout)))
	mux.Handle("GET /api/profile", h.auth(http.HandlerFunc(h.getProfile)))
	mux.Handle("POST /api/profile", h.auth(http.HandlerFunc(h.saveProfile)))
	mux.Handle("GET /api/profile/history", h.auth(http.HandlerFunc(h.profileHistory)))
	mux.Handle("GET /api/verification", h.auth(http.HandlerFunc(h.getVerification)))
	mux.Handle("POST /api/verification", h.auth(http.HandlerFunc(h.submitVerification)))
	mux.Handle("POST /api/verification/documents/{kind}", h.auth(http.HandlerFunc(h.uploadVerificationDocument)))
	mux.Handle("GET /api/verification/documents/{kind}", h.auth(http.HandlerFunc(h.serveVerificationDocument)))
	mux.Handle("GET /api/jobs", h.auth(http.HandlerFunc(h.listJobs)))
	mux.Handle("POST /api/jobs", h.auth(http.HandlerFunc(h.createJob)))
	mux.Handle("GET /api/jobs/{jobID}", h.auth(http.HandlerFunc(h.getJob)))
	mux.Handle("GET /api/workers", h.auth(http.HandlerFunc(h.listWorkers)))
	mux.Handle("GET /api/workers/{workerID}", h.auth(http.HandlerFunc(h.getWorker)))
	mux.Handle("POST /api/swipe", h.auth(http.HandlerFunc(h.swipe)))
	mux.Handle("POST /api/swipe/undo", h.auth(http.HandlerFunc(h.undoSwipe)))
	mux.Handle("GET /api/matches", h.auth(http.HandlerFunc(h.listMatches)))
	mux.Handle("GET /api/matches/unread-count", h.auth(http.HandlerFunc(h.unreadCount)))
	mux.Handle("GET /api/matches/{matchID}", h.auth(http.HandlerFunc(h.getMatch)))
	mux.Handle("POST /api/matches/{matchID}/read", h.auth(http.HandlerFunc(h.markRead)))
	mux.Handle("GET /api/applicants", h.auth(http.HandlerFunc(h.listApplicants)))
	mux.Handle("POST /api/matches/{matchID}/schedule", h.auth(h.verified(http.HandlerFunc(h.createSchedule))))
	mux.Handle("POST /api/matches/{matchID}/schedule/{scheduleID}/respond", h.auth(h.verified(http.HandlerFunc(h.respondSchedule))))
	mux.Handle("GET /api/matches/{matchID}/messages", h.auth(h.verified(http.HandlerFunc(h.getMessages))))
	mux.Handle("POST /api/matches/{matchID}/messages", h.auth(h.verified(http.HandlerFunc(h.sendMessage))))
	mux.Handle("POST /api/matches/{matchID}/complete", h.auth(http.HandlerFunc(h.completeJob)))
	mux.Handle("POST /api/matches/{matchID}/review", h.auth(http.HandlerFunc(h.reviewMatch)))
	mux.Handle("POST /api/upload", h.auth(http.HandlerFunc(h.uploadPhoto)))
	mux.Handle("POST /api/profile/photos", h.auth(http.HandlerFunc(h.uploadProfilePhoto)))
	mux.Handle("POST /api/jobs/{jobID}/photos", h.auth(http.HandlerFunc(h.uploadJobPhoto)))
	mux.HandleFunc("GET /api/files/{path...}", h.serveFile)
	return mux
}

type contextKey string

const userContextKey contextKey = "user"

func (h *Handler) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r)
		user, err := h.identity.Authenticate(r.Context(), token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Not authenticated")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userContextKey, user)))
	})
}

func (h *Handler) verified(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := h.verification.RequireApproved(r.Context(), currentUser(r).ID); err != nil {
			h.fail(w, r, err)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func currentUser(r *http.Request) identitydomain.User {
	user, _ := r.Context().Value(userContextKey).(identitydomain.User)
	return user
}

type googleTokenRequest struct {
	IDToken string `json:"id_token"`
}

type googleClaims struct {
	Subject       string `json:"sub"`
	Issuer        string `json:"iss"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func (h *Handler) googleSignIn(w http.ResponseWriter, r *http.Request) {
	if h.verifier == nil || len(h.googleClientIDs) == 0 {
		writeError(w, http.StatusServiceUnavailable, "Google sign-in is not configured")
		return
	}
	var request googleTokenRequest
	if err := decodeJSON(r, &request); err != nil || strings.TrimSpace(request.IDToken) == "" {
		writeError(w, http.StatusUnprocessableEntity, "id_token is required")
		return
	}
	token, err := h.verifier.Verify(r.Context(), request.IDToken)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Invalid Google ID token")
		return
	}
	validAudience := false
	for _, audience := range token.Audience {
		validAudience = validAudience || h.googleClientIDs[audience]
	}
	var claims googleClaims
	if token.Claims(&claims) != nil {
		writeError(w, http.StatusUnauthorized, "Invalid Google ID token claims")
		return
	}
	validIssuer := claims.Issuer == "https://accounts.google.com" || claims.Issuer == "accounts.google.com"
	if !validAudience || !validIssuer || claims.Subject == "" || claims.Email == "" || !claims.EmailVerified {
		writeError(w, http.StatusUnauthorized, "Google account is not allowed")
		return
	}
	result, err := h.identity.LoginGoogle(r.Context(), identityapp.GoogleClaims{
		Subject: claims.Subject, Email: claims.Email, Name: claims.Name, Picture: claims.Picture,
	})
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"session_token": result.Token, "user": userStateResponse(result.State)})
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	state, err := h.identity.Me(r.Context(), currentUser(r))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, userStateResponse(state))
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if err := h.identity.Logout(r.Context(), bearerToken(r)); err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

type profileRequest struct {
	Name            string   `json:"name"`
	Category        string   `json:"category"`
	ExperienceLabel string   `json:"experience_label"`
	Availability    string   `json:"availability"`
	Bio             string   `json:"bio"`
	Rate            string   `json:"rate"`
	Phone           *string  `json:"phone"`
	PhotoURL        *string  `json:"photo_url"`
	PhotoURLs       []string `json:"photo_urls"`
	Latitude        *float64 `json:"latitude"`
	Longitude       *float64 `json:"longitude"`
}

func (h *Handler) getProfile(w http.ResponseWriter, r *http.Request) {
	profile, err := h.marketplace.Profile(r.Context(), currentUser(r).ID)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func (h *Handler) saveProfile(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	var request profileRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	profile, err := h.marketplace.SaveProfile(r.Context(), marketplacedomain.Profile{
		UserID: user.ID, Name: request.Name, Category: request.Category,
		ExperienceLabel: request.ExperienceLabel, Availability: request.Availability,
		Bio: request.Bio, Rate: request.Rate, Phone: stringPointerValue(request.Phone),
		PhotoURL: stringPointerValue(request.PhotoURL), PhotoURLs: request.PhotoURLs,
		Latitude: request.Latitude, Longitude: request.Longitude,
	})
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func (h *Handler) profileHistory(w http.ResponseWriter, r *http.Request) {
	userID := currentUser(r).ID
	profile, err := h.marketplace.Profile(r.Context(), userID)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	history, err := h.matching.ProfileHistory(r.Context(), userID)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"worker_profile":   profile,
		"employer_jobs":    history.EmployerJobs,
		"worker_jobs":      history.WorkerJobs,
		"ratings_given":    history.RatingsGiven,
		"ratings_received": history.RatingsReceived,
		"ratings":          history.Ratings,
	})
}

func (h *Handler) listJobs(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	jobs, err := h.marketplace.Jobs(r.Context(), user.ID, filters(r))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, jobs)
}

func (h *Handler) listWorkers(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	workers, err := h.marketplace.Workers(r.Context(), user.ID, filters(r))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, workers)
}

func (h *Handler) getJob(w http.ResponseWriter, r *http.Request) {
	job, err := h.marketplace.Job(r.Context(), r.PathValue("jobID"))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (h *Handler) getWorker(w http.ResponseWriter, r *http.Request) {
	worker, err := h.marketplace.Worker(r.Context(), r.PathValue("workerID"))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, worker)
}

type jobRequest struct {
	Business           string   `json:"business"`
	Title              string   `json:"title"`
	Category           string   `json:"category"`
	PayAmount          int      `json:"pay_amount"`
	PayUnit            string   `json:"pay_unit"`
	DistanceKM         float64  `json:"distance_km"`
	JobType            string   `json:"job_type"`
	MinExperienceLabel string   `json:"min_experience_label"`
	Description        string   `json:"description"`
	Phone              string   `json:"phone"`
	ScreeningQuestions []string `json:"screening_questions"`
	WorkersNeeded      int      `json:"workers_needed"`
	Latitude           *float64 `json:"latitude"`
	Longitude          *float64 `json:"longitude"`
}

func (h *Handler) createJob(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	var request jobRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	job, err := h.marketplace.CreateJob(r.Context(), user.ID, marketplacedomain.JobInput{
		Business: request.Business, Title: request.Title, Category: request.Category,
		PayAmount: request.PayAmount, PayUnit: request.PayUnit, DistanceKM: request.DistanceKM,
		JobType: request.JobType, MinExperienceLabel: request.MinExperienceLabel,
		Description: request.Description, Phone: request.Phone,
		ScreeningQuestions: request.ScreeningQuestions, WorkersNeeded: request.WorkersNeeded,
		Latitude: request.Latitude, Longitude: request.Longitude,
	})
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (h *Handler) swipe(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	var request struct {
		TargetType       string   `json:"target_type"`
		TargetID         string   `json:"target_id"`
		Direction        string   `json:"direction"`
		ScreeningAnswers []string `json:"screening_answers"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	result, err := h.matching.Swipe(r.Context(), user.ID, matchingdomain.SwipeInput{
		TargetType: request.TargetType, TargetID: request.TargetID,
		Direction: request.Direction, ScreeningAnswers: request.ScreeningAnswers,
	})
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) undoSwipe(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	var request struct {
		TargetType string `json:"target_type"`
		TargetID   string `json:"target_id"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	if err := h.matching.Undo(r.Context(), user.ID, request.TargetType, request.TargetID); err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) listMatches(w http.ResponseWriter, r *http.Request) {
	result, err := h.matching.List(r.Context(), currentUser(r).ID)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) unreadCount(w http.ResponseWriter, r *http.Request) {
	count, err := h.matching.UnreadCount(r.Context(), currentUser(r).ID)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int64{"count": count})
}

func (h *Handler) listApplicants(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	result, err := h.matching.Applicants(r.Context(), user.ID)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) getMatch(w http.ResponseWriter, r *http.Request) {
	result, err := h.matching.Get(r.Context(), r.PathValue("matchID"), currentUser(r).ID)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) markRead(w http.ResponseWriter, r *http.Request) {
	if err := h.matching.MarkRead(r.Context(), r.PathValue("matchID"), currentUser(r).ID); err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) getMessages(w http.ResponseWriter, r *http.Request) {
	result, err := h.conversation.Messages(r.Context(), r.PathValue("matchID"), currentUser(r).ID)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) sendMessage(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Text string `json:"text"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	result, err := h.conversation.Send(r.Context(), r.PathValue("matchID"), currentUser(r).ID, request.Text)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) createSchedule(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Kind string `json:"kind"`
		When string `json:"when"`
		Note string `json:"note"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	result, err := h.conversation.CreateSchedule(
		r.Context(), r.PathValue("matchID"), currentUser(r).ID,
		conversationdomain.ScheduleInput{Kind: request.Kind, When: request.When, Note: request.Note},
	)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) respondSchedule(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Accept bool `json:"accept"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	result, err := h.conversation.RespondSchedule(
		r.Context(), r.PathValue("matchID"), r.PathValue("scheduleID"), currentUser(r).ID, request.Accept,
	)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) completeJob(w http.ResponseWriter, r *http.Request) {
	if err := h.matching.Complete(r.Context(), r.PathValue("matchID"), currentUser(r).ID); err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Handler) reviewMatch(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Rating  int    `json:"rating"`
		Comment string `json:"comment"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	user := currentUser(r)
	review, err := h.matching.Review(
		r.Context(), r.PathValue("matchID"), user.ID, user.Name,
		matchingdomain.ReviewInput{Rating: request.Rating, Comment: request.Comment},
	)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "review": review})
}

func (h *Handler) getVerification(w http.ResponseWriter, r *http.Request) {
	view, err := h.verification.Get(r.Context(), currentUser(r).ID)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (h *Handler) submitVerification(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Phone string `json:"phone"`
		NIK   string `json:"nik"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	view, err := h.verification.Submit(r.Context(), currentUser(r).ID, verificationdomain.Submission{
		Phone: request.Phone, NIK: request.NIK,
	})
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (h *Handler) uploadVerificationDocument(w http.ResponseWriter, r *http.Request) {
	kind := r.PathValue("kind")
	if kind != "ktp" && kind != "face" {
		writeError(w, http.StatusUnprocessableEntity, "document kind must be ktp or face")
		return
	}
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid multipart upload")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "file is required")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, 20<<20))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	contentType := http.DetectContentType(data)
	if !strings.HasPrefix(contentType, "image/") {
		writeError(w, http.StatusUnprocessableEntity, "only image uploads are allowed")
		return
	}
	userID := currentUser(r).ID
	objectPath := "kerjo/verification/" + userID + "/" + kind + "/" +
		id.New("", 24) + "." + safeImageExtension(header.Filename, contentType)
	if err := h.storage.Put(r.Context(), objectPath, data, contentType); err != nil {
		h.fail(w, r, err)
		return
	}
	if err := h.verification.SaveDocument(r.Context(), userID, kind, objectPath); err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"kind": kind, "uploaded": true})
}

func (h *Handler) serveVerificationDocument(w http.ResponseWriter, r *http.Request) {
	objectPath, err := h.verification.DocumentPath(r.Context(), currentUser(r).ID, r.PathValue("kind"))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	data, contentType, err := h.storage.Get(r.Context(), objectPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, bytes.NewReader(data))
}

func (h *Handler) uploadPhoto(w http.ResponseWriter, r *http.Request) {
	data, filename, contentType, ok := h.readImageUpload(w, r)
	if !ok {
		return
	}
	objectPath := "kerjo/uploads/" + currentUser(r).ID + "/" +
		id.New("", 24) + "." + safeImageExtension(filename, contentType)
	h.storePublicImage(w, r, objectPath, data, contentType)
}

func (h *Handler) uploadProfilePhoto(w http.ResponseWriter, r *http.Request) {
	data, filename, contentType, ok := h.readImageUpload(w, r)
	if !ok {
		return
	}
	objectPath := "kerjo/profiles/" + currentUser(r).ID + "/" +
		id.New("", 24) + "." + safeImageExtension(filename, contentType)
	h.storePublicImage(w, r, objectPath, data, contentType)
}

func (h *Handler) uploadJobPhoto(w http.ResponseWriter, r *http.Request) {
	userID := currentUser(r).ID
	jobID := r.PathValue("jobID")
	job, err := h.marketplace.Job(r.Context(), jobID)
	if err != nil || job.OwnerUserID == nil || *job.OwnerUserID != userID {
		writeError(w, http.StatusNotFound, "Job not found")
		return
	}
	if len(job.PhotoURLs) >= 5 {
		writeError(w, http.StatusUnprocessableEntity, "maximum 5 job photos")
		return
	}
	data, filename, contentType, ok := h.readImageUpload(w, r)
	if !ok {
		return
	}
	objectPath := "kerjo/jobs/" + userID + "/" + jobID + "/" +
		id.New("", 24) + "." + safeImageExtension(filename, contentType)
	if err := h.storage.Put(r.Context(), objectPath, data, contentType); err != nil {
		h.fail(w, r, err)
		return
	}
	photoURL := "/api/files/" + objectPath
	job, err = h.marketplace.AddJobPhoto(r.Context(), userID, jobID, photoURL)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"path": objectPath,
		"url":  photoURL,
		"job":  job,
	})
}

func (h *Handler) readImageUpload(
	w http.ResponseWriter,
	r *http.Request,
) ([]byte, string, string, bool) {
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid multipart upload")
		return nil, "", "", false
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "file is required")
		return nil, "", "", false
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, 20<<20))
	if err != nil {
		h.fail(w, r, err)
		return nil, "", "", false
	}
	contentType := http.DetectContentType(data)
	if !strings.HasPrefix(contentType, "image/") {
		writeError(w, http.StatusUnprocessableEntity, "only image uploads are allowed")
		return nil, "", "", false
	}
	return data, header.Filename, contentType, true
}

func (h *Handler) storePublicImage(
	w http.ResponseWriter,
	r *http.Request,
	objectPath string,
	data []byte,
	contentType string,
) {
	if err := h.storage.Put(r.Context(), objectPath, data, contentType); err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"path": objectPath, "url": "/api/files/" + objectPath})
}

func (h *Handler) serveFile(w http.ResponseWriter, r *http.Request) {
	objectPath := strings.TrimPrefix(r.PathValue("path"), "/")
	if strings.HasPrefix(objectPath, "kerjo/verification/") {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}
	data, contentType, err := h.storage.Get(r.Context(), objectPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, bytes.NewReader(data))
}

func (h *Handler) root(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "kerjo.id API"})
}

func (h *Handler) live(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	if err := h.db.PingContext(r.Context()); err != nil {
		writeError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (h *Handler) fail(w http.ResponseWriter, r *http.Request, err error) {
	status, detail := http.StatusInternalServerError, "Internal server error"
	switch {
	case errors.Is(err, identitydomain.ErrNotAuthenticated), errors.Is(err, identitydomain.ErrInvalidSession):
		status, detail = http.StatusUnauthorized, "Not authenticated"
	case errors.Is(err, marketplaceapp.ErrNotFound), errors.Is(err, matchingapp.ErrNotFound):
		status, detail = http.StatusNotFound, "Not found"
	case errors.Is(err, verificationdomain.ErrDocumentNotFound):
		status, detail = http.StatusNotFound, "Verification document not found"
	case errors.Is(err, verificationdomain.ErrVerificationRequired):
		status, detail = http.StatusForbidden, "Identity verification is required for chat"
	case errors.Is(err, marketplaceapp.ErrProfileRequired), errors.Is(err, matchingapp.ErrProfileRequired):
		status, detail = http.StatusConflict, "Lengkapi Profil Kerja sebelum melihat atau swipe Lowongan"
	case errors.Is(err, marketplaceapp.ErrJobRequired), errors.Is(err, matchingapp.ErrJobRequired):
		status, detail = http.StatusConflict, "Buat Lowongan aktif sebelum melihat atau swipe Pekerja"
	case errors.Is(err, matchingapp.ErrInvalidTarget), errors.Is(err, matchingapp.ErrInvalidReview),
		errors.Is(err, conversationapp.ErrInvalidInput), errors.Is(err, marketplaceapp.ErrInvalidInput),
		errors.Is(err, verificationdomain.ErrInvalidInput):
		status, detail = http.StatusUnprocessableEntity, err.Error()
	}
	if status >= 500 {
		h.logger.ErrorContext(r.Context(), "request failed", "error", err, "method", r.Method, "path", r.URL.Path)
	}
	writeError(w, status, detail)
}

func userStateResponse(state identityapp.UserState) map[string]any {
	return map[string]any{
		"user_id": state.User.ID, "email": state.User.Email, "name": state.User.Name,
		"picture": state.User.Picture, "has_profile": state.HasProfile, "created_at": state.User.CreatedAt,
		"verification_status": state.VerificationStatus,
	}
}

func filters(r *http.Request) marketplacedomain.Filters {
	maxDistance, _ := strconv.ParseFloat(r.URL.Query().Get("max_distance"), 64)
	return marketplacedomain.Filters{
		Category: r.URL.Query().Get("category"), Categories: queryStringList(r, "categories"),
		JobType:     r.URL.Query().Get("job_type"),
		MaxDistance: maxDistance, PayBracket: r.URL.Query().Get("pay_bracket"),
		Experience: r.URL.Query().Get("experience"),
		MaxPay:     queryFloatPointer(r, "max_pay"), MaxExperience: queryFloatPointer(r, "max_experience"),
		Latitude: queryFloatPointer(r, "latitude"), Longitude: queryFloatPointer(r, "longitude"),
	}
}

func queryStringList(r *http.Request, name string) []string {
	values := make([]string, 0)
	for _, raw := range r.URL.Query()[name] {
		for _, value := range strings.Split(raw, ",") {
			if value = strings.TrimSpace(value); value != "" {
				values = append(values, value)
			}
		}
	}
	return values
}

func queryFloatPointer(r *http.Request, name string) *float64 {
	value := strings.TrimSpace(r.URL.Query().Get(name))
	if value == "" {
		return nil
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return nil
	}
	return &parsed
}

func bearerToken(r *http.Request) string {
	authorization := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(authorization, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(authorization, "Bearer "))
}

func decodeJSON(r *http.Request, destination any) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
	decoder.DisallowUnknownFields()
	return decoder.Decode(destination)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, detail string) {
	writeJSON(w, status, map[string]string{"detail": detail})
}

func stringPointerValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func safeImageExtension(filename, contentType string) string {
	extension := strings.TrimPrefix(strings.ToLower(filepath.Ext(filename)), ".")
	switch extension {
	case "jpg", "jpeg", "png", "webp", "gif":
		return extension
	}
	if extensions, _ := mime.ExtensionsByType(contentType); len(extensions) > 0 {
		return strings.TrimPrefix(extensions[0], ".")
	}
	return "jpg"
}
