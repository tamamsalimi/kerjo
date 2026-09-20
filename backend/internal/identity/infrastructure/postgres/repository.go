package postgres

import (
	"context"
	"errors"
	"time"

	"kerjo/backend/internal/identity/application"
	"kerjo/backend/internal/identity/domain"
	"kerjo/backend/internal/platform/database"
	"kerjo/backend/internal/platform/id"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) UpsertGoogleUser(ctx context.Context, claims application.GoogleClaims) (domain.User, error) {
	var result database.User
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		query := tx.Where("google_sub = ?", claims.Subject).First(&result)
		if errors.Is(query.Error, gorm.ErrRecordNotFound) {
			query = tx.Where("email = ?", claims.Email).First(&result)
		}
		if errors.Is(query.Error, gorm.ErrRecordNotFound) {
			subject := claims.Subject
			result = database.User{
				ID:        id.New("user_", 12),
				Email:     claims.Email,
				GoogleSub: &subject,
				Name:      claims.Name,
				Picture:   claims.Picture,
			}
			create := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "email"}},
				DoNothing: true,
			}).Create(&result)
			if create.Error != nil {
				return create.Error
			}
			if create.RowsAffected == 0 {
				if err := tx.Where("email = ?", claims.Email).First(&result).Error; err != nil {
					return err
				}
				return tx.Model(&result).Updates(map[string]any{
					"google_sub": subject, "name": claims.Name, "picture": claims.Picture,
					"updated_at": time.Now().UTC(),
				}).Error
			}
			return nil
		}
		if query.Error != nil {
			return query.Error
		}
		if result.SuspendedAt != nil {
			return domain.ErrNotAuthenticated
		}
		subject := claims.Subject
		return tx.Model(&result).Updates(map[string]any{
			"google_sub": subject,
			"email":      claims.Email,
			"name":       claims.Name,
			"picture":    claims.Picture,
			"updated_at": time.Now().UTC(),
		}).Error
	})
	return toDomainUser(result), err
}

func (r *Repository) CreateSession(ctx context.Context, tokenHash, userID string, createdAt, expiresAt time.Time) error {
	return r.db.WithContext(ctx).Create(&database.UserSession{
		TokenHash: tokenHash,
		UserID:    userID,
		CreatedAt: createdAt,
		ExpiresAt: expiresAt,
	}).Error
}

func (r *Repository) UserByTokenHash(ctx context.Context, tokenHash string, now time.Time) (domain.User, error) {
	var user database.User
	err := r.db.WithContext(ctx).
		Table("users").
		Select("users.*").
		Joins("JOIN user_sessions ON user_sessions.user_id = users.user_id").
		Where("user_sessions.token_hash = ? AND user_sessions.expires_at > ? AND users.suspended_at IS NULL", tokenHash, now).
		First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.User{}, domain.ErrInvalidSession
	}
	return toDomainUser(user), err
}

func (r *Repository) DeleteSession(ctx context.Context, tokenHash string) error {
	return r.db.WithContext(ctx).Where("token_hash = ?", tokenHash).Delete(&database.UserSession{}).Error
}

func (r *Repository) HasProfile(ctx context.Context, userID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&database.Profile{}).Where("user_id = ?", userID).Count(&count).Error
	return count > 0, err
}

func (r *Repository) VerificationStatus(ctx context.Context, userID string) (string, error) {
	var verification database.UserVerification
	err := r.db.WithContext(ctx).Select("status").Where("user_id = ?", userID).First(&verification).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "unverified", nil
	}
	return verification.Status, err
}

func (r *Repository) TouchLastSeen(ctx context.Context, userID string, now time.Time) error {
	return r.db.WithContext(ctx).Model(&database.User{}).Where("user_id = ?", userID).
		Updates(map[string]any{"last_seen": now, "updated_at": now}).Error
}

func toDomainUser(user database.User) domain.User {
	subject := ""
	if user.GoogleSub != nil {
		subject = *user.GoogleSub
	}
	return domain.User{
		ID:        user.ID,
		Email:     user.Email,
		GoogleSub: subject,
		Name:      user.Name,
		Picture:   user.Picture,
		LastSeen:  user.LastSeen,
		CreatedAt: user.CreatedAt,
	}
}
