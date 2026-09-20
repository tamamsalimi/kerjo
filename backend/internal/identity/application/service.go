package application

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"kerjo/backend/internal/identity/domain"
)

type Repository interface {
	UpsertGoogleUser(context.Context, GoogleClaims) (domain.User, error)
	CreateSession(context.Context, string, string, time.Time, time.Time) error
	UserByTokenHash(context.Context, string, time.Time) (domain.User, error)
	DeleteSession(context.Context, string) error
	HasProfile(context.Context, string) (bool, error)
	VerificationStatus(context.Context, string) (string, error)
	TouchLastSeen(context.Context, string, time.Time) error
}

type GoogleClaims struct {
	Subject string
	Email   string
	Name    string
	Picture string
}

type UserState struct {
	User               domain.User
	HasProfile         bool
	VerificationStatus string
}

type LoginResult struct {
	Token string
	State UserState
}

type Service struct {
	repository Repository
	now        func() time.Time
}

func New(repository Repository) *Service {
	return &Service{repository: repository, now: func() time.Time { return time.Now().UTC() }}
}

func (s *Service) LoginGoogle(ctx context.Context, claims GoogleClaims) (LoginResult, error) {
	claims.Subject = strings.TrimSpace(claims.Subject)
	claims.Email = strings.ToLower(strings.TrimSpace(claims.Email))
	claims.Name = strings.TrimSpace(claims.Name)
	if claims.Subject == "" || claims.Email == "" {
		return LoginResult{}, fmt.Errorf("google subject and email are required")
	}
	if claims.Name == "" {
		claims.Name = strings.Split(claims.Email, "@")[0]
	}
	user, err := s.repository.UpsertGoogleUser(ctx, claims)
	if err != nil {
		return LoginResult{}, err
	}
	token, err := secureToken()
	if err != nil {
		return LoginResult{}, err
	}
	now := s.now()
	if err := s.repository.CreateSession(ctx, hashToken(token), user.ID, now, now.Add(7*24*time.Hour)); err != nil {
		return LoginResult{}, err
	}
	state, err := s.state(ctx, user)
	if err != nil {
		return LoginResult{}, err
	}
	return LoginResult{Token: token, State: state}, nil
}

func (s *Service) Authenticate(ctx context.Context, rawToken string) (domain.User, error) {
	if strings.TrimSpace(rawToken) == "" {
		return domain.User{}, domain.ErrNotAuthenticated
	}
	user, err := s.repository.UserByTokenHash(ctx, hashToken(rawToken), s.now())
	if err != nil {
		return domain.User{}, err
	}
	now := s.now()
	if err := s.repository.TouchLastSeen(ctx, user.ID, now); err != nil {
		return domain.User{}, err
	}
	user.LastSeen = &now
	return user, nil
}

func (s *Service) Me(ctx context.Context, user domain.User) (UserState, error) {
	return s.state(ctx, user)
}

func (s *Service) Logout(ctx context.Context, rawToken string) error {
	if rawToken == "" {
		return nil
	}
	return s.repository.DeleteSession(ctx, hashToken(rawToken))
}

func (s *Service) state(ctx context.Context, user domain.User) (UserState, error) {
	hasProfile, err := s.repository.HasProfile(ctx, user.ID)
	if err != nil {
		return UserState{}, err
	}
	verificationStatus, err := s.repository.VerificationStatus(ctx, user.ID)
	if err != nil {
		return UserState{}, err
	}
	return UserState{User: user, HasProfile: hasProfile, VerificationStatus: verificationStatus}, nil
}

func secureToken() (string, error) {
	data := make([]byte, 32)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
