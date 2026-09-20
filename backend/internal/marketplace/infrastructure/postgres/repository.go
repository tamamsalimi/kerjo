package postgres

import (
	"context"
	"crypto/md5"
	"errors"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"kerjo/backend/internal/marketplace/application"
	"kerjo/backend/internal/marketplace/domain"
	"kerjo/backend/internal/platform/database"
	"kerjo/backend/internal/platform/id"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Profile(ctx context.Context, userID string) (*domain.Profile, error) {
	var model database.Profile
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&model).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	result := toProfile(model)
	return &result, nil
}

func (r *Repository) SaveProfile(ctx context.Context, profile domain.Profile) (domain.Profile, error) {
	model := database.Profile{
		UserID:          profile.UserID,
		Name:            profile.Name,
		Category:        profile.Category,
		ExperienceLabel: profile.ExperienceLabel,
		Availability:    profile.Availability,
		Bio:             profile.Bio,
		Rate:            profile.Rate,
		Phone:           profile.Phone,
		PhotoURL:        profile.PhotoURL,
		PhotoURLs:       profile.PhotoURLs,
		Latitude:        profile.Latitude,
		Longitude:       profile.Longitude,
	}
	updateColumns := []string{
		"name", "category", "experience_label", "availability", "bio",
		"rate", "phone", "photo_url", "photo_urls", "updated_at",
	}
	if profile.Latitude != nil && profile.Longitude != nil {
		updateColumns = append(updateColumns, "latitude", "longitude")
	}
	err := r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns(updateColumns),
	}).Create(&model).Error
	if err != nil {
		return domain.Profile{}, err
	}
	return toProfile(model), nil
}

func (r *Repository) ListJobs(ctx context.Context, userID string, filters domain.Filters) ([]domain.Job, error) {
	query := r.db.WithContext(ctx).Model(&database.Job{}).
		Where("jobs.deleted_at IS NULL AND jobs.hidden_at IS NULL").
		Where("(jobs.owner_user_id IS NULL OR jobs.owner_user_id <> ?)", userID).
		Where(`NOT EXISTS (
			SELECT 1 FROM swipes
			WHERE swipes.swiper_user_id = ? AND swipes.target_type = 'job' AND swipes.target_id = jobs.id
		)`, userID).
		Where(`(
			SELECT COUNT(*) FROM matches
			WHERE matches.kind = 'real' AND matches.job_id = jobs.id
		) < jobs.workers_needed`)
	query = applyJobFilters(query, filters)
	var models []database.Job
	if err := query.Order("jobs.created_at DESC, jobs.id").Find(&models).Error; err != nil {
		return nil, err
	}
	result := make([]domain.Job, 0, len(models))
	for _, model := range models {
		card := toJob(model)
		card.DistanceKM = viewerDistance(filters, model.Latitude, model.Longitude, card.DistanceKM)
		if matchesFilters(
			card.Category, card.JobType, card.DistanceKM, card.PayAmount,
			card.ExperienceBucket, experienceLabelYears(card.MinExperienceLabel), filters,
		) {
			result = append(result, card)
		}
	}
	sortJobsByCategory(result, filters.RelevantCategories)
	return result, nil
}

func (r *Repository) ListWorkers(ctx context.Context, userID string, filters domain.Filters) ([]domain.Worker, error) {
	var swipes []database.Swipe
	if err := r.db.WithContext(ctx).Where("swiper_user_id = ? AND target_type = 'worker'", userID).Find(&swipes).Error; err != nil {
		return nil, err
	}
	swiped := map[string]bool{}
	for _, swipe := range swipes {
		swiped[swipe.TargetID] = true
	}

	var seedWorkers []database.Worker
	if err := r.db.WithContext(ctx).Where("deleted_at IS NULL").Find(&seedWorkers).Error; err != nil {
		return nil, err
	}
	result := make([]domain.Worker, 0, len(seedWorkers))
	for _, worker := range seedWorkers {
		card := toWorker(worker)
		if !swiped[card.ID] && matchesFilters(
			card.Category, "", card.DistanceKM, card.PayAmount,
			card.ExperienceBucket, float64(worker.ExperienceYears), filters,
		) {
			result = append(result, card)
		}
	}

	var profiles []database.Profile
	if err := r.db.WithContext(ctx).Where("user_id <> ?", userID).Find(&profiles).Error; err != nil {
		return nil, err
	}
	ratings, err := r.reviewStats(ctx)
	if err != nil {
		return nil, err
	}
	var approved []database.UserVerification
	if err := r.db.WithContext(ctx).Select("user_id").Where("status = ?", "approved").Find(&approved).Error; err != nil {
		return nil, err
	}
	verifiedUsers := make(map[string]bool, len(approved))
	for _, verification := range approved {
		verifiedUsers[verification.UserID] = true
	}
	for _, profile := range profiles {
		card := profileCard(profile, ratings["wp_"+profile.UserID], verifiedUsers[profile.UserID])
		card.DistanceKM = viewerDistance(filters, profile.Latitude, profile.Longitude, card.DistanceKM)
		if !swiped[card.ID] && matchesFilters(
			card.Category, "", card.DistanceKM, card.PayAmount,
			card.ExperienceBucket, experienceLabelYears(profile.ExperienceLabel), filters,
		) {
			result = append(result, card)
		}
	}
	sortWorkersByCategory(result, filters.RelevantCategories)
	return result, nil
}

func (r *Repository) Job(ctx context.Context, jobID string) (domain.Job, error) {
	var model database.Job
	err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL AND hidden_at IS NULL", jobID).First(&model).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.Job{}, application.ErrNotFound
	}
	return toJob(model), err
}

func (r *Repository) Worker(ctx context.Context, workerID string) (domain.Worker, error) {
	if strings.HasPrefix(workerID, "wp_") {
		return r.WorkerByUserID(ctx, strings.TrimPrefix(workerID, "wp_"))
	}
	var model database.Worker
	err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", workerID).First(&model).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.Worker{}, application.ErrNotFound
	}
	return toWorker(model), err
}

func (r *Repository) WorkerByUserID(ctx context.Context, userID string) (domain.Worker, error) {
	var profile database.Profile
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&profile).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.Worker{}, application.ErrNotFound
	}
	if err != nil {
		return domain.Worker{}, err
	}
	stats, err := r.reviewStatsFor(ctx, "wp_"+userID)
	if err != nil {
		return domain.Worker{}, err
	}
	var verificationCount int64
	if err := r.db.WithContext(ctx).Model(&database.UserVerification{}).
		Where("user_id = ? AND status = ?", userID, "approved").Count(&verificationCount).Error; err != nil {
		return domain.Worker{}, err
	}
	return profileCard(profile, stats, verificationCount > 0), nil
}

func (r *Repository) CreateJob(ctx context.Context, ownerUserID string, input domain.JobInput) (domain.Job, error) {
	now := time.Now().UTC()
	model := database.Job{
		ID:                 id.New("job_", 10),
		OwnerUserID:        &ownerUserID,
		Business:           input.Business,
		Title:              input.Title,
		Role:               input.Title,
		Category:           input.Category,
		PayAmount:          input.PayAmount,
		PayUnit:            input.PayUnit,
		DistanceKM:         input.DistanceKM,
		JobType:            input.JobType,
		MinExperienceLabel: "Min. " + input.MinExperienceLabel,
		ExperienceBucket:   experienceBucket(input.MinExperienceLabel),
		Description:        input.Description,
		Phone:              input.Phone,
		PhotoURLs:          []string{},
		ScreeningQuestions: input.ScreeningQuestions,
		WorkersNeeded:      input.WorkersNeeded,
		Latitude:           input.Latitude,
		Longitude:          input.Longitude,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	if err := r.db.WithContext(ctx).Create(&model).Error; err != nil {
		return domain.Job{}, err
	}
	return toJob(model), nil
}

func (r *Repository) AddJobPhoto(
	ctx context.Context,
	ownerUserID, jobID, photoURL string,
) (domain.Job, error) {
	var result database.Job
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND owner_user_id = ? AND deleted_at IS NULL", jobID, ownerUserID).
			First(&result).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return application.ErrNotFound
			}
			return err
		}
		for _, existing := range result.PhotoURLs {
			if existing == photoURL {
				return nil
			}
		}
		if len(result.PhotoURLs) >= 5 {
			return application.ErrInvalidInput
		}
		result.PhotoURLs = append(result.PhotoURLs, photoURL)
		return tx.Model(&result).Update("photo_urls", result.PhotoURLs).Error
	})
	if err != nil {
		return domain.Job{}, err
	}
	return toJob(result), nil
}

func (r *Repository) OwnedJobs(ctx context.Context, ownerID string) ([]domain.Job, error) {
	var models []database.Job
	if err := r.db.WithContext(ctx).Where("owner_user_id = ? AND deleted_at IS NULL", ownerID).Find(&models).Error; err != nil {
		return nil, err
	}
	result := make([]domain.Job, 0, len(models))
	for _, model := range models {
		result = append(result, toJob(model))
	}
	return result, nil
}

func (r *Repository) ActiveJobCategories(ctx context.Context, ownerID string) ([]string, error) {
	var categories []string
	err := r.db.WithContext(ctx).Model(&database.Job{}).
		Where("owner_user_id = ? AND deleted_at IS NULL AND hidden_at IS NULL", ownerID).
		Order("created_at DESC").
		Pluck("category", &categories).Error
	if err != nil {
		return nil, err
	}
	return uniqueCategories(categories), nil
}

func (r *Repository) Reviews(ctx context.Context, workerID string) ([]domain.Review, error) {
	var models []database.Review
	if err := r.db.WithContext(ctx).Where("worker_id = ? AND hidden_at IS NULL", workerID).Order("created_at DESC").Find(&models).Error; err != nil {
		return nil, err
	}
	result := make([]domain.Review, 0, len(models))
	for _, model := range models {
		result = append(result, domain.Review{
			ID: model.ID, WorkerID: model.WorkerID, Author: model.Author,
			Rating: model.Rating, Comment: model.Comment, Date: model.DisplayDate, CreatedAt: model.CreatedAt,
		})
	}
	return result, nil
}

type reviewStat struct {
	Rating float64
	Count  int
}

func (r *Repository) reviewStats(ctx context.Context) (map[string]reviewStat, error) {
	type row struct {
		WorkerID string
		Rating   float64
		Count    int
	}
	var rows []row
	err := r.db.WithContext(ctx).Model(&database.Review{}).
		Select("worker_id, AVG(rating) AS rating, COUNT(*) AS count").
		Where("hidden_at IS NULL").
		Group("worker_id").Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := map[string]reviewStat{}
	for _, item := range rows {
		item.Rating = math.Round(item.Rating*10) / 10
		result[item.WorkerID] = reviewStat{Rating: item.Rating, Count: item.Count}
	}
	return result, nil
}

func (r *Repository) reviewStatsFor(ctx context.Context, workerID string) (reviewStat, error) {
	all, err := r.reviewStats(ctx)
	return all[workerID], err
}

func applyJobFilters(query *gorm.DB, filters domain.Filters) *gorm.DB {
	if len(filters.Categories) > 0 {
		query = query.Where("jobs.category IN ?", filters.Categories)
	} else if filters.Category != "" && filters.Category != "Semua" {
		query = query.Where("jobs.category = ?", filters.Category)
	}
	if filters.JobType != "" && filters.JobType != "Semua" {
		query = query.Where("jobs.job_type = ?", filters.JobType)
	}
	if filters.MaxPay != nil {
		query = query.Where("jobs.pay_amount <= ?", maxPayQueryValue(*filters.MaxPay))
	}
	if filters.Experience != "" && filters.Experience != "Semua" {
		query = query.Where("jobs.experience_bucket = ?", filters.Experience)
	}
	if filters.PayBracket != "" && filters.PayBracket != "Semua" {
		switch filters.PayBracket {
		case "<100":
			query = query.Where("jobs.pay_amount < 100000")
		case "100-500":
			query = query.Where("jobs.pay_amount >= 100000 AND jobs.pay_amount < 500000")
		case "500-2jt":
			query = query.Where("jobs.pay_amount >= 500000 AND jobs.pay_amount < 2000000")
		case ">2jt":
			query = query.Where("jobs.pay_amount >= 2000000")
		}
	}
	return query
}

func maxPayQueryValue(value float64) int64 {
	return int64(math.Floor(value))
}

func sortJobsByCategory(items []domain.Job, categories []string) {
	ranks := categoryRanks(categories)
	sort.SliceStable(items, func(i, j int) bool {
		return categoryRank(items[i].Category, ranks) < categoryRank(items[j].Category, ranks)
	})
}

func sortWorkersByCategory(items []domain.Worker, categories []string) {
	ranks := categoryRanks(categories)
	sort.SliceStable(items, func(i, j int) bool {
		return categoryRank(items[i].Category, ranks) < categoryRank(items[j].Category, ranks)
	})
}

func categoryRanks(categories []string) map[string]int {
	ranks := make(map[string]int, len(categories))
	for index, category := range categories {
		key := strings.ToLower(strings.TrimSpace(category))
		if key == "" {
			continue
		}
		if _, exists := ranks[key]; !exists {
			ranks[key] = index
		}
	}
	return ranks
}

func categoryRank(category string, ranks map[string]int) int {
	if rank, ok := ranks[strings.ToLower(strings.TrimSpace(category))]; ok {
		return rank
	}
	return len(ranks)
}

func uniqueCategories(categories []string) []string {
	result := make([]string, 0, len(categories))
	seen := make(map[string]bool, len(categories))
	for _, category := range categories {
		category = strings.TrimSpace(category)
		key := strings.ToLower(category)
		if category == "" || seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, category)
	}
	return result
}

func matchesFilters(
	category, jobType string,
	distance float64,
	pay int,
	experienceBucket string,
	experienceValue float64,
	filters domain.Filters,
) bool {
	if !matchesCategoryFilter(category, filters) {
		return false
	}
	if filters.JobType != "" && filters.JobType != "Semua" && jobType != filters.JobType {
		return false
	}
	if filters.MaxDistance > 0 && distance > filters.MaxDistance {
		return false
	}
	if filters.Experience != "" && filters.Experience != "Semua" && experienceBucket != filters.Experience {
		return false
	}
	if filters.MaxPay != nil {
		if float64(pay) > *filters.MaxPay {
			return false
		}
	}
	if filters.MaxExperience != nil {
		if experienceValue > *filters.MaxExperience {
			return false
		}
	}
	switch filters.PayBracket {
	case "<100":
		return pay < 100_000
	case "100-500":
		return pay >= 100_000 && pay < 500_000
	case "500-2jt":
		return pay >= 500_000 && pay < 2_000_000
	case ">2jt":
		return pay >= 2_000_000
	default:
		return true
	}
}

func matchesCategoryFilter(category string, filters domain.Filters) bool {
	if len(filters.Categories) > 0 {
		for _, candidate := range filters.Categories {
			if category == candidate {
				return true
			}
		}
		return false
	}
	return filters.Category == "" || filters.Category == "Semua" || category == filters.Category
}

func experienceLabelYears(label string) float64 {
	var digits strings.Builder
	for _, value := range label {
		if unicode.IsDigit(value) {
			digits.WriteRune(value)
			continue
		}
		if digits.Len() > 0 {
			break
		}
	}
	years, _ := strconv.ParseFloat(digits.String(), 64)
	return years
}

func toProfile(model database.Profile) domain.Profile {
	return domain.Profile{
		UserID: model.UserID, Name: model.Name, Category: model.Category,
		ExperienceLabel: model.ExperienceLabel, Availability: model.Availability,
		Bio: model.Bio, Rate: model.Rate, Phone: model.Phone, PhotoURL: model.PhotoURL,
		PhotoURLs: model.PhotoURLs,
		Latitude:  model.Latitude, Longitude: model.Longitude, UpdatedAt: model.UpdatedAt,
	}
}

func toJob(model database.Job) domain.Job {
	return domain.Job{
		ID: model.ID, OwnerUserID: model.OwnerUserID, Business: model.Business, Title: model.Title,
		Role: model.Role, Category: model.Category, PayAmount: model.PayAmount, PayUnit: model.PayUnit,
		DistanceKM: model.DistanceKM, JobType: model.JobType, MinExperienceLabel: model.MinExperienceLabel,
		ExperienceBucket: model.ExperienceBucket, Description: model.Description, Phone: model.Phone,
		PhotoURLs:          model.PhotoURLs,
		ScreeningQuestions: model.ScreeningQuestions, WorkersNeeded: model.WorkersNeeded,
		Latitude: model.Latitude, Longitude: model.Longitude, CreatedAt: model.CreatedAt,
	}
}

func toWorker(model database.Worker) domain.Worker {
	return domain.Worker{
		ID: model.ID, Name: model.Name, Category: model.Category, Role: model.Role,
		ExperienceLabel: model.ExperienceLabel, ExperienceBucket: model.ExperienceBucket,
		DistanceKM: model.DistanceKM, PayAmount: model.PayAmount, PayUnit: model.PayUnit,
		Rating: model.Rating, JobsCompleted: model.JobsCompleted, Verified: model.Verified,
		IsNew: model.IsNew, Avatar: cleanAvatar(model.Avatar), Bio: model.Bio, IsReal: false,
	}
}

func profileCard(profile database.Profile, stats reviewStat, verified bool) domain.Worker {
	return domain.Worker{
		ID: "wp_" + profile.UserID, Name: profile.Name, Category: profile.Category, Role: profile.Category,
		ExperienceLabel: profile.ExperienceLabel, ExperienceBucket: profileExperienceBucket(profile.ExperienceLabel),
		DistanceKM: stableDistance(profile.UserID), PayAmount: parsePayAmount(profile.Rate), PayDisplay: profile.Rate,
		Rating: stats.Rating, JobsCompleted: stats.Count, Verified: verified, IsNew: stats.Count == 0,
		Avatar: cleanAvatar(profile.PhotoURL), Bio: profile.Bio, Availability: profile.Availability,
		Phone: profile.Phone, OwnerUserID: profile.UserID, IsReal: true,
	}
}

func experienceBucket(label string) string {
	values := map[string]string{"Tidak wajib": "any", "Baru": "baru", "1 tahun": "1-2", "2 tahun": "1-2", "3 tahun": "3-5", "5 tahun": "5+"}
	if result := values[label]; result != "" {
		return result
	}
	return "any"
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

func parsePayAmount(rate string) int {
	var digits strings.Builder
	for _, value := range strings.SplitN(rate, "/", 2)[0] {
		if unicode.IsDigit(value) {
			digits.WriteRune(value)
		}
	}
	amount, _ := strconv.Atoi(digits.String())
	return amount
}

func viewerDistance(filters domain.Filters, latitude, longitude *float64, fallback float64) float64 {
	if filters.Latitude == nil || filters.Longitude == nil || latitude == nil || longitude == nil {
		return fallback
	}
	const earthRadiusKM = 6371.0
	toRadians := func(value float64) float64 { return value * math.Pi / 180 }
	lat1, lat2 := toRadians(*filters.Latitude), toRadians(*latitude)
	dLat := toRadians(*latitude - *filters.Latitude)
	dLon := toRadians(*longitude - *filters.Longitude)
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1)*math.Cos(lat2)*math.Sin(dLon/2)*math.Sin(dLon/2)
	distance := earthRadiusKM * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return math.Round(distance*10) / 10
}

func cleanAvatar(value string) string {
	for _, host := range []string{"pravatar", "randomuser.me", "unsplash"} {
		if strings.Contains(value, host) {
			return ""
		}
	}
	return value
}
