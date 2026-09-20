package application

import (
	"context"
	"testing"

	"kerjo/backend/internal/conversation/domain"
)

type repositoryFake struct {
	sent bool
}

func (r *repositoryFake) Messages(context.Context, string, string) ([]domain.Message, error) {
	return nil, nil
}
func (r *repositoryFake) Send(context.Context, string, string, string) ([]domain.Message, error) {
	r.sent = true
	return []domain.Message{}, nil
}
func (r *repositoryFake) CreateSchedule(context.Context, string, string, domain.ScheduleInput) ([]domain.Message, error) {
	return nil, nil
}
func (r *repositoryFake) RespondSchedule(context.Context, string, string, string, bool) ([]domain.Message, error) {
	return nil, nil
}

type verificationFake bool

func (v verificationFake) Approved(context.Context, string) (bool, error) {
	return bool(v), nil
}

func TestSendRequiresApprovedVerification(t *testing.T) {
	repository := &repositoryFake{}
	service := New(repository, verificationFake(false))
	_, err := service.Send(context.Background(), "match_1", "user_1", "Halo")
	if err != ErrVerificationRequired {
		t.Fatalf("error = %v", err)
	}
	if repository.sent {
		t.Fatal("message was persisted for an unverified user")
	}
}

func TestApprovedUserCanSend(t *testing.T) {
	repository := &repositoryFake{}
	service := New(repository, verificationFake(true))
	if _, err := service.Send(context.Background(), "match_1", "user_1", "Halo"); err != nil {
		t.Fatal(err)
	}
	if !repository.sent {
		t.Fatal("message was not persisted")
	}
}
