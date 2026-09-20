package application

import (
	"context"
	"time"

	"kerjo/cms-backend/internal/ops/domain"
)

// Repository is the outbound port used by CMS administration use cases.
// Infrastructure adapters implement this interface; application code never
// depends on GORM, PostgreSQL, HTTP, or filesystem details.
type Repository interface {
	CreateAdmin(context.Context, string, string, string) (domain.Admin, error)
	ListAdmins(context.Context) ([]domain.Admin, error)
	AdminByEmail(context.Context, string) (domain.Admin, error)
	SetAdminDisabled(context.Context, int64, bool) error
	SetAdminPassword(context.Context, int64, string) error
	CreateSession(context.Context, int64, string, time.Time, string) error
	SessionByHash(context.Context, string, time.Time) (domain.Admin, error)
	DeleteSession(context.Context, string) error
	DeleteAdminSessions(context.Context, int64) error
	Audit(context.Context, int64, string, string, string, map[string]any, string) error
	Dashboard(context.Context) (map[string]any, error)
	List(context.Context, string, map[string]string, int, int) (domain.ListResult, error)
	Detail(context.Context, string, string) (map[string]any, error)
	SetVerification(context.Context, string, string, string, int64, string) error
	SuspendUser(context.Context, string, bool, string) error
	RevokeUserSessions(context.Context, string) error
	SetHidden(context.Context, string, string, bool, string) error
	CleanupPreview(context.Context, string) (domain.CleanupPreview, error)
	Cleanup(context.Context, string) error
}

// Service is the application facade consumed by the HTTP adapter and admin CLI.
type Service struct {
	repo       Repository
	sessionTTL time.Duration
	now        func() time.Time
}

func New(repo Repository, sessionTTL time.Duration) *Service {
	return &Service{
		repo:       repo,
		sessionTTL: sessionTTL,
		now:        func() time.Time { return time.Now().UTC() },
	}
}
