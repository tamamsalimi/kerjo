package application

import (
	"context"

	"kerjo/cms-backend/internal/ops/domain"
)

func (s *Service) Audit(
	ctx context.Context,
	admin domain.Admin,
	action, targetType, targetID string,
	metadata map[string]any,
	ip string,
) error {
	return s.repo.Audit(ctx, admin.ID, action, targetType, targetID, metadata, ip)
}

func (s *Service) Dashboard(ctx context.Context) (map[string]any, error) {
	return s.repo.Dashboard(ctx)
}

func (s *Service) List(
	ctx context.Context,
	kind string,
	filters map[string]string,
	limit, offset int,
) (domain.ListResult, error) {
	if limit < 1 || limit > 100 {
		limit = 25
	}
	if offset < 0 {
		offset = 0
	}
	return s.repo.List(ctx, kind, filters, limit, offset)
}

func (s *Service) Detail(ctx context.Context, kind, id string) (map[string]any, error) {
	return s.repo.Detail(ctx, kind, id)
}
