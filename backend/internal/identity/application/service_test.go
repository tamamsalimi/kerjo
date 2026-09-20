package application

import (
	"context"
	"testing"
	"time"

	"kerjo/backend/internal/identity/domain"
)

type repositoryFake struct {
	user       domain.User
	hasProfile bool
	tokenHash  string
}

func (r *repositoryFake) UpsertGoogleUser(context.Context, GoogleClaims) (domain.User, error) {
	return r.user, nil
}
func (r *repositoryFake) CreateSession(_ context.Context, tokenHash, _ string, _, _ time.Time) error {
	r.tokenHash = tokenHash
	return nil
}
func (r *repositoryFake) UserByTokenHash(context.Context, string, time.Time) (domain.User, error) {
	return r.user, nil
}
func (r *repositoryFake) DeleteSession(context.Context, string) error      { return nil }
func (r *repositoryFake) HasProfile(context.Context, string) (bool, error) { return r.hasProfile, nil }
func (r *repositoryFake) VerificationStatus(context.Context, string) (string, error) {
	return "unverified", nil
}
func (r *repositoryFake) TouchLastSeen(context.Context, string, time.Time) error {
	return nil
}

func TestLoginHashesSessionToken(t *testing.T) {
	repository := &repositoryFake{user: domain.User{ID: "user_1", Email: "test@example.com"}}
	service := New(repository)
	result, err := service.LoginGoogle(context.Background(), GoogleClaims{Subject: "sub", Email: "test@example.com"})
	if err != nil {
		t.Fatal(err)
	}
	if result.Token == "" || repository.tokenHash == "" || repository.tokenHash == result.Token {
		t.Fatal("expected a generated token to be stored only as a hash")
	}
}

func TestMeDoesNotRequireAccountRole(t *testing.T) {
	repository := &repositoryFake{user: domain.User{ID: "user_1"}, hasProfile: true}
	service := New(repository)
	state, err := service.Me(context.Background(), repository.user)
	if err != nil {
		t.Fatal(err)
	}
	if !state.HasProfile {
		t.Fatal("expected worker profile state to be returned independently")
	}
}
