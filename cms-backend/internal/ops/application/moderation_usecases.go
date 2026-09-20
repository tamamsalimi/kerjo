package application

import (
	"context"
	"strings"

	"kerjo/cms-backend/internal/ops/domain"
)

func (s *Service) ReviewVerification(
	ctx context.Context,
	admin domain.Admin,
	userID, decision, reason, ip string,
) error {
	if !domain.ValidRole(admin.Role) {
		return domain.ErrForbidden
	}
	if decision != "approved" && decision != "rejected" ||
		decision == "rejected" && strings.TrimSpace(reason) == "" {
		return domain.ErrInvalidInput
	}
	return s.repo.SetVerification(ctx, userID, decision, strings.TrimSpace(reason), admin.ID, ip)
}

func (s *Service) Moderate(
	ctx context.Context,
	admin domain.Admin,
	kind, id, action, reason, ip string,
) error {
	if admin.Role == domain.RoleReviewer {
		return domain.ErrForbidden
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return domain.ErrInvalidInput
	}
	var err error
	switch kind {
	case "users":
		switch action {
		case "suspend":
			err = s.repo.SuspendUser(ctx, id, true, reason)
		case "reactivate":
			err = s.repo.SuspendUser(ctx, id, false, "")
		case "revoke-sessions":
			err = s.repo.RevokeUserSessions(ctx, id)
		default:
			return domain.ErrInvalidInput
		}
	case "jobs", "reviews":
		if action != "hide" && action != "restore" {
			return domain.ErrInvalidInput
		}
		err = s.repo.SetHidden(ctx, kind, id, action == "hide", reason)
	default:
		return domain.ErrInvalidInput
	}
	if err != nil {
		return err
	}
	return s.repo.Audit(
		ctx,
		admin.ID,
		kind+"."+action,
		strings.TrimSuffix(kind, "s"),
		id,
		map[string]any{"reason": reason},
		ip,
	)
}

func (s *Service) CleanupPreview(
	ctx context.Context,
	admin domain.Admin,
	userID, ip string,
) (domain.CleanupPreview, error) {
	if admin.Role != domain.RoleSuperadmin {
		return domain.CleanupPreview{}, domain.ErrForbidden
	}
	preview, err := s.repo.CleanupPreview(ctx, userID)
	if err != nil {
		return domain.CleanupPreview{}, err
	}
	if err := s.repo.Audit(
		ctx,
		admin.ID,
		"maintenance.cleanup.preview",
		"history",
		userID,
		map[string]any{"scope": preview.Scope},
		ip,
	); err != nil {
		return domain.CleanupPreview{}, err
	}
	return preview, nil
}

func (s *Service) Cleanup(
	ctx context.Context,
	admin domain.Admin,
	userID, confirmation, reason, ip string,
) error {
	if admin.Role != domain.RoleSuperadmin {
		return domain.ErrForbidden
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return domain.ErrInvalidInput
	}
	preview, err := s.repo.CleanupPreview(ctx, userID)
	if err != nil {
		return err
	}
	if confirmation != preview.Confirmation {
		return domain.ErrInvalidInput
	}
	if err := s.repo.Cleanup(ctx, userID); err != nil {
		return err
	}
	return s.repo.Audit(
		ctx,
		admin.ID,
		"maintenance.cleanup.execute",
		"history",
		userID,
		map[string]any{"scope": preview.Scope, "reason": reason},
		ip,
	)
}
