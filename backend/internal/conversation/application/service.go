package application

import (
	"context"
	"errors"
	"strings"

	"kerjo/backend/internal/conversation/domain"
	verificationdomain "kerjo/backend/internal/verification/domain"
)

var (
	ErrInvalidInput         = errors.New("invalid conversation input")
	ErrVerificationRequired = verificationdomain.ErrVerificationRequired
)

type Repository interface {
	Messages(context.Context, string, string) ([]domain.Message, error)
	Send(context.Context, string, string, string) ([]domain.Message, error)
	CreateSchedule(context.Context, string, string, domain.ScheduleInput) ([]domain.Message, error)
	RespondSchedule(context.Context, string, string, string, bool) ([]domain.Message, error)
}

type Service struct {
	repository   Repository
	verification Verification
}

type Verification interface {
	Approved(context.Context, string) (bool, error)
}

func New(repository Repository, verification Verification) *Service {
	return &Service{repository: repository, verification: verification}
}

func (s *Service) Messages(ctx context.Context, matchID, userID string) ([]domain.Message, error) {
	if err := s.requireVerified(ctx, userID); err != nil {
		return nil, err
	}
	return s.repository.Messages(ctx, matchID, userID)
}

func (s *Service) Send(ctx context.Context, matchID, userID, text string) ([]domain.Message, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, ErrInvalidInput
	}
	if err := s.requireVerified(ctx, userID); err != nil {
		return nil, err
	}
	return s.repository.Send(ctx, matchID, userID, text)
}

func (s *Service) CreateSchedule(
	ctx context.Context,
	matchID, userID string,
	input domain.ScheduleInput,
) ([]domain.Message, error) {
	if strings.TrimSpace(input.Kind) == "" || strings.TrimSpace(input.When) == "" {
		return nil, ErrInvalidInput
	}
	if err := s.requireVerified(ctx, userID); err != nil {
		return nil, err
	}
	return s.repository.CreateSchedule(ctx, matchID, userID, input)
}

func (s *Service) RespondSchedule(
	ctx context.Context,
	matchID, scheduleID, userID string,
	accept bool,
) ([]domain.Message, error) {
	if err := s.requireVerified(ctx, userID); err != nil {
		return nil, err
	}
	return s.repository.RespondSchedule(ctx, matchID, scheduleID, userID, accept)
}

func (s *Service) requireVerified(ctx context.Context, userID string) error {
	approved, err := s.verification.Approved(ctx, userID)
	if err != nil {
		return err
	}
	if !approved {
		return ErrVerificationRequired
	}
	return nil
}
