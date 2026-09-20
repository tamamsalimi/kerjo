package application

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"kerjo/cms-backend/internal/ops/domain"
)

func (s *Service) CreateAdmin(ctx context.Context, email, password, role string) (domain.Admin, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if !strings.Contains(email, "@") || len(password) < 12 || !domain.ValidRole(role) {
		return domain.Admin{}, domain.ErrInvalidInput
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return domain.Admin{}, err
	}
	return s.repo.CreateAdmin(ctx, email, string(hash), role)
}

func (s *Service) ListAdmins(ctx context.Context) ([]domain.Admin, error) {
	return s.repo.ListAdmins(ctx)
}

func (s *Service) DisableAdmin(ctx context.Context, id int64, disabled bool) error {
	if err := s.repo.SetAdminDisabled(ctx, id, disabled); err != nil {
		return err
	}
	if disabled {
		return s.repo.DeleteAdminSessions(ctx, id)
	}
	return nil
}

func (s *Service) ResetPassword(ctx context.Context, id int64, password string) error {
	if len(password) < 12 {
		return domain.ErrInvalidInput
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if err := s.repo.SetAdminPassword(ctx, id, string(hash)); err != nil {
		return err
	}
	return s.repo.DeleteAdminSessions(ctx, id)
}

func (s *Service) Login(ctx context.Context, email, password, ip string) (domain.Admin, string, time.Time, error) {
	admin, err := s.repo.AdminByEmail(ctx, strings.ToLower(strings.TrimSpace(email)))
	if err != nil || admin.DisabledAt != nil ||
		bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(password)) != nil {
		if admin.PasswordHash == "" {
			_ = bcrypt.CompareHashAndPassword(
				[]byte("$2a$10$7EqJtq98hPqEX7fNZaFWoO5x5M/oW4Yh0WzFiMzBYoSrrGmL6VZy."),
				[]byte(password),
			)
		}
		return domain.Admin{}, "", time.Time{}, domain.ErrUnauthorized
	}
	token, err := randomToken()
	if err != nil {
		return domain.Admin{}, "", time.Time{}, err
	}
	expires := s.now().Add(s.sessionTTL)
	if err := s.repo.CreateSession(ctx, admin.ID, hashToken(token), expires, ip); err != nil {
		return domain.Admin{}, "", time.Time{}, err
	}
	if err := s.repo.Audit(ctx, admin.ID, "auth.login", "admin", strconv.FormatInt(admin.ID, 10), nil, ip); err != nil {
		_ = s.repo.DeleteSession(ctx, hashToken(token))
		return domain.Admin{}, "", time.Time{}, err
	}
	return admin, token, expires, nil
}

func (s *Service) Authenticate(ctx context.Context, token string) (domain.Admin, error) {
	if token == "" {
		return domain.Admin{}, domain.ErrUnauthorized
	}
	return s.repo.SessionByHash(ctx, hashToken(token), s.now())
}

func (s *Service) Logout(ctx context.Context, admin domain.Admin, token, ip string) error {
	if err := s.repo.DeleteSession(ctx, hashToken(token)); err != nil {
		return err
	}
	return s.repo.Audit(ctx, admin.ID, "auth.logout", "admin", strconv.FormatInt(admin.ID, 10), nil, ip)
}

func randomToken() (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
