package application

import (
	"context"
	"errors"

	"kerjo/backend/internal/matching/domain"
)

var (
	ErrNotFound        = errors.New("match not found")
	ErrInvalidTarget   = errors.New("invalid swipe target")
	ErrInvalidReview   = errors.New("rating must be between 1 and 5")
	ErrProfileRequired = errors.New("worker profile is required before swiping jobs")
	ErrJobRequired     = errors.New("an active job is required before swiping workers")
)

type Repository interface {
	CanSwipe(context.Context, string, string) (bool, error)
	Swipe(context.Context, string, domain.SwipeInput) (domain.SwipeResult, error)
	Undo(context.Context, string, string, string) error
	List(context.Context, string) ([]domain.MatchView, error)
	UnreadCount(context.Context, string) (int64, error)
	Applicants(context.Context, string) ([]domain.Applicant, error)
	Get(context.Context, string, string) (domain.MatchView, error)
	MarkRead(context.Context, string, string) error
	Complete(context.Context, string, string) error
	Review(context.Context, string, string, string, domain.ReviewInput) (map[string]any, error)
	ProfileHistory(context.Context, string) (domain.ProfileHistory, error)
}

type Service struct {
	repository Repository
}

func New(repository Repository) *Service {
	return &Service{repository: repository}
}

func (s *Service) Swipe(ctx context.Context, userID string, input domain.SwipeInput) (domain.SwipeResult, error) {
	if input.TargetType != "job" && input.TargetType != "worker" {
		return domain.SwipeResult{}, ErrInvalidTarget
	}
	if input.TargetID == "" || (input.Direction != "left" && input.Direction != "right") {
		return domain.SwipeResult{}, ErrInvalidTarget
	}
	if input.ScreeningAnswers == nil {
		input.ScreeningAnswers = []string{}
	}
	allowed, err := s.repository.CanSwipe(ctx, userID, input.TargetType)
	if err != nil {
		return domain.SwipeResult{}, err
	}
	if !allowed {
		if input.TargetType == "job" {
			return domain.SwipeResult{}, ErrProfileRequired
		}
		return domain.SwipeResult{}, ErrJobRequired
	}
	return s.repository.Swipe(ctx, userID, input)
}

func (s *Service) Undo(ctx context.Context, userID, targetType, targetID string) error {
	if (targetType != "job" && targetType != "worker") || targetID == "" {
		return ErrInvalidTarget
	}
	return s.repository.Undo(ctx, userID, targetType, targetID)
}

func (s *Service) List(ctx context.Context, userID string) ([]domain.MatchView, error) {
	return s.repository.List(ctx, userID)
}

func (s *Service) UnreadCount(ctx context.Context, userID string) (int64, error) {
	return s.repository.UnreadCount(ctx, userID)
}

func (s *Service) Applicants(ctx context.Context, employerID string) ([]domain.Applicant, error) {
	return s.repository.Applicants(ctx, employerID)
}

func (s *Service) Get(ctx context.Context, matchID, userID string) (domain.MatchView, error) {
	return s.repository.Get(ctx, matchID, userID)
}

func (s *Service) MarkRead(ctx context.Context, matchID, userID string) error {
	return s.repository.MarkRead(ctx, matchID, userID)
}

func (s *Service) Complete(ctx context.Context, matchID, userID string) error {
	return s.repository.Complete(ctx, matchID, userID)
}

func (s *Service) Review(ctx context.Context, matchID, userID, author string, input domain.ReviewInput) (map[string]any, error) {
	if input.Rating < 1 || input.Rating > 5 {
		return nil, ErrInvalidReview
	}
	return s.repository.Review(ctx, matchID, userID, author, input)
}

func (s *Service) ProfileHistory(ctx context.Context, userID string) (domain.ProfileHistory, error) {
	return s.repository.ProfileHistory(ctx, userID)
}
