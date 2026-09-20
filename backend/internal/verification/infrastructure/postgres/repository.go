package postgres

import (
	"context"
	"errors"
	"strings"
	"time"

	"kerjo/backend/internal/platform/database"
	"kerjo/backend/internal/verification/domain"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Get(ctx context.Context, userID string) (domain.Verification, error) {
	var model database.UserVerification
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&model).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.Verification{UserID: userID, Status: domain.StatusUnverified}, nil
	}
	return toDomain(model), err
}

func (r *Repository) Submit(
	ctx context.Context,
	userID string,
	input domain.Submission,
	now time.Time,
) (domain.Verification, error) {
	err := r.db.WithContext(ctx).Model(&database.UserVerification{}).
		Where("user_id = ?", userID).
		Updates(map[string]any{
			"phone": input.Phone, "nik": input.NIK, "status": domain.StatusPending,
			"rejection_reason": "", "submitted_at": now, "reviewed_at": nil,
			"verified_at": nil, "updated_at": now,
		}).Error
	if err != nil {
		if strings.Contains(err.Error(), "user_verifications_nik_unique") {
			return domain.Verification{}, domain.ErrInvalidInput
		}
		return domain.Verification{}, err
	}
	return r.Get(ctx, userID)
}

func (r *Repository) SaveDocument(
	ctx context.Context,
	userID, kind, objectPath string,
	now time.Time,
) error {
	model := database.UserVerification{
		UserID: userID, Status: string(domain.StatusUnverified), CreatedAt: now, UpdatedAt: now,
	}
	column := "ktp_photo_path"
	if kind == "face" {
		column = "face_photo_path"
		model.FacePhotoPath = objectPath
	} else {
		model.KTPPhotoPath = objectPath
	}
	err := r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.Assignments(map[string]any{
			column: objectPath, "status": domain.StatusUnverified,
			"rejection_reason": "", "submitted_at": nil, "reviewed_at": nil,
			"verified_at": nil, "updated_at": now,
		}),
	}).Create(&model).Error
	return err
}

func toDomain(model database.UserVerification) domain.Verification {
	return domain.Verification{
		UserID: model.UserID, Phone: model.Phone, NIK: model.NIK,
		KTPPhotoPath: model.KTPPhotoPath, FacePhotoPath: model.FacePhotoPath,
		Status: domain.Status(model.Status), RejectionReason: model.RejectionReason,
		SubmittedAt: model.SubmittedAt, ReviewedAt: model.ReviewedAt, VerifiedAt: model.VerifiedAt,
		CreatedAt: model.CreatedAt, UpdatedAt: model.UpdatedAt,
	}
}
