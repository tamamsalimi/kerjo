package postgres

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"errors"
	"math"
	"strings"
	"time"

	"kerjo/backend/internal/matching/application"
	"kerjo/backend/internal/matching/domain"
	"kerjo/backend/internal/platform/database"
	"kerjo/backend/internal/platform/id"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	botGreetingJob    = "Halo! Terima kasih sudah tertarik dengan lowongan ini. Boleh ceritakan pengalamanmu?"
	botGreetingWorker = "Halo! Terima kasih sudah melihat profil saya. Ada yang bisa saya bantu?"
	systemMatchMsg    = "Kalian cocok! Mulai percakapan untuk membahas detail pekerjaan."
)

type Repository struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CanSwipe(ctx context.Context, userID, targetType string) (bool, error) {
	if targetType == "job" {
		var profile database.Profile
		err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&profile).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		return strings.TrimSpace(profile.Name) != "" &&
			strings.TrimSpace(profile.Category) != "" &&
			(strings.TrimSpace(profile.PhotoURL) != "" || len(profile.PhotoURLs) > 0), nil
	}

	var count int64
	err := r.db.WithContext(ctx).Model(&database.Job{}).
		Where("owner_user_id = ? AND deleted_at IS NULL AND hidden_at IS NULL", userID).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) Swipe(ctx context.Context, userID string, input domain.SwipeInput) (domain.SwipeResult, error) {
	result := domain.SwipeResult{}
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if input.TargetType == "job" {
			var available int64
			if err := tx.Model(&database.Job{}).
				Where(
					"id = ? AND deleted_at IS NULL AND hidden_at IS NULL AND (owner_user_id IS NULL OR owner_user_id <> ?)",
					input.TargetID,
					userID,
				).
				Count(&available).Error; err != nil {
				return err
			}
			if available == 0 {
				return application.ErrInvalidTarget
			}
		}
		now := time.Now().UTC()
		swipe := database.Swipe{
			SwiperUserID: userID, TargetType: input.TargetType, TargetID: input.TargetID,
			Direction: input.Direction, ScreeningAnswers: input.ScreeningAnswers, CreatedAt: now, UpdatedAt: now,
		}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "swiper_user_id"}, {Name: "target_type"}, {Name: "target_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"direction", "screening_answers", "updated_at"}),
		}).Create(&swipe).Error; err != nil {
			return err
		}
		if input.Direction != "right" {
			return nil
		}
		var match database.Match
		var err error
		if input.TargetType == "job" {
			match, err = r.matchJob(tx, userID, input.TargetID, now)
		} else {
			match, err = r.matchWorker(tx, userID, input.TargetID, input.JobID, now)
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		view, err := r.display(tx, match, userID)
		if err != nil {
			return err
		}
		result.Matched = true
		result.Match = &view
		return nil
	})
	return result, err
}

func (r *Repository) matchJob(tx *gorm.DB, workerID, jobID string, now time.Time) (database.Match, error) {
	var job database.Job
	if err := tx.Where("id = ? AND deleted_at IS NULL AND hidden_at IS NULL", jobID).First(&job).Error; err != nil {
		return database.Match{}, err
	}
	if job.OwnerUserID == nil {
		return r.createBotMatch(tx, workerID, "job", job.ID, job.Title, job.Business, "", job.Category, botGreetingJob, now)
	}
	var reciprocal database.Swipe
	err := tx.Where(
		"swiper_user_id = ? AND target_type = 'worker' AND target_id = ? AND direction = 'right'",
		*job.OwnerUserID, "wp_"+workerID,
	).First(&reciprocal).Error
	if err != nil {
		return database.Match{}, err
	}
	return r.createRealMatch(tx, workerID, *job.OwnerUserID, job, now)
}

func (r *Repository) matchWorker(tx *gorm.DB, employerID, targetID, preferredJobID string, now time.Time) (database.Match, error) {
	if !strings.HasPrefix(targetID, "wp_") {
		var worker database.Worker
		if err := tx.Where("id = ? AND deleted_at IS NULL", targetID).First(&worker).Error; err != nil {
			return database.Match{}, err
		}
		return r.createBotMatch(tx, employerID, "worker", worker.ID, worker.Name, worker.Role, worker.Avatar, worker.Category, botGreetingWorker, now)
	}
	workerID := strings.TrimPrefix(targetID, "wp_")
	liked, err := r.workerJobApplication(tx, workerID, employerID, preferredJobID, true)
	if errors.Is(err, gorm.ErrRecordNotFound) && preferredJobID == "" {
		liked, err = r.workerJobApplication(tx, workerID, employerID, "", false)
	}
	if err != nil {
		return database.Match{}, err
	}
	var job database.Job
	if err := tx.Where("id = ?", liked.TargetID).First(&job).Error; err != nil {
		return database.Match{}, err
	}
	return r.createRealMatch(tx, workerID, employerID, job, now)
}

func (r *Repository) workerJobApplication(
	tx *gorm.DB, workerID, employerID, preferredJobID string, unmatchedOnly bool,
) (database.Swipe, error) {
	query := tx.Table("swipes").
		Select("swipes.*").
		Joins("JOIN jobs ON jobs.id = swipes.target_id").
		Where(`swipes.swiper_user_id = ? AND swipes.target_type = 'job' AND swipes.direction = 'right'
			AND jobs.owner_user_id = ? AND jobs.deleted_at IS NULL AND jobs.hidden_at IS NULL`, workerID, employerID)
	if preferredJobID != "" {
		query = query.Where("jobs.id = ?", preferredJobID)
	}
	if unmatchedOnly {
		query = query.Where(`NOT EXISTS (
			SELECT 1 FROM matches
			WHERE matches.kind = 'real' AND matches.worker_user_id = ? AND matches.job_id = jobs.id
		)`, workerID)
	}
	var liked database.Swipe
	err := query.Order("swipes.updated_at DESC").First(&liked).Error
	return liked, err
}

func (r *Repository) createBotMatch(
	tx *gorm.DB,
	userID, entityType, entityID, title, subtitle, image, category, greeting string,
	now time.Time,
) (database.Match, error) {
	var existing database.Match
	err := tx.Where("kind = 'bot' AND user_id = ? AND entity_type = ? AND entity_id = ?", userID, entityType, entityID).
		First(&existing).Error
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return database.Match{}, err
	}
	match := database.Match{
		ID: id.New("match_", 12), Kind: "bot", UserID: &userID, EntityType: entityType,
		EntityID: entityID, Title: title, Subtitle: subtitle, Image: cleanAvatar(image),
		Category: category, CreatedAt: now, UpdatedAt: now,
	}
	if err := tx.Create(&match).Error; err != nil {
		return database.Match{}, err
	}
	if err := tx.Create(&database.MatchParticipant{MatchID: match.ID, UserID: userID, Role: "owner"}).Error; err != nil {
		return database.Match{}, err
	}
	if err := tx.Create(&database.Message{MatchID: match.ID, Sender: "bot", Text: greeting, CreatedAt: now}).Error; err != nil {
		return database.Match{}, err
	}
	return match, nil
}

func (r *Repository) createRealMatch(tx *gorm.DB, workerID, employerID string, job database.Job, now time.Time) (database.Match, error) {
	var existing database.Match
	err := tx.Where(
		"kind = 'real' AND worker_user_id = ? AND employer_user_id = ? AND job_id = ?",
		workerID, employerID, job.ID,
	).First(&existing).Error
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return database.Match{}, err
	}
	var profile database.Profile
	_ = tx.Where("user_id = ?", workerID).First(&profile).Error
	var worker database.User
	_ = tx.Where("user_id = ?", workerID).First(&worker).Error
	workerName := profile.Name
	if workerName == "" {
		workerName = worker.Name
	}
	match := database.Match{
		ID: id.New("match_", 12), Kind: "real", WorkerUserID: &workerID, EmployerUserID: &employerID,
		JobID: &job.ID, WorkerName: workerName, WorkerCategory: profile.Category,
		WorkerAvatar:          cleanAvatar(primaryProfilePhoto(profile)),
		WorkerPhone:           directCallPhone(profile.Phone, profile.AllowDirectCall),
		WorkerAllowDirectCall: profile.AllowDirectCall,
		JobTitle:              job.Title, JobBusiness: job.Business, JobCategory: job.Category,
		JobPhone:           directCallPhone(job.Phone, job.AllowDirectCall),
		JobAllowDirectCall: job.AllowDirectCall,
		CreatedAt:          now, UpdatedAt: now,
	}
	if err := tx.Create(&match).Error; err != nil {
		return database.Match{}, err
	}
	participants := []database.MatchParticipant{
		{MatchID: match.ID, UserID: workerID, Role: "worker"},
		{MatchID: match.ID, UserID: employerID, Role: "employer"},
	}
	if err := tx.Create(&participants).Error; err != nil {
		return database.Match{}, err
	}
	if err := tx.Create(&database.Message{MatchID: match.ID, Sender: "system", Text: systemMatchMsg, CreatedAt: now}).Error; err != nil {
		return database.Match{}, err
	}
	return match, nil
}

func (r *Repository) Undo(ctx context.Context, userID, targetType, targetID string) error {
	return r.db.WithContext(ctx).Where(
		"swiper_user_id = ? AND target_type = ? AND target_id = ?", userID, targetType, targetID,
	).Delete(&database.Swipe{}).Error
}

func (r *Repository) RecycleSkipped(ctx context.Context, userID, targetType string) (int64, error) {
	result := r.db.WithContext(ctx).Where(
		"swiper_user_id = ? AND target_type = ? AND direction = ?",
		userID, targetType, "left",
	).Delete(&database.Swipe{})
	return result.RowsAffected, result.Error
}

func (r *Repository) List(ctx context.Context, userID string) ([]domain.MatchView, error) {
	var matches []database.Match
	err := r.db.WithContext(ctx).Table("matches").
		Select("matches.*").
		Joins("JOIN match_participants ON match_participants.match_id = matches.id").
		Where("match_participants.user_id = ?", userID).
		Order("matches.created_at DESC").Limit(500).Find(&matches).Error
	if err != nil {
		return nil, err
	}
	if len(matches) == 0 {
		return []domain.MatchView{}, nil
	}
	ids := make([]string, 0, len(matches))
	for _, match := range matches {
		ids = append(ids, match.ID)
	}
	type lastMessage struct {
		MatchID string
		Text    string
	}
	var latest []lastMessage
	if err := r.db.WithContext(ctx).Raw(`
		SELECT DISTINCT ON (match_id) match_id, text
		FROM messages WHERE match_id IN ?
		ORDER BY match_id, created_at DESC, id DESC`, ids).Scan(&latest).Error; err != nil {
		return nil, err
	}
	lastByMatch := map[string]string{}
	for _, item := range latest {
		lastByMatch[item.MatchID] = item.Text
	}
	unreadByMatch, err := r.unreadByMatch(ctx, userID, ids)
	if err != nil {
		return nil, err
	}
	var reviewerRows []database.MatchReviewer
	if err := r.db.WithContext(ctx).
		Where("user_id = ? AND match_id IN ?", userID, ids).
		Find(&reviewerRows).Error; err != nil {
		return nil, err
	}
	reviewedByMatch := map[string]bool{}
	for _, reviewer := range reviewerRows {
		reviewedByMatch[reviewer.MatchID] = true
	}
	workerIDs := make([]string, 0, len(matches))
	jobIDs := make([]string, 0, len(matches))
	for _, match := range matches {
		if match.Kind == "real" && match.WorkerUserID != nil && *match.WorkerUserID != userID {
			workerIDs = append(workerIDs, *match.WorkerUserID)
		}
		if match.Kind == "real" && match.WorkerUserID != nil && *match.WorkerUserID == userID && match.JobID != nil {
			jobIDs = append(jobIDs, *match.JobID)
		}
	}
	currentWorkerPhotos := map[string]string{}
	if len(workerIDs) > 0 {
		var profiles []database.Profile
		if err := r.db.WithContext(ctx).Where("user_id IN ?", workerIDs).Find(&profiles).Error; err != nil {
			return nil, err
		}
		for _, profile := range profiles {
			currentWorkerPhotos[profile.UserID] = cleanAvatar(primaryProfilePhoto(profile))
		}
	}
	currentJobPhotos := map[string]string{}
	if len(jobIDs) > 0 {
		var jobs []database.Job
		if err := r.db.WithContext(ctx).Where("id IN ?", jobIDs).Find(&jobs).Error; err != nil {
			return nil, err
		}
		for _, job := range jobs {
			currentJobPhotos[job.ID] = primaryJobPhoto(job)
		}
	}
	result := make([]domain.MatchView, 0, len(matches))
	for _, match := range matches {
		view := displayBase(match, userID)
		if match.WorkerUserID != nil && view.EntityType == "worker" {
			if photo := currentWorkerPhotos[*match.WorkerUserID]; photo != "" {
				view.Image = photo
			}
		}
		if match.JobID != nil && view.EntityType == "job" {
			if photo := currentJobPhotos[*match.JobID]; photo != "" {
				view.Image = photo
			}
		}
		view.Reviewed = match.Reviewed || reviewedByMatch[match.ID]
		view.LastMessage = lastByMatch[match.ID]
		view.Unread = unreadByMatch[match.ID]
		result = append(result, view)
	}
	return result, nil
}

func (r *Repository) UnreadCount(ctx context.Context, userID string) (int64, error) {
	var total int64
	err := r.db.WithContext(ctx).Raw(`
		SELECT COUNT(*)
		FROM messages m
		JOIN match_participants p ON p.match_id = m.match_id AND p.user_id = ?
		LEFT JOIN match_read_receipts rr ON rr.match_id = m.match_id AND rr.user_id = ?
		WHERE m.sender NOT IN (?, 'system') AND m.created_at > COALESCE(rr.read_at, '-infinity'::timestamptz)`,
		userID, userID, userID,
	).Scan(&total).Error
	return total, err
}

func (r *Repository) unreadByMatch(ctx context.Context, userID string, ids []string) (map[string]int64, error) {
	type row struct {
		MatchID string
		Count   int64
	}
	var rows []row
	err := r.db.WithContext(ctx).Raw(`
		SELECT m.match_id, COUNT(*) AS count
		FROM messages m
		LEFT JOIN match_read_receipts rr ON rr.match_id = m.match_id AND rr.user_id = ?
		WHERE m.match_id IN ? AND m.sender NOT IN (?, 'system')
		  AND m.created_at > COALESCE(rr.read_at, '-infinity'::timestamptz)
		GROUP BY m.match_id`, userID, ids, userID).Scan(&rows).Error
	result := map[string]int64{}
	for _, item := range rows {
		result[item.MatchID] = item.Count
	}
	return result, err
}

func (r *Repository) Applicants(ctx context.Context, employerID string) ([]domain.Applicant, error) {
	type row struct {
		WorkerID        string
		Name            string
		Category        string
		ExperienceLabel string
		LastEducation   string
		Availability    string
		Rate            string
		Phone           string
		AllowDirectCall bool
		PhotoURL        string
		Bio             string
		JobID           string
		JobTitle        string
		Questions       []byte
		Answers         []byte
		MatchID         *string
		Rating          float64
		JobsCompleted   int
	}
	var rows []row
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			s.swiper_user_id AS worker_id,
			COALESCE(NULLIF(p.name, ''), u.name) AS name,
			COALESCE(NULLIF(p.category, ''), 'Belum ada profil') AS category,
			COALESCE(NULLIF(p.experience_label, ''), 'Belum diisi') AS experience_label,
			p.last_education, p.availability, p.rate, p.phone, p.allow_direct_call, p.photo_url, p.bio,
			j.id AS job_id, j.title AS job_title, j.screening_questions AS questions,
			s.screening_answers AS answers, mt.id AS match_id,
			COALESCE(rs.rating, 0) AS rating, COALESCE(rs.count, 0) AS jobs_completed
		FROM swipes s
		JOIN jobs j ON j.id = s.target_id AND j.owner_user_id = ? AND j.deleted_at IS NULL
		JOIN users u ON u.user_id = s.swiper_user_id
		LEFT JOIN profiles p ON p.user_id = s.swiper_user_id
		LEFT JOIN matches mt ON mt.kind = 'real'
			AND mt.worker_user_id = s.swiper_user_id
			AND mt.employer_user_id = ?
			AND mt.job_id = j.id
		LEFT JOIN (
			SELECT worker_id, AVG(rating)::float AS rating, COUNT(*)::int AS count
			FROM reviews GROUP BY worker_id
		) rs ON rs.worker_id = 'wp_' || s.swiper_user_id
		WHERE s.target_type = 'job' AND s.direction = 'right' AND s.swiper_user_id <> ?
		ORDER BY s.updated_at DESC`, employerID, employerID, employerID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]domain.Applicant, 0, len(rows))
	for _, item := range rows {
		result = append(result, domain.Applicant{
			ID: "wp_" + item.WorkerID, Name: item.Name, Category: item.Category, Role: item.Category,
			ExperienceLabel: item.ExperienceLabel, ExperienceBucket: profileExperienceBucket(item.ExperienceLabel),
			LastEducation: item.LastEducation,
			DistanceKM:    stableDistance(item.WorkerID), PayDisplay: item.Rate,
			Rating: math.Round(item.Rating*10) / 10, JobsCompleted: item.JobsCompleted,
			Verified: true, IsNew: item.JobsCompleted == 0, Avatar: cleanAvatar(item.PhotoURL),
			Bio: item.Bio, Availability: item.Availability,
			Phone:           directCallPhone(item.Phone, item.AllowDirectCall),
			AllowDirectCall: item.AllowDirectCall,
			OwnerUserID:     item.WorkerID, IsReal: true, AppliedJobTitle: item.JobTitle,
			AppliedJobID: item.JobID, ScreeningQuestions: decodeJSONStrings(item.Questions), ScreeningAnswers: decodeJSONStrings(item.Answers),
			Matched: item.MatchID != nil, MatchID: item.MatchID,
		})
	}
	return result, nil
}

func (r *Repository) Get(ctx context.Context, matchID, userID string) (domain.MatchView, error) {
	match, err := r.matchForUser(r.db.WithContext(ctx), matchID, userID)
	if err != nil {
		return domain.MatchView{}, err
	}
	view, err := r.display(r.db.WithContext(ctx), match, userID)
	if err != nil {
		return domain.MatchView{}, err
	}
	r.enrichMatchDetail(ctx, &view)
	if match.Kind == "real" {
		otherID := value(match.WorkerUserID)
		if otherID == userID {
			otherID = value(match.EmployerUserID)
		}
		var other database.User
		if r.db.WithContext(ctx).Where("user_id = ?", otherID).First(&other).Error == nil && other.LastSeen != nil {
			view.Online = time.Since(*other.LastSeen) < 2*time.Minute
		}
	}
	return view, nil
}

func (r *Repository) enrichMatchDetail(ctx context.Context, view *domain.MatchView) {
	switch view.EntityType {
	case "job":
		var job database.Job
		if view.EntityID == "" || r.db.WithContext(ctx).Where("id = ?", view.EntityID).First(&job).Error != nil {
			return
		}
		view.PayAmount = job.PayAmount
		view.PayUnit = job.PayUnit
		view.EmployerType = job.EmployerType
		view.Image = primaryJobPhoto(job)
		view.JobType = job.JobType
		view.Experience = job.MinExperienceLabel
		view.Description = job.Description
	case "worker":
		if strings.HasPrefix(view.EntityID, "wp_") {
			userID := strings.TrimPrefix(view.EntityID, "wp_")
			var profile database.Profile
			if r.db.WithContext(ctx).Where("user_id = ?", userID).First(&profile).Error != nil {
				return
			}
			view.PayDisplay = profile.Rate
			view.Experience = profile.ExperienceLabel
			view.LastEducation = profile.LastEducation
			view.Image = cleanAvatar(primaryProfilePhoto(profile))
			view.Availability = profile.Availability
			view.Bio = profile.Bio
			var count int64
			_ = r.db.WithContext(ctx).Model(&database.UserVerification{}).
				Where("user_id = ? AND status = ?", userID, "approved").Count(&count).Error
			view.Verified = count > 0
			return
		}
		var worker database.Worker
		if view.EntityID == "" || r.db.WithContext(ctx).Where("id = ?", view.EntityID).First(&worker).Error != nil {
			return
		}
		view.PayAmount = worker.PayAmount
		view.PayUnit = worker.PayUnit
		view.Experience = worker.ExperienceLabel
		view.LastEducation = worker.LastEducation
		view.Bio = worker.Bio
		view.Verified = worker.Verified
	}
}

func (r *Repository) MarkRead(ctx context.Context, matchID, userID string) error {
	if _, err := r.matchForUser(r.db.WithContext(ctx), matchID, userID); err != nil {
		return err
	}
	receipt := database.MatchReadReceipt{MatchID: matchID, UserID: userID, ReadAt: time.Now().UTC()}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "match_id"}, {Name: "user_id"}},
		UpdateAll: true,
	}).Create(&receipt).Error
}

func (r *Repository) Complete(ctx context.Context, matchID, userID string) error {
	if _, err := r.matchForUser(r.db.WithContext(ctx), matchID, userID); err != nil {
		return err
	}
	return r.db.WithContext(ctx).Model(&database.Match{}).Where("id = ?", matchID).
		Updates(map[string]any{"job_done": true, "updated_at": time.Now().UTC()}).Error
}

func (r *Repository) Review(
	ctx context.Context,
	matchID, userID, author string,
	input domain.ReviewInput,
) (map[string]any, error) {
	result := map[string]any{}
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		match, err := r.matchForUser(tx, matchID, userID)
		if err != nil {
			return err
		}
		now := time.Now().UTC()
		review := database.Review{
			ID: id.New("rev_", 10), MatchID: &matchID, ReviewerUserID: &userID,
			Author: first(author, "Pengguna"), Rating: input.Rating, Comment: input.Comment,
			DisplayDate: now.Format("Jan 2006"), CreatedAt: now,
		}
		if match.Kind == "bot" {
			if match.EntityType == "worker" {
				review.WorkerID = match.EntityID
				if err := tx.Create(&review).Error; err != nil {
					return err
				}
			}
			if err := tx.Model(&match).Updates(map[string]any{"reviewed": true, "job_done": true, "updated_at": now}).Error; err != nil {
				return err
			}
		} else {
			if match.EmployerUserID != nil && userID == *match.EmployerUserID {
				review.WorkerID = "wp_" + value(match.WorkerUserID)
			} else {
				review.WorkerID = "employer_" + value(match.EmployerUserID)
			}
			if err := tx.Create(&review).Error; err != nil {
				return err
			}
			if err := tx.Model(&match).Updates(map[string]any{"job_done": true, "updated_at": now}).Error; err != nil {
				return err
			}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(
				&database.MatchReviewer{MatchID: matchID, UserID: userID},
			).Error; err != nil {
				return err
			}
		}
		result = map[string]any{
			"id": review.ID, "worker_id": review.WorkerID, "author": review.Author,
			"rating": review.Rating, "comment": review.Comment, "date": review.DisplayDate,
		}
		return nil
	})
	return result, err
}

func (r *Repository) ProfileHistory(ctx context.Context, userID string) (domain.ProfileHistory, error) {
	result := domain.ProfileHistory{
		EmployerJobs:    []domain.EmployerJobHistory{},
		WorkerJobs:      []domain.WorkerJobHistory{},
		RatingsGiven:    []domain.HistoryReview{},
		RatingsReceived: []domain.HistoryReview{},
	}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT j.id, j.title, j.business, j.employer_type,
			CASE
				WHEN j.deleted_at IS NOT NULL THEN 'closed'
				WHEN COUNT(DISTINCT mt.id) >= j.workers_needed THEN 'full'
				ELSE 'open'
			END AS status,
			j.workers_needed AS people_needed,
			COUNT(DISTINCT mt.id) AS people_filled,
			COUNT(DISTINCT s.swiper_user_id) FILTER (WHERE s.direction = 'right') AS applicant_count,
			COUNT(DISTINCT mt.id) AS match_count,
			j.created_at
		FROM jobs j
		LEFT JOIN swipes s ON s.target_type = 'job' AND s.target_id = j.id
		LEFT JOIN matches mt ON mt.kind = 'real' AND mt.job_id = j.id
		WHERE j.owner_user_id = ?
		GROUP BY j.id, j.title, j.business, j.employer_type, j.deleted_at, j.workers_needed, j.created_at
		ORDER BY j.created_at DESC`, userID).Scan(&result.EmployerJobs).Error; err != nil {
		return domain.ProfileHistory{}, err
	}
	type applicantResponseRow struct {
		JobID              string
		WorkerID           string
		WorkerName         string
		Category           string
		ExperienceLabel    string
		LastEducation      string
		Rate               string
		PhotoURL           string
		Bio                string
		ScreeningQuestions []byte
		ScreeningAnswers   []byte
		CreatedAt          time.Time
	}
	var responseRows []applicantResponseRow
	if err := r.db.WithContext(ctx).Raw(`
		SELECT j.id AS job_id, s.swiper_user_id AS worker_id,
			COALESCE(NULLIF(p.name, ''), NULLIF(u.name, ''), 'Pelamar') AS worker_name,
			COALESCE(NULLIF(p.category, ''), '') AS category,
			COALESCE(NULLIF(p.experience_label, ''), '') AS experience_label,
			COALESCE(p.last_education, '') AS last_education,
			COALESCE(p.rate, '') AS rate,
			COALESCE(NULLIF(p.photo_url, ''), NULLIF(p.photo_urls->>0, ''), '') AS photo_url,
			COALESCE(p.bio, '') AS bio,
			j.screening_questions, s.screening_answers, s.updated_at AS created_at
		FROM swipes s
		JOIN jobs j ON j.id = s.target_id AND j.owner_user_id = ?
		JOIN users u ON u.user_id = s.swiper_user_id
		LEFT JOIN profiles p ON p.user_id = s.swiper_user_id
		WHERE s.target_type = 'job' AND s.direction = 'right'
		ORDER BY s.updated_at DESC`, userID).Scan(&responseRows).Error; err != nil {
		return domain.ProfileHistory{}, err
	}
	responsesByJob := make(map[string][]domain.EmployerApplicantResponse, len(result.EmployerJobs))
	for _, row := range responseRows {
		responsesByJob[row.JobID] = append(responsesByJob[row.JobID], domain.EmployerApplicantResponse{
			JobID:              row.JobID,
			WorkerID:           "wp_" + row.WorkerID,
			WorkerName:         row.WorkerName,
			Category:           row.Category,
			ExperienceLabel:    row.ExperienceLabel,
			LastEducation:      row.LastEducation,
			Rate:               row.Rate,
			PhotoURL:           cleanAvatar(row.PhotoURL),
			Bio:                row.Bio,
			ScreeningQuestions: decodeJSONStrings(row.ScreeningQuestions),
			ScreeningAnswers:   decodeJSONStrings(row.ScreeningAnswers),
			CreatedAt:          row.CreatedAt,
		})
	}
	for i, job := range result.EmployerJobs {
		result.EmployerJobs[i].ApplicantResponses = responsesByJob[job.ID]
		if result.EmployerJobs[i].ApplicantResponses == nil {
			result.EmployerJobs[i].ApplicantResponses = []domain.EmployerApplicantResponse{}
		}
	}
	type workerJobRow struct {
		ID                 string
		Title              string
		Business           string
		EmployerName       string
		EmployerType       string
		EmployerPhoto      string
		Status             string
		MatchID            *string
		ScreeningQuestions []byte
		ScreeningAnswers   []byte
		CreatedAt          time.Time
	}
	var workerRows []workerJobRow
	if err := r.db.WithContext(ctx).Raw(`
		SELECT j.id, j.title, j.business, j.employer_type,
			COALESCE(NULLIF(ep.name, ''), NULLIF(eu.name, ''), j.business) AS employer_name,
			COALESCE(NULLIF(ep.photo_url, ''), NULLIF(ep.photo_urls->>0, ''), '') AS employer_photo,
			mt.id AS match_id,
			CASE
				WHEN mt.job_done THEN 'completed'
				WHEN COALESCE(schedules.count, 0) > 0 THEN 'scheduled'
				WHEN mt.id IS NOT NULL THEN 'aligned'
				ELSE 'matched'
			END AS status,
			j.screening_questions, s.screening_answers,
			s.updated_at AS created_at
		FROM swipes s
		JOIN jobs j ON j.id = s.target_id
		LEFT JOIN users eu ON eu.user_id = j.owner_user_id
		LEFT JOIN profiles ep ON ep.user_id = j.owner_user_id
		LEFT JOIN matches mt ON mt.kind = 'real' AND mt.worker_user_id = ? AND mt.job_id = j.id
		LEFT JOIN LATERAL (
			SELECT COUNT(*) AS count
			FROM message_schedules ms
			JOIN messages msg ON msg.id = ms.message_id
			WHERE msg.match_id = mt.id AND ms.status IN ('pending', 'accepted')
		) schedules ON TRUE
		WHERE s.swiper_user_id = ? AND s.target_type = 'job' AND s.direction = 'right'
		ORDER BY s.updated_at DESC`, userID, userID).Scan(&workerRows).Error; err != nil {
		return domain.ProfileHistory{}, err
	}
	result.WorkerJobs = make([]domain.WorkerJobHistory, 0, len(workerRows))
	for _, row := range workerRows {
		result.WorkerJobs = append(result.WorkerJobs, domain.WorkerJobHistory{
			ID:                 row.ID,
			Title:              row.Title,
			Business:           row.Business,
			EmployerName:       row.EmployerName,
			EmployerType:       row.EmployerType,
			EmployerPhoto:      cleanAvatar(row.EmployerPhoto),
			Status:             row.Status,
			MatchID:            row.MatchID,
			ScreeningQuestions: decodeJSONStrings(row.ScreeningQuestions),
			ScreeningAnswers:   decodeJSONStrings(row.ScreeningAnswers),
			CreatedAt:          row.CreatedAt,
		})
	}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT r.id, COALESCE(r.match_id, '') AS match_id,
			COALESCE(NULLIF(mt.worker_name, ''), 'Pekerja') AS counterparty,
			r.rating, r.comment, r.created_at
		FROM reviews r
		JOIN matches mt ON mt.id = r.match_id
		WHERE r.reviewer_user_id = ? AND mt.employer_user_id = ?
		ORDER BY r.created_at DESC`, userID, userID).Scan(&result.RatingsGiven).Error; err != nil {
		return domain.ProfileHistory{}, err
	}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT r.id, COALESCE(r.match_id, '') AS match_id,
			COALESCE(NULLIF(u.name, ''), NULLIF(mt.job_business, ''), 'Pemberi Kerja') AS counterparty,
			r.rating, r.comment, r.created_at
		FROM reviews r
		JOIN matches mt ON mt.id = r.match_id
		LEFT JOIN users u ON u.user_id = mt.employer_user_id
		WHERE mt.worker_user_id = ? AND r.reviewer_user_id = mt.employer_user_id
		ORDER BY r.created_at DESC`, userID).Scan(&result.RatingsReceived).Error; err != nil {
		return domain.ProfileHistory{}, err
	}
	type ratingRow struct {
		CombinedAverage float64
		CombinedCount   int64
		WorkerAverage   float64
		WorkerCount     int64
		EmployerAverage float64
		EmployerCount   int64
	}
	var ratings ratingRow
	if err := r.db.WithContext(ctx).Raw(`
		SELECT
			COALESCE(AVG(r.rating) FILTER (WHERE
				(mt.worker_user_id = ? AND r.reviewer_user_id = mt.employer_user_id) OR
				(mt.employer_user_id = ? AND r.reviewer_user_id = mt.worker_user_id)
			), 0)::float AS combined_average,
			COUNT(*) FILTER (WHERE
				(mt.worker_user_id = ? AND r.reviewer_user_id = mt.employer_user_id) OR
				(mt.employer_user_id = ? AND r.reviewer_user_id = mt.worker_user_id)
			) AS combined_count,
			COALESCE(AVG(r.rating) FILTER (WHERE mt.worker_user_id = ? AND r.reviewer_user_id = mt.employer_user_id), 0)::float AS worker_average,
			COUNT(*) FILTER (WHERE mt.worker_user_id = ? AND r.reviewer_user_id = mt.employer_user_id) AS worker_count,
			COALESCE(AVG(r.rating) FILTER (WHERE mt.employer_user_id = ? AND r.reviewer_user_id = mt.worker_user_id), 0)::float AS employer_average,
			COUNT(*) FILTER (WHERE mt.employer_user_id = ? AND r.reviewer_user_id = mt.worker_user_id) AS employer_count
		FROM reviews r
		JOIN matches mt ON mt.id = r.match_id`,
		userID, userID, userID, userID, userID, userID, userID, userID,
	).Scan(&ratings).Error; err != nil {
		return domain.ProfileHistory{}, err
	}
	result.Ratings = domain.RatingBreakdown{
		Combined: domain.RatingSummary{Average: math.Round(ratings.CombinedAverage*10) / 10, Count: ratings.CombinedCount},
		Worker:   domain.RatingSummary{Average: math.Round(ratings.WorkerAverage*10) / 10, Count: ratings.WorkerCount},
		Employer: domain.RatingSummary{Average: math.Round(ratings.EmployerAverage*10) / 10, Count: ratings.EmployerCount},
	}
	return result, nil
}

func (r *Repository) matchForUser(tx *gorm.DB, matchID, userID string) (database.Match, error) {
	var match database.Match
	err := tx.Table("matches").Select("matches.*").
		Joins("JOIN match_participants ON match_participants.match_id = matches.id").
		Where("matches.id = ? AND match_participants.user_id = ?", matchID, userID).
		First(&match).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return database.Match{}, application.ErrNotFound
	}
	return match, err
}

func (r *Repository) display(tx *gorm.DB, match database.Match, userID string) (domain.MatchView, error) {
	view := displayBase(match, userID)
	if match.Kind == "bot" {
		return view, nil
	}
	var count int64
	if err := tx.Model(&database.MatchReviewer{}).Where("match_id = ? AND user_id = ?", match.ID, userID).Count(&count).Error; err != nil {
		return domain.MatchView{}, err
	}
	view.Reviewed = count > 0
	r.applyLiveDirectCall(tx, match, userID, &view)
	return view, nil
}

func (r *Repository) applyLiveDirectCall(tx *gorm.DB, match database.Match, userID string, view *domain.MatchView) {
	if match.Kind != "real" {
		return
	}
	if value(match.WorkerUserID) == userID {
		var job database.Job
		if match.JobID != nil && tx.Where("id = ?", *match.JobID).First(&job).Error == nil {
			if strings.TrimSpace(job.Phone) != "" {
				view.AllowDirectCall = job.AllowDirectCall
				view.Phone = directCallPhone(job.Phone, job.AllowDirectCall)
				return
			}
			var employerProfile database.Profile
			if tx.Where("user_id = ?", value(match.EmployerUserID)).First(&employerProfile).Error == nil {
				view.AllowDirectCall = employerProfile.AllowDirectCall
				view.Phone = directCallPhone(employerProfile.Phone, employerProfile.AllowDirectCall)
				return
			}
		}
		view.AllowDirectCall = match.JobAllowDirectCall
		view.Phone = directCallPhone(match.JobPhone, match.JobAllowDirectCall)
		return
	}
	var profile database.Profile
	if tx.Where("user_id = ?", value(match.WorkerUserID)).First(&profile).Error == nil {
		view.AllowDirectCall = profile.AllowDirectCall
		view.Phone = directCallPhone(profile.Phone, profile.AllowDirectCall)
		return
	}
	view.AllowDirectCall = match.WorkerAllowDirectCall
	view.Phone = directCallPhone(match.WorkerPhone, match.WorkerAllowDirectCall)
}

func displayBase(match database.Match, userID string) domain.MatchView {
	view := domain.MatchView{
		ID: match.ID, Kind: match.Kind, JobDone: match.JobDone, CreatedAt: match.CreatedAt,
	}
	if match.Kind == "bot" {
		view.EntityType, view.EntityID = match.EntityType, match.EntityID
		view.Title, view.Subtitle, view.Image, view.Category = match.Title, match.Subtitle, cleanAvatar(match.Image), match.Category
		view.Reviewed = match.Reviewed
		return view
	}
	if match.WorkerUserID != nil && userID == *match.WorkerUserID {
		view.EntityType, view.Title, view.Subtitle, view.Category = "job", match.JobTitle, match.JobBusiness, match.JobCategory
		if match.JobID != nil {
			view.EntityID = *match.JobID
		}
	} else {
		view.EntityType, view.Title, view.Subtitle = "worker", match.WorkerName, "Pelamar • "+match.WorkerCategory
		view.Image, view.Category = cleanAvatar(match.WorkerAvatar), match.WorkerCategory
		if match.WorkerUserID != nil {
			view.EntityID = "wp_" + *match.WorkerUserID
		}
	}
	return view
}

func decodeJSONStrings(raw []byte) []string {
	if len(raw) == 0 {
		return []string{}
	}
	var result []string
	if err := json.Unmarshal(raw, &result); err != nil || result == nil {
		return []string{}
	}
	return result
}

func value(input *string) string {
	if input == nil {
		return ""
	}
	return *input
}

func first(values ...string) string {
	for _, item := range values {
		if item != "" {
			return item
		}
	}
	return ""
}

func directCallPhone(phone string, allowed bool) string {
	if !allowed {
		return ""
	}
	return phone
}

func profileExperienceBucket(label string) string {
	values := map[string]string{"Tidak wajib": "any", "Baru": "baru", "1-2 tahun": "1-2", "3-5 tahun": "3-5", "5+ tahun": "5+"}
	if result := values[label]; result != "" {
		return result
	}
	return "baru"
}

func stableDistance(userID string) float64 {
	sum := md5.Sum([]byte(userID))
	raw := int(sum[0])<<8 | int(sum[1])
	return math.Round((0.8+float64(raw%540)/100)*10) / 10
}

func cleanAvatar(value string) string {
	for _, host := range []string{"pravatar", "randomuser.me", "unsplash"} {
		if strings.Contains(value, host) {
			return ""
		}
	}
	return value
}

func primaryProfilePhoto(profile database.Profile) string {
	for _, photoURL := range profile.PhotoURLs {
		if strings.TrimSpace(photoURL) != "" {
			return strings.TrimSpace(photoURL)
		}
	}
	return strings.TrimSpace(profile.PhotoURL)
}

func primaryJobPhoto(job database.Job) string {
	for _, photoURL := range job.PhotoURLs {
		if strings.TrimSpace(photoURL) != "" {
			return strings.TrimSpace(photoURL)
		}
	}
	return ""
}
