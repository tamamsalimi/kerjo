package postgres

import (
	"context"
	"errors"
	"time"

	"kerjo/backend/internal/conversation/domain"
	matchingapp "kerjo/backend/internal/matching/application"
	"kerjo/backend/internal/platform/database"
	"kerjo/backend/internal/platform/id"

	"gorm.io/gorm"
)

var autoReplies = []string{
	"Siap, boleh! Kapan kira-kira bisa ketemu?",
	"Oke noted ya 🙏 Saya tunggu kabarnya.",
	"Bisa banget. Lokasinya di mana ya?",
	"Baik, terima kasih infonya!",
	"Wah cocok nih, lanjut ya 😊",
}

type Repository struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Messages(ctx context.Context, matchID, userID string) ([]domain.Message, error) {
	if err := r.requireParticipant(r.db.WithContext(ctx), matchID, userID); err != nil {
		return nil, err
	}
	return r.list(r.db.WithContext(ctx), matchID)
}

func (r *Repository) Send(ctx context.Context, matchID, userID, text string) ([]domain.Message, error) {
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := r.requireParticipant(tx, matchID, userID); err != nil {
			return err
		}
		now := time.Now().UTC()
		if err := tx.Create(&database.Message{MatchID: matchID, Sender: userID, Text: text, CreatedAt: now}).Error; err != nil {
			return err
		}
		var match database.Match
		if err := tx.Where("id = ?", matchID).First(&match).Error; err != nil {
			return err
		}
		if match.Kind == "bot" {
			var count int64
			if err := tx.Model(&database.Message{}).Where("match_id = ? AND sender = ?", matchID, userID).Count(&count).Error; err != nil {
				return err
			}
			reply := autoReplies[int(count)%len(autoReplies)]
			return tx.Create(&database.Message{
				MatchID: matchID, Sender: "bot", Text: reply, CreatedAt: now.Add(time.Millisecond),
			}).Error
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return r.list(r.db.WithContext(ctx), matchID)
}

func (r *Repository) CreateSchedule(
	ctx context.Context,
	matchID, userID string,
	input domain.ScheduleInput,
) ([]domain.Message, error) {
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := r.requireParticipant(tx, matchID, userID); err != nil {
			return err
		}
		now := time.Now().UTC()
		message := database.Message{
			MatchID: matchID, Sender: userID, Kind: "schedule",
			Text: "Mengusulkan " + input.Kind, CreatedAt: now,
		}
		if err := tx.Create(&message).Error; err != nil {
			return err
		}
		return tx.Create(&database.MessageSchedule{
			ID: id.New("sch_", 10), MessageID: message.ID, Kind: input.Kind,
			WhenText: input.When, Note: input.Note, Status: "pending",
			ProposedBy: userID, CreatedAt: now, UpdatedAt: now,
		}).Error
	})
	if err != nil {
		return nil, err
	}
	return r.list(r.db.WithContext(ctx), matchID)
}

func (r *Repository) RespondSchedule(
	ctx context.Context,
	matchID, scheduleID, userID string,
	accept bool,
) ([]domain.Message, error) {
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := r.requireParticipant(tx, matchID, userID); err != nil {
			return err
		}
		status, verb, suffix := "declined", "menolak", "Silakan ajukan waktu lain."
		if accept {
			status, verb, suffix = "accepted", "menerima", "Sampai jumpa! 👍"
		}
		result := tx.Model(&database.MessageSchedule{}).
			Where(`id = ? AND message_id IN (SELECT id FROM messages WHERE match_id = ?)`, scheduleID, matchID).
			Updates(map[string]any{"status": status, "updated_at": time.Now().UTC()})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return matchingapp.ErrNotFound
		}
		return tx.Create(&database.Message{
			MatchID: matchID, Sender: "system",
			Text: "Jadwal " + verb + ". " + suffix, CreatedAt: time.Now().UTC(),
		}).Error
	})
	if err != nil {
		return nil, err
	}
	return r.list(r.db.WithContext(ctx), matchID)
}

func (r *Repository) requireParticipant(tx *gorm.DB, matchID, userID string) error {
	var count int64
	err := tx.Model(&database.MatchParticipant{}).
		Where("match_id = ? AND user_id = ?", matchID, userID).Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return matchingapp.ErrNotFound
	}
	return nil
}

func (r *Repository) list(tx *gorm.DB, matchID string) ([]domain.Message, error) {
	var messages []database.Message
	if err := tx.Where("match_id = ?", matchID).Order("created_at ASC, id ASC").Limit(1000).Find(&messages).Error; err != nil {
		return nil, err
	}
	ids := make([]int64, 0, len(messages))
	for _, message := range messages {
		ids = append(ids, message.ID)
	}
	schedules := map[int64]database.MessageSchedule{}
	if len(ids) > 0 {
		var models []database.MessageSchedule
		if err := tx.Where("message_id IN ?", ids).Find(&models).Error; err != nil {
			return nil, err
		}
		for _, schedule := range models {
			schedules[schedule.MessageID] = schedule
		}
	}
	result := make([]domain.Message, 0, len(messages))
	for _, message := range messages {
		item := domain.Message{
			ID: message.ID, MatchID: message.MatchID, Sender: message.Sender,
			Kind: message.Kind, Text: message.Text, CreatedAt: message.CreatedAt,
		}
		if schedule, ok := schedules[message.ID]; ok {
			item.Schedule = &domain.Schedule{
				ID: schedule.ID, Kind: schedule.Kind, When: schedule.WhenText,
				Note: schedule.Note, Status: schedule.Status, ProposedBy: schedule.ProposedBy,
			}
		}
		result = append(result, item)
	}
	return result, nil
}

func isNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
