package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"kerjo/backend/internal/platform/config"
	"kerjo/backend/internal/platform/database"
	"kerjo/backend/internal/platform/logging"
	"kerjo/backend/migrations"
)

type migrator struct {
	source *mongo.Database
	target *gorm.DB
	logger *slog.Logger
	now    time.Time
}

func main() {
	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid target configuration", "error", err)
		os.Exit(1)
	}
	legacyURL := strings.TrimSpace(os.Getenv("LEGACY_DOCUMENT_DB_URL"))
	if legacyURL == "" {
		legacyURL = strings.TrimSpace(os.Getenv("DOCUMENT_DB_URL"))
	}
	if legacyURL == "" {
		slog.Error("LEGACY_DOCUMENT_DB_URL is required")
		os.Exit(1)
	}
	legacyDBName := env("LEGACY_DB_NAME", "kerjo")
	logger := logging.New(cfg.LogLevel, cfg.Environment)
	ctx := context.Background()

	sourceClient, err := mongo.Connect(ctx, options.Client().ApplyURI(legacyURL))
	if err != nil {
		logger.Error("legacy connection failed", "error", err)
		os.Exit(1)
	}
	defer sourceClient.Disconnect(context.Background())

	target, sqlDB, err := database.Open(ctx, database.Options{
		URL: cfg.DatabaseURL, MaxOpenConns: 5, MaxIdleConns: 2,
		ConnMaxLifetime: cfg.DBConnMaxLifetime, Logger: logging.NewGORM(logger),
	})
	if err != nil {
		logger.Error("target connection failed", "error", err)
		os.Exit(1)
	}
	defer sqlDB.Close()
	if err := migrations.Up(ctx, target); err != nil {
		logger.Error("target schema migration failed", "error", err)
		os.Exit(1)
	}

	m := migrator{source: sourceClient.Database(legacyDBName), target: target, logger: logger, now: time.Now().UTC()}
	if err := m.run(ctx); err != nil {
		logger.Error("legacy migration failed", "error", err)
		os.Exit(1)
	}
	logger.Info("legacy migration completed")
}

func (m *migrator) run(ctx context.Context) error {
	steps := []struct {
		name string
		run  func(context.Context) error
	}{
		{"users", m.users},
		{"sessions", m.sessions},
		{"profiles", m.profiles},
		{"jobs", m.jobs},
		{"workers", m.workers},
		{"matches", m.matches},
		{"reviews", m.reviews},
		{"swipes", m.swipes},
		{"messages", m.messages},
	}
	for _, step := range steps {
		if err := step.run(ctx); err != nil {
			return fmt.Errorf("%s: %w", step.name, err)
		}
	}
	return m.verify(ctx)
}

func (m *migrator) users(ctx context.Context) error {
	return m.each(ctx, "users", func(doc bson.M) error {
		subject := str(doc, "google_sub")
		var subjectPtr *string
		if subject != "" {
			subjectPtr = &subject
		}
		model := database.User{
			ID: str(doc, "user_id"), Email: str(doc, "email"), GoogleSub: subjectPtr,
			Name: str(doc, "name"), Picture: str(doc, "picture"),
			CreatedAt: date(doc, "created_at", m.now), UpdatedAt: m.now,
		}
		if value, ok := optionalDate(doc, "last_seen"); ok {
			model.LastSeen = &value
		}
		return upsert(m.target.WithContext(ctx), &model, "user_id")
	})
}

func (m *migrator) sessions(ctx context.Context) error {
	return m.each(ctx, "user_sessions", func(doc bson.M) error {
		token := str(doc, "session_token")
		if token == "" {
			return nil
		}
		sum := sha256.Sum256([]byte(token))
		model := database.UserSession{
			TokenHash: hex.EncodeToString(sum[:]), UserID: str(doc, "user_id"),
			CreatedAt: date(doc, "created_at", m.now), ExpiresAt: date(doc, "expires_at", m.now),
		}
		return m.target.WithContext(ctx).Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "token_hash"}},
			DoUpdates: clause.AssignmentColumns([]string{"user_id", "expires_at"}),
		}).Create(&model).Error
	})
}

func (m *migrator) profiles(ctx context.Context) error {
	return m.each(ctx, "profiles", func(doc bson.M) error {
		model := database.Profile{
			UserID: str(doc, "user_id"), Name: str(doc, "name"), Category: str(doc, "category"),
			ExperienceLabel: str(doc, "experience_label"), Availability: str(doc, "availability"),
			Bio: str(doc, "bio"), Rate: str(doc, "rate"), Phone: str(doc, "phone"),
			PhotoURL: str(doc, "photo_url"), UpdatedAt: date(doc, "updated_at", m.now),
		}
		return upsert(m.target.WithContext(ctx), &model, "user_id")
	})
}

func (m *migrator) jobs(ctx context.Context) error {
	return m.each(ctx, "jobs", func(doc bson.M) error {
		owner := str(doc, "owner_user_id")
		var ownerPtr *string
		if owner != "" {
			ownerPtr = &owner
		}
		model := database.Job{
			ID: str(doc, "id"), OwnerUserID: ownerPtr, Business: str(doc, "business"),
			Title: str(doc, "title"), Role: str(doc, "role"), Category: str(doc, "category"),
			PayAmount: integer(doc, "pay_amount"), PayUnit: str(doc, "pay_unit"),
			DistanceKM: number(doc, "distance_km"), JobType: str(doc, "job_type"),
			MinExperienceLabel: str(doc, "min_experience_label"), ExperienceBucket: str(doc, "experience_bucket"),
			Description: str(doc, "description"), Phone: str(doc, "phone"),
			ScreeningQuestions: stringsValue(doc["screening_questions"]), WorkersNeeded: integer(doc, "workers_needed"),
			CreatedAt: date(doc, "created_at", m.now), UpdatedAt: m.now,
		}
		if model.WorkersNeeded < 1 {
			model.WorkersNeeded = 1
		}
		if model.ScreeningQuestions == nil {
			model.ScreeningQuestions = []string{}
		}
		return upsert(m.target.WithContext(ctx), &model, "id")
	})
}

func (m *migrator) workers(ctx context.Context) error {
	return m.each(ctx, "workers", func(doc bson.M) error {
		model := database.Worker{
			ID: str(doc, "id"), Name: str(doc, "name"), Category: str(doc, "category"), Role: str(doc, "role"),
			ExperienceLabel: str(doc, "experience_label"), ExperienceYears: integer(doc, "experience_years"),
			ExperienceBucket: str(doc, "experience_bucket"), DistanceKM: number(doc, "distance_km"),
			PayAmount: integer(doc, "pay_amount"), PayUnit: str(doc, "pay_unit"), Rating: number(doc, "rating"),
			JobsCompleted: integer(doc, "jobs_completed"), Verified: boolean(doc, "verified"),
			IsNew: boolean(doc, "is_new"), Avatar: cleanAvatar(str(doc, "avatar")), Bio: str(doc, "bio"),
			CreatedAt: m.now, UpdatedAt: m.now,
		}
		return upsert(m.target.WithContext(ctx), &model, "id")
	})
}

func (m *migrator) matches(ctx context.Context) error {
	return m.each(ctx, "matches", func(doc bson.M) error {
		model := database.Match{
			ID: str(doc, "id"), Kind: str(doc, "kind"), EntityType: str(doc, "entity_type"),
			EntityID: str(doc, "entity_id"), Title: str(doc, "title"), Subtitle: str(doc, "subtitle"),
			Image: cleanAvatar(str(doc, "image")), Category: str(doc, "category"),
			WorkerName: str(doc, "worker_name"), WorkerCategory: str(doc, "worker_category"),
			WorkerAvatar: cleanAvatar(str(doc, "worker_avatar")), WorkerPhone: str(doc, "worker_phone"),
			JobTitle: str(doc, "job_title"), JobBusiness: str(doc, "job_business"),
			JobCategory: str(doc, "job_category"), JobPhone: str(doc, "job_phone"),
			JobDone: boolean(doc, "job_done"), Reviewed: boolean(doc, "reviewed"),
			CreatedAt: date(doc, "created_at", m.now), UpdatedAt: m.now,
		}
		model.UserID = pointer(str(doc, "user_id"))
		model.WorkerUserID = pointer(str(doc, "worker_user_id"))
		model.EmployerUserID = pointer(str(doc, "employer_user_id"))
		model.JobID = pointer(str(doc, "job_id"))
		return m.target.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			if err := upsert(tx, &model, "id"); err != nil {
				return err
			}
			participants := stringsValue(doc["participants"])
			if len(participants) == 0 && model.UserID != nil {
				participants = append(participants, *model.UserID)
			}
			if len(participants) == 0 {
				participants = append(participants, value(model.WorkerUserID), value(model.EmployerUserID))
			}
			for _, userID := range participants {
				if userID == "" {
					continue
				}
				role := ""
				if model.WorkerUserID != nil && userID == *model.WorkerUserID {
					role = "worker"
				} else if model.EmployerUserID != nil && userID == *model.EmployerUserID {
					role = "employer"
				}
				if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(
					&database.MatchParticipant{MatchID: model.ID, UserID: userID, Role: role},
				).Error; err != nil {
					return err
				}
			}
			for userID, raw := range document(doc["read_at"]) {
				if readAt, ok := anyDate(raw); ok {
					if err := upsert(tx, &database.MatchReadReceipt{MatchID: model.ID, UserID: userID, ReadAt: readAt}, "match_id", "user_id"); err != nil {
						return err
					}
				}
			}
			for _, userID := range stringsValue(doc["reviewed_by"]) {
				if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(
					&database.MatchReviewer{MatchID: model.ID, UserID: userID},
				).Error; err != nil {
					return err
				}
			}
			return nil
		})
	})
}

func (m *migrator) reviews(ctx context.Context) error {
	return m.each(ctx, "reviews", func(doc bson.M) error {
		model := database.Review{
			ID: str(doc, "id"), WorkerID: str(doc, "worker_id"), Author: str(doc, "author"),
			Rating: integer(doc, "rating"), Comment: str(doc, "comment"),
			DisplayDate: str(doc, "date"), CreatedAt: date(doc, "created_at", m.now),
		}
		return upsert(m.target.WithContext(ctx), &model, "id")
	})
}

func (m *migrator) swipes(ctx context.Context) error {
	return m.each(ctx, "swipes", func(doc bson.M) error {
		model := database.Swipe{
			SwiperUserID: str(doc, "swiper_user_id"), TargetType: str(doc, "target_type"),
			TargetID: str(doc, "target_id"), Direction: str(doc, "direction"),
			ScreeningAnswers: stringsValue(doc["screening_answers"]),
			CreatedAt:        date(doc, "created_at", m.now), UpdatedAt: date(doc, "created_at", m.now),
		}
		if model.ScreeningAnswers == nil {
			model.ScreeningAnswers = []string{}
		}
		return m.target.WithContext(ctx).Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "swiper_user_id"}, {Name: "target_type"}, {Name: "target_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"direction", "screening_answers", "updated_at"}),
		}).Create(&model).Error
	})
}

func (m *migrator) messages(ctx context.Context) error {
	return m.each(ctx, "messages", func(doc bson.M) error {
		legacyID := objectID(doc["_id"])
		message := database.Message{
			LegacyID: pointer(legacyID), MatchID: str(doc, "match_id"), Sender: str(doc, "sender"),
			Kind: str(doc, "kind"), Text: str(doc, "text"), CreatedAt: date(doc, "created_at", m.now),
		}
		return m.target.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "legacy_id"}},
				DoUpdates: clause.AssignmentColumns([]string{"match_id", "sender", "kind", "text", "created_at"}),
			}).Create(&message).Error; err != nil {
				return err
			}
			if legacyID != "" {
				if err := tx.Where("legacy_id = ?", legacyID).First(&message).Error; err != nil {
					return err
				}
			}
			schedule := document(doc["schedule"])
			if len(schedule) == 0 {
				return nil
			}
			model := database.MessageSchedule{
				ID: str(schedule, "id"), MessageID: message.ID, Kind: str(schedule, "kind"),
				WhenText: str(schedule, "when"), Note: str(schedule, "note"),
				Status: str(schedule, "status"), ProposedBy: str(schedule, "proposed_by"),
				CreatedAt: message.CreatedAt, UpdatedAt: message.CreatedAt,
			}
			return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&model).Error
		})
	})
}

func (m *migrator) each(ctx context.Context, collection string, visit func(bson.M) error) error {
	cursor, err := m.source.Collection(collection).Find(ctx, bson.M{})
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)
	count := 0
	for cursor.Next(ctx) {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			return err
		}
		if err := visit(doc); err != nil {
			return err
		}
		count++
	}
	if err := cursor.Err(); err != nil {
		return err
	}
	m.logger.Info("legacy collection migrated", "collection", collection, "documents", count)
	return nil
}

func (m *migrator) verify(ctx context.Context) error {
	mappings := map[string]any{
		"users": &database.User{}, "user_sessions": &database.UserSession{},
		"profiles": &database.Profile{}, "jobs": &database.Job{}, "workers": &database.Worker{},
		"reviews": &database.Review{}, "swipes": &database.Swipe{}, "matches": &database.Match{},
		"messages": &database.Message{},
	}
	for collection, model := range mappings {
		sourceCount, err := m.source.Collection(collection).CountDocuments(ctx, bson.M{})
		if err != nil {
			return err
		}
		var targetCount int64
		if err := m.target.WithContext(ctx).Model(model).Count(&targetCount).Error; err != nil {
			return err
		}
		if targetCount < sourceCount {
			return fmt.Errorf("%s count mismatch: source=%d target=%d", collection, sourceCount, targetCount)
		}
		m.logger.Info("migration count verified", "collection", collection, "source", sourceCount, "target", targetCount)
	}
	orphanChecks := map[string]string{
		"sessions_without_user":     `SELECT COUNT(*) FROM user_sessions s LEFT JOIN users u ON u.user_id = s.user_id WHERE u.user_id IS NULL`,
		"profiles_without_user":     `SELECT COUNT(*) FROM profiles p LEFT JOIN users u ON u.user_id = p.user_id WHERE u.user_id IS NULL`,
		"jobs_without_owner":        `SELECT COUNT(*) FROM jobs j LEFT JOIN users u ON u.user_id = j.owner_user_id WHERE j.owner_user_id IS NOT NULL AND u.user_id IS NULL`,
		"swipes_without_user":       `SELECT COUNT(*) FROM swipes s LEFT JOIN users u ON u.user_id = s.swiper_user_id WHERE u.user_id IS NULL`,
		"participants_without_user": `SELECT COUNT(*) FROM match_participants p LEFT JOIN users u ON u.user_id = p.user_id WHERE u.user_id IS NULL`,
		"participants_without_match": `SELECT COUNT(*) FROM match_participants p LEFT JOIN matches m ON m.id = p.match_id
			WHERE m.id IS NULL`,
		"messages_without_match": `SELECT COUNT(*) FROM messages msg LEFT JOIN matches m ON m.id = msg.match_id
			WHERE m.id IS NULL`,
		"schedules_without_message": `SELECT COUNT(*) FROM message_schedules s LEFT JOIN messages m ON m.id = s.message_id
			WHERE m.id IS NULL`,
	}
	for name, query := range orphanChecks {
		var count int64
		if err := m.target.WithContext(ctx).Raw(query).Scan(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			return fmt.Errorf("%s: found %d orphaned records", name, count)
		}
		m.logger.Info("migration relationship verified", "check", name, "orphans", count)
	}
	return nil
}

func upsert(db *gorm.DB, value any, columns ...string) error {
	keys := make([]clause.Column, 0, len(columns))
	for _, column := range columns {
		keys = append(keys, clause.Column{Name: column})
	}
	return db.Clauses(clause.OnConflict{Columns: keys, UpdateAll: true}).Create(value).Error
}

func str(doc bson.M, key string) string {
	value, _ := doc[key].(string)
	return value
}

func integer(doc bson.M, key string) int {
	return int(number(doc, key))
}

func number(doc bson.M, key string) float64 {
	switch value := doc[key].(type) {
	case int:
		return float64(value)
	case int32:
		return float64(value)
	case int64:
		return float64(value)
	case float32:
		return float64(value)
	case float64:
		return value
	default:
		return 0
	}
}

func boolean(doc bson.M, key string) bool {
	value, _ := doc[key].(bool)
	return value
}

func stringsValue(value any) []string {
	result := []string{}
	switch items := value.(type) {
	case primitive.A:
		for _, item := range items {
			if text, ok := item.(string); ok {
				result = append(result, text)
			}
		}
	case []any:
		for _, item := range items {
			if text, ok := item.(string); ok {
				result = append(result, text)
			}
		}
	case []string:
		result = append(result, items...)
	}
	return result
}

func document(value any) bson.M {
	switch item := value.(type) {
	case bson.M:
		return item
	case map[string]any:
		return bson.M(item)
	default:
		return bson.M{}
	}
}

func date(doc bson.M, key string, fallback time.Time) time.Time {
	if result, ok := anyDate(doc[key]); ok {
		return result
	}
	return fallback
}

func optionalDate(doc bson.M, key string) (time.Time, bool) {
	return anyDate(doc[key])
}

func anyDate(value any) (time.Time, bool) {
	switch item := value.(type) {
	case time.Time:
		return item.UTC(), true
	case primitive.DateTime:
		return item.Time().UTC(), true
	default:
		return time.Time{}, false
	}
}

func pointer(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func value(input *string) string {
	if input == nil {
		return ""
	}
	return *input
}

func objectID(value any) string {
	switch item := value.(type) {
	case primitive.ObjectID:
		return item.Hex()
	case string:
		return item
	default:
		return ""
	}
}

func cleanAvatar(value string) string {
	for _, host := range []string{"pravatar", "randomuser.me", "unsplash"} {
		if strings.Contains(value, host) {
			return ""
		}
	}
	return value
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}
