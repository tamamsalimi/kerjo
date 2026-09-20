package application

import (
	"context"
	"errors"
	"strings"

	"kerjo/backend/internal/marketplace/domain"
)

var (
	ErrNotFound        = errors.New("marketplace entity not found")
	ErrInvalidInput    = errors.New("invalid marketplace input")
	ErrProfileRequired = errors.New("worker profile is required before browsing jobs")
	ErrJobRequired     = errors.New("an active job is required before browsing workers")
)

type Repository interface {
	Profile(context.Context, string) (*domain.Profile, error)
	SaveProfile(context.Context, domain.Profile) (domain.Profile, error)
	ListJobs(context.Context, string, domain.Filters) ([]domain.Job, error)
	ListWorkers(context.Context, string, domain.Filters) ([]domain.Worker, error)
	Job(context.Context, string) (domain.Job, error)
	Worker(context.Context, string) (domain.Worker, error)
	CreateJob(context.Context, string, domain.JobInput) (domain.Job, error)
	AddJobPhoto(context.Context, string, string, string) (domain.Job, error)
	OwnedJobs(context.Context, string) ([]domain.Job, error)
	ActiveJobCategories(context.Context, string) ([]string, error)
	WorkerByUserID(context.Context, string) (domain.Worker, error)
	Reviews(context.Context, string) ([]domain.Review, error)
}

type Service struct {
	repository Repository
}

func New(repository Repository) *Service {
	return &Service{repository: repository}
}

func (s *Service) Profile(ctx context.Context, userID string) (*domain.Profile, error) {
	return s.repository.Profile(ctx, userID)
}

func (s *Service) SaveProfile(ctx context.Context, profile domain.Profile) (domain.Profile, error) {
	profile.Name = strings.TrimSpace(profile.Name)
	profile.Category = strings.TrimSpace(profile.Category)
	if profile.Name == "" || profile.Category == "" {
		return domain.Profile{}, ErrInvalidInput
	}
	if !validCoordinates(profile.Latitude, profile.Longitude) {
		return domain.Profile{}, ErrInvalidInput
	}
	if profile.ExperienceLabel == "" {
		profile.ExperienceLabel = "Baru"
	}
	profile.PhotoURLs = cleanPhotoURLs(profile.PhotoURLs)
	if len(profile.PhotoURLs) > 5 {
		return domain.Profile{}, ErrInvalidInput
	}
	if len(profile.PhotoURLs) == 0 && strings.TrimSpace(profile.PhotoURL) != "" {
		profile.PhotoURLs = []string{strings.TrimSpace(profile.PhotoURL)}
	}
	if len(profile.PhotoURLs) > 0 {
		profile.PhotoURL = profile.PhotoURLs[0]
	} else {
		profile.PhotoURL = ""
	}
	return s.repository.SaveProfile(ctx, profile)
}

func (s *Service) Jobs(ctx context.Context, userID string, filters domain.Filters) ([]domain.Job, error) {
	profile, err := s.repository.Profile(ctx, userID)
	if err != nil {
		return nil, err
	}
	if !profileComplete(profile) {
		return nil, ErrProfileRequired
	}
	filters.RelevantCategories = preferredCategories(filters.Categories, []string{profile.Category})
	return s.repository.ListJobs(ctx, userID, filters)
}

func (s *Service) Workers(ctx context.Context, userID string, filters domain.Filters) ([]domain.Worker, error) {
	categories, err := s.repository.ActiveJobCategories(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(categories) == 0 {
		return nil, ErrJobRequired
	}
	filters.RelevantCategories = preferredCategories(filters.Categories, categories)
	return s.repository.ListWorkers(ctx, userID, filters)
}

func (s *Service) Job(ctx context.Context, id string) (domain.Job, error) {
	return s.repository.Job(ctx, id)
}

func (s *Service) Worker(ctx context.Context, id string) (domain.Worker, error) {
	worker, err := s.repository.Worker(ctx, id)
	if err != nil {
		return domain.Worker{}, err
	}
	reviews, err := s.repository.Reviews(ctx, id)
	if err != nil {
		return domain.Worker{}, err
	}
	worker.Reviews = reviews
	return worker, nil
}

func (s *Service) CreateJob(ctx context.Context, ownerUserID string, input domain.JobInput) (domain.Job, error) {
	input.Business = strings.TrimSpace(input.Business)
	input.Title = strings.TrimSpace(input.Title)
	input.Category = strings.TrimSpace(input.Category)
	if input.Business == "" || input.Title == "" || input.Category == "" {
		return domain.Job{}, ErrInvalidInput
	}
	if !validCoordinates(input.Latitude, input.Longitude) {
		return domain.Job{}, ErrInvalidInput
	}
	if input.PayUnit == "" {
		input.PayUnit = "/hari"
	}
	if input.Latitude != nil && input.Longitude != nil {
		input.DistanceKM = 0
	} else if input.DistanceKM == 0 {
		input.DistanceKM = 2
	}
	if input.JobType == "" {
		input.JobType = "Harian"
	}
	if input.MinExperienceLabel == "" {
		input.MinExperienceLabel = "Tidak wajib"
	}
	if input.WorkersNeeded < 1 {
		input.WorkersNeeded = 1
	}
	if input.ScreeningQuestions == nil {
		input.ScreeningQuestions = []string{}
	}
	return s.repository.CreateJob(ctx, ownerUserID, input)
}

func (s *Service) OwnedJobs(ctx context.Context, ownerID string) ([]domain.Job, error) {
	return s.repository.OwnedJobs(ctx, ownerID)
}

func (s *Service) AddJobPhoto(ctx context.Context, ownerID, jobID, photoURL string) (domain.Job, error) {
	photoURL = strings.TrimSpace(photoURL)
	if photoURL == "" {
		return domain.Job{}, ErrInvalidInput
	}
	return s.repository.AddJobPhoto(ctx, ownerID, jobID, photoURL)
}

func (s *Service) WorkerByUserID(ctx context.Context, userID string) (domain.Worker, error) {
	return s.repository.WorkerByUserID(ctx, userID)
}

func validCoordinates(latitude, longitude *float64) bool {
	if latitude == nil || longitude == nil {
		return latitude == nil && longitude == nil
	}
	return *latitude >= -90 && *latitude <= 90 && *longitude >= -180 && *longitude <= 180
}

func cleanPhotoURLs(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]bool, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
}

func profileComplete(profile *domain.Profile) bool {
	return profile != nil &&
		strings.TrimSpace(profile.Name) != "" &&
		strings.TrimSpace(profile.Category) != "" &&
		(strings.TrimSpace(profile.PhotoURL) != "" || len(cleanPhotoURLs(profile.PhotoURLs)) > 0)
}

func preferredCategories(selected, relevant []string) []string {
	if len(selected) > 0 {
		return cleanCategoryList(selected)
	}
	return cleanCategoryList(relevant)
}

func cleanCategoryList(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]bool, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		key := strings.ToLower(value)
		if value == "" || seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, value)
	}
	return result
}
