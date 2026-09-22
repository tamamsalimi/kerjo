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
	OwnedJob(context.Context, string, string) (domain.Job, error)
	Worker(context.Context, string) (domain.Worker, error)
	CreateJob(context.Context, string, domain.JobInput) (domain.Job, error)
	UpdateJob(context.Context, string, string, domain.JobInput) (domain.Job, error)
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
	profile.LastEducation = strings.TrimSpace(profile.LastEducation)
	profile.Phone = strings.TrimSpace(profile.Phone)
	profile.AllowDirectCall = profile.AllowDirectCall && profile.Phone != ""
	if profile.Name == "" || profile.Category == "" {
		return domain.Profile{}, ErrInvalidInput
	}
	employerType, valid := normalizeEmployerType(profile.EmployerType)
	if !valid {
		return domain.Profile{}, ErrInvalidInput
	}
	profile.EmployerType = employerType
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

func (s *Service) BrowseAccess(ctx context.Context, userID string) (domain.BrowseAccess, error) {
	profile, err := s.repository.Profile(ctx, userID)
	if err != nil {
		return domain.BrowseAccess{}, err
	}
	categories, err := s.repository.ActiveJobCategories(ctx, userID)
	if err != nil {
		return domain.BrowseAccess{}, err
	}
	return domain.BrowseAccess{
		CanBrowseJobs:    profileComplete(profile),
		CanBrowseWorkers: len(categories) > 0,
	}, nil
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

func (s *Service) OwnedJob(ctx context.Context, ownerUserID, id string) (domain.Job, error) {
	return s.repository.OwnedJob(ctx, ownerUserID, id)
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
	if strings.TrimSpace(input.Phone) == "" {
		profile, err := s.repository.Profile(ctx, ownerUserID)
		if err != nil {
			return domain.Job{}, err
		}
		if profile != nil && profile.AllowDirectCall && strings.TrimSpace(profile.Phone) != "" {
			input.Phone = profile.Phone
			input.AllowDirectCall = true
		}
	}
	input, err := normalizeJobInput(input)
	if err != nil {
		return domain.Job{}, err
	}
	if input.PhotoURLs == nil {
		input.PhotoURLs = []string{}
	}
	return s.repository.CreateJob(ctx, ownerUserID, input)
}

func (s *Service) UpdateJob(
	ctx context.Context,
	ownerUserID, jobID string,
	input domain.JobInput,
) (domain.Job, error) {
	if strings.TrimSpace(jobID) == "" {
		return domain.Job{}, ErrInvalidInput
	}
	input, err := normalizeJobInput(input)
	if err != nil {
		return domain.Job{}, err
	}
	return s.repository.UpdateJob(ctx, ownerUserID, jobID, input)
}

func normalizeJobInput(input domain.JobInput) (domain.JobInput, error) {
	input.Business = strings.TrimSpace(input.Business)
	input.Title = strings.TrimSpace(input.Title)
	input.Category = strings.TrimSpace(input.Category)
	input.Phone = strings.TrimSpace(input.Phone)
	input.AllowDirectCall = input.AllowDirectCall && input.Phone != ""
	if input.Business == "" || input.Title == "" || input.Category == "" {
		return domain.JobInput{}, ErrInvalidInput
	}
	employerType, valid := normalizeEmployerType(input.EmployerType)
	if !valid {
		return domain.JobInput{}, ErrInvalidInput
	}
	input.EmployerType = employerType
	if !validCoordinates(input.Latitude, input.Longitude) {
		return domain.JobInput{}, ErrInvalidInput
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
	input.MinExperienceLabel = strings.TrimPrefix(strings.TrimSpace(input.MinExperienceLabel), "Min. ")
	if input.MinExperienceLabel == "" {
		input.MinExperienceLabel = "Tidak wajib"
	}
	if input.WorkersNeeded < 1 {
		input.WorkersNeeded = 1
	}
	if input.ScreeningQuestions == nil {
		input.ScreeningQuestions = []string{}
	}
	if input.PhotoURLs != nil {
		input.PhotoURLs = cleanPhotoURLs(input.PhotoURLs)
	}
	if len(input.PhotoURLs) > 5 {
		return domain.JobInput{}, ErrInvalidInput
	}
	return input, nil
}

func normalizeEmployerType(value string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "pribadi":
		return "pribadi", true
	case "usaha_perusahaan", "usaha/perusahaan", "usaha", "perusahaan", "agency", "agensi":
		return "usaha_perusahaan", true
	default:
		return "", false
	}
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
	if values == nil {
		return nil
	}
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
	return cleanCategoryList(append(append([]string{}, relevant...), selected...))
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
