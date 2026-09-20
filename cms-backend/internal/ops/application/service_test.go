package application

import (
	"context"
	"testing"
	"time"

	"kerjo/cms-backend/internal/ops/domain"
)

type fakeRepository struct {
	admin       domain.Admin
	sessionHash string
	cleanup     domain.CleanupPreview
}

func (f *fakeRepository) CreateAdmin(_ context.Context, email, hash, role string) (domain.Admin, error) {
	f.admin = domain.Admin{ID: 1, Email: email, PasswordHash: hash, Role: role}
	return f.admin, nil
}
func (f *fakeRepository) ListAdmins(context.Context) ([]domain.Admin, error) {
	return []domain.Admin{f.admin}, nil
}
func (f *fakeRepository) AdminByEmail(context.Context, string) (domain.Admin, error) {
	return f.admin, nil
}
func (f *fakeRepository) SetAdminDisabled(context.Context, int64, bool) error   { return nil }
func (f *fakeRepository) SetAdminPassword(context.Context, int64, string) error { return nil }
func (f *fakeRepository) CreateSession(_ context.Context, _ int64, hash string, _ time.Time, _ string) error {
	f.sessionHash = hash
	return nil
}
func (f *fakeRepository) SessionByHash(context.Context, string, time.Time) (domain.Admin, error) {
	return f.admin, nil
}
func (f *fakeRepository) DeleteSession(context.Context, string) error      { return nil }
func (f *fakeRepository) DeleteAdminSessions(context.Context, int64) error { return nil }
func (f *fakeRepository) Audit(context.Context, int64, string, string, string, map[string]any, string) error {
	return nil
}
func (f *fakeRepository) Dashboard(context.Context) (map[string]any, error) {
	return map[string]any{}, nil
}
func (f *fakeRepository) List(context.Context, string, map[string]string, int, int) (domain.ListResult, error) {
	return domain.ListResult{}, nil
}
func (f *fakeRepository) Detail(context.Context, string, string) (map[string]any, error) {
	return map[string]any{}, nil
}
func (f *fakeRepository) SetVerification(context.Context, string, string, string, int64, string) error {
	return nil
}
func (f *fakeRepository) SuspendUser(context.Context, string, bool, string) error { return nil }
func (f *fakeRepository) RevokeUserSessions(context.Context, string) error        { return nil }
func (f *fakeRepository) SetHidden(context.Context, string, string, bool, string) error {
	return nil
}
func (f *fakeRepository) CleanupPreview(context.Context, string) (domain.CleanupPreview, error) {
	return f.cleanup, nil
}
func (f *fakeRepository) Cleanup(context.Context, string) error { return nil }

func TestCreateAdminAndLoginHashesSecrets(t *testing.T) {
	repo := &fakeRepository{}
	service := New(repo, time.Hour)
	admin, err := service.CreateAdmin(context.Background(), "ADMIN@Example.com ", "long-secure-password", domain.RoleSuperadmin)
	if err != nil {
		t.Fatal(err)
	}
	if admin.Email != "admin@example.com" || admin.PasswordHash == "long-secure-password" {
		t.Fatalf("admin was not normalized or password was not hashed: %#v", admin)
	}
	_, token, _, err := service.Login(context.Background(), admin.Email, "long-secure-password", "127.0.0.1")
	if err != nil || token == "" || repo.sessionHash == token {
		t.Fatalf("login did not issue a hashed session: token=%q err=%v", token, err)
	}
}

func TestRoleAndTypedCleanupEnforcement(t *testing.T) {
	repo := &fakeRepository{cleanup: domain.CleanupPreview{Scope: "global", Confirmation: "DELETE ALL HISTORY"}}
	service := New(repo, time.Hour)
	if err := service.Moderate(context.Background(), domain.Admin{Role: domain.RoleReviewer}, "jobs", "j1", "hide", "reason", ""); err != domain.ErrForbidden {
		t.Fatalf("reviewer moderation error = %v", err)
	}
	superadmin := domain.Admin{Role: domain.RoleSuperadmin}
	if err := service.Cleanup(context.Background(), superadmin, "", "wrong", "maintenance", ""); err != domain.ErrInvalidInput {
		t.Fatalf("incorrect confirmation error = %v", err)
	}
	if err := service.Cleanup(context.Background(), superadmin, "", "DELETE ALL HISTORY", "maintenance", ""); err != nil {
		t.Fatal(err)
	}
}
