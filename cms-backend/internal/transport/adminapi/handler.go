package adminapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"kerjo/cms-backend/internal/ops/application"
	"kerjo/cms-backend/internal/ops/domain"
	"kerjo/cms-backend/internal/platform/storage"
)

const sessionCookie = "kerjo_admin_session"

type Handler struct {
	service       *application.Service
	store         storage.Store
	db            *sql.DB
	origins       map[string]bool
	cookieSecure  bool
	loginThrottle *throttle
}

func New(service *application.Service, store storage.Store, db *sql.DB, origins []string, cookieSecure bool) *Handler {
	allowed := make(map[string]bool, len(origins))
	for _, origin := range origins {
		allowed[origin] = true
	}
	return &Handler{service: service, store: store, db: db, origins: allowed,
		cookieSecure: cookieSecure, loginThrottle: newThrottle(5, time.Minute)}
}

func (h *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health/live", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /health/ready", h.ready)
	mux.HandleFunc("POST /api/auth/login", h.login)
	mux.HandleFunc("POST /api/auth/logout", h.auth(h.logout))
	mux.HandleFunc("GET /api/auth/me", h.auth(h.me))
	mux.HandleFunc("GET /api/dashboard", h.auth(h.dashboard))
	mux.HandleFunc("GET /api/verifications", h.auth(h.list("verifications", true)))
	mux.HandleFunc("GET /api/verifications/{id}", h.auth(h.detail("verifications", true)))
	mux.HandleFunc("GET /api/verifications/{id}/documents/{kind}", h.auth(h.document))
	mux.HandleFunc("POST /api/verifications/{id}/{action}", h.auth(h.reviewVerification))
	for _, kind := range []string{"users", "jobs", "reviews", "matches"} {
		mux.HandleFunc("GET /api/"+kind, h.auth(h.list(kind, kind == "users")))
		mux.HandleFunc("GET /api/"+kind+"/{id}", h.auth(h.detail(kind, kind == "users" || kind == "jobs")))
	}
	mux.HandleFunc("GET /api/users/{id}/history", h.auth(h.detail("user-history", true)))
	for _, kind := range []string{"swipes", "schedules", "messages", "audit-logs"} {
		mux.HandleFunc("GET /api/"+kind, h.auth(h.list(kind, kind == "audit-logs")))
	}
	for _, kind := range []string{"swipes", "schedules", "messages"} {
		mux.HandleFunc("GET /api/"+kind+"/{id}", h.auth(h.detail(kind, false)))
	}
	mux.HandleFunc("POST /api/users/{id}/{action}", h.auth(h.moderate("users")))
	mux.HandleFunc("POST /api/jobs/{id}/{action}", h.auth(h.moderate("jobs")))
	mux.HandleFunc("POST /api/reviews/{id}/{action}", h.auth(h.moderate("reviews")))
	mux.HandleFunc("POST /api/maintenance/history/preview", h.auth(h.cleanupPreview))
	mux.HandleFunc("POST /api/maintenance/history/execute", h.auth(h.cleanupExecute))
	return h.cors(mux)
}

type handlerFunc func(http.ResponseWriter, *http.Request, domain.Admin, string)

func (h *Handler) auth(next handlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookie)
		if err != nil {
			writeError(w, domain.ErrUnauthorized)
			return
		}
		admin, err := h.service.Authenticate(r.Context(), cookie.Value)
		if err != nil {
			writeError(w, domain.ErrUnauthorized)
			return
		}
		if mutating(r.Method) && !h.validOrigin(r) {
			writeError(w, domain.ErrForbidden)
			return
		}
		next(w, r, admin, cookie.Value)
	}
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	if !h.validOrigin(r) {
		writeError(w, domain.ErrForbidden)
		return
	}
	ip := clientIP(r)
	if !h.loginThrottle.allow(ip) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many attempts"})
		return
	}
	var input struct{ Email, Password string }
	if !decode(w, r, &input) {
		return
	}
	admin, token, expires, err := h.service.Login(r.Context(), input.Email, input.Password, ip)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: token, Path: "/api", Expires: expires,
		MaxAge: int(time.Until(expires).Seconds()), HttpOnly: true, Secure: h.cookieSecure, SameSite: http.SameSiteStrictMode})
	writeJSON(w, 200, admin)
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request, admin domain.Admin, token string) {
	if err := h.service.Logout(r.Context(), admin, token, clientIP(r)); err != nil {
		writeError(w, err)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Path: "/api", MaxAge: -1, HttpOnly: true,
		Secure: h.cookieSecure, SameSite: http.SameSiteStrictMode})
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) me(w http.ResponseWriter, _ *http.Request, admin domain.Admin, _ string) {
	writeJSON(w, 200, admin)
}

func (h *Handler) dashboard(w http.ResponseWriter, r *http.Request, _ domain.Admin, _ string) {
	value, err := h.service.Dashboard(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (h *Handler) list(kind string, sensitive bool) handlerFunc {
	return func(w http.ResponseWriter, r *http.Request, admin domain.Admin, _ string) {
		if !canRead(admin, kind) {
			writeError(w, domain.ErrForbidden)
			return
		}
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
		filters := map[string]string{}
		for _, key := range []string{"q", "status", "category", "kind", "direction", "targetType", "action"} {
			filters[key] = r.URL.Query().Get(key)
		}
		value, err := h.service.List(r.Context(), kind, filters, limit, offset)
		if err != nil {
			writeError(w, err)
			return
		}
		if sensitive {
			if err := h.service.Audit(r.Context(), admin, kind+".list", kind, "", nil, clientIP(r)); err != nil {
				writeError(w, err)
				return
			}
		}
		writeJSON(w, 200, value)
	}
}

func (h *Handler) detail(kind string, sensitive bool) handlerFunc {
	return func(w http.ResponseWriter, r *http.Request, admin domain.Admin, _ string) {
		if !canRead(admin, kind) {
			writeError(w, domain.ErrForbidden)
			return
		}
		id := r.PathValue("id")
		value, err := h.service.Detail(r.Context(), kind, id)
		if err != nil {
			writeError(w, err)
			return
		}
		if sensitive {
			if err := h.service.Audit(r.Context(), admin, kind+".read", strings.TrimSuffix(kind, "s"), id, nil, clientIP(r)); err != nil {
				writeError(w, err)
				return
			}
		}
		writeJSON(w, 200, value)
	}
}

func (h *Handler) document(w http.ResponseWriter, r *http.Request, admin domain.Admin, _ string) {
	if !canRead(admin, "verifications") {
		writeError(w, domain.ErrForbidden)
		return
	}
	userID, kind := r.PathValue("id"), r.PathValue("kind")
	if kind != "ktp" && kind != "face" {
		writeError(w, domain.ErrNotFound)
		return
	}
	value, err := h.service.Detail(r.Context(), "verifications", userID)
	if err != nil {
		writeError(w, err)
		return
	}
	path := stringValue(value[kind+"_photo_path"])
	if path == "" {
		writeError(w, domain.ErrNotFound)
		return
	}
	data, contentType, err := h.store.Get(r.Context(), path)
	if err != nil {
		writeError(w, domain.ErrNotFound)
		return
	}
	if err := h.service.Audit(r.Context(), admin, "verification.document.read", "user", userID,
		map[string]any{"kind": kind}, clientIP(r)); err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *Handler) reviewVerification(w http.ResponseWriter, r *http.Request, admin domain.Admin, _ string) {
	action := r.PathValue("action")
	if action != "approve" && action != "reject" {
		writeError(w, domain.ErrNotFound)
		return
	}
	var input struct {
		Reason string `json:"reason"`
	}
	if r.ContentLength > 0 && !decode(w, r, &input) {
		return
	}
	decision := "approved"
	if action == "reject" {
		decision = "rejected"
	}
	if err := h.service.ReviewVerification(r.Context(), admin, r.PathValue("id"), decision, input.Reason, clientIP(r)); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) moderate(kind string) handlerFunc {
	return func(w http.ResponseWriter, r *http.Request, admin domain.Admin, _ string) {
		var input struct {
			Reason string `json:"reason"`
		}
		if r.ContentLength > 0 && !decode(w, r, &input) {
			return
		}
		if err := h.service.Moderate(r.Context(), admin, kind, r.PathValue("id"), r.PathValue("action"), input.Reason, clientIP(r)); err != nil {
			writeError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) cleanupPreview(w http.ResponseWriter, r *http.Request, admin domain.Admin, _ string) {
	var input struct {
		UserID string `json:"userId"`
	}
	if !decode(w, r, &input) {
		return
	}
	value, err := h.service.CleanupPreview(r.Context(), admin, strings.TrimSpace(input.UserID), clientIP(r))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (h *Handler) cleanupExecute(w http.ResponseWriter, r *http.Request, admin domain.Admin, _ string) {
	var input struct {
		UserID       string `json:"userId"`
		Confirmation string `json:"confirmation"`
		Reason       string `json:"reason"`
	}
	if !decode(w, r, &input) {
		return
	}
	if err := h.service.Cleanup(r.Context(), admin, strings.TrimSpace(input.UserID), input.Confirmation, input.Reason, clientIP(r)); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := h.db.PingContext(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
		return
	}
	writeJSON(w, 200, map[string]string{"status": "ok"})
}

func (h *Handler) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && h.origins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			if origin == "" || !h.origins[origin] {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h *Handler) validOrigin(r *http.Request) bool { return h.origins[r.Header.Get("Origin")] }

func mutating(method string) bool {
	return method != http.MethodGet && method != http.MethodHead && method != http.MethodOptions
}

func canRead(admin domain.Admin, kind string) bool {
	if admin.Role == domain.RoleSuperadmin || admin.Role == domain.RoleModerator {
		return true
	}
	return admin.Role == domain.RoleReviewer && kind == "verifications"
}

func decode(w http.ResponseWriter, r *http.Request, target any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, err error) {
	status, message := 500, "internal error"
	switch {
	case errors.Is(err, domain.ErrUnauthorized):
		status, message = 401, "unauthorized"
	case errors.Is(err, domain.ErrForbidden):
		status, message = 403, "forbidden"
	case errors.Is(err, domain.ErrNotFound):
		status, message = 404, "not found"
	case errors.Is(err, domain.ErrInvalidInput):
		status, message = 400, "invalid request"
	case errors.Is(err, domain.ErrConflict):
		status, message = 409, "conflict"
	}
	writeJSON(w, status, map[string]string{"error": message})
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	if net.ParseIP(r.RemoteAddr) != nil {
		return r.RemoteAddr
	}
	return ""
}

func stringValue(value any) string {
	switch value := value.(type) {
	case string:
		return value
	case []byte:
		return string(value)
	default:
		return ""
	}
}

type throttle struct {
	mu      sync.Mutex
	max     int
	window  time.Duration
	entries map[string]throttleEntry
}

type throttleEntry struct {
	count int
	reset time.Time
}

func newThrottle(max int, window time.Duration) *throttle {
	return &throttle{max: max, window: window, entries: map[string]throttleEntry{}}
}

func (t *throttle) allow(key string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	now := time.Now()
	entry := t.entries[key]
	if now.After(entry.reset) {
		entry = throttleEntry{reset: now.Add(t.window)}
	}
	if entry.count >= t.max {
		return false
	}
	entry.count++
	t.entries[key] = entry
	return true
}
