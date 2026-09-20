package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"kerjo/cms-backend/internal/ops/domain"
	"kerjo/cms-backend/internal/platform/database"
)

type Repository struct{ db *gorm.DB }

func New(db *gorm.DB) *Repository { return &Repository{db: db} }

func (r *Repository) CreateAdmin(ctx context.Context, email, hash, role string) (domain.Admin, error) {
	model := database.AdminUser{Email: email, PasswordHash: hash, Role: role}
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&model).Error; err != nil {
			return err
		}
		return tx.Exec(`INSERT INTO admin_audit_logs(action,target_type,target_id,metadata)
			VALUES ('admin.create','admin',?,'{"source":"cms-admin"}'::jsonb)`, fmt.Sprint(model.ID)).Error
	})
	return adminDomain(model), err
}

func (r *Repository) ListAdmins(ctx context.Context) ([]domain.Admin, error) {
	var models []database.AdminUser
	if err := r.db.WithContext(ctx).Order("created_at ASC").Find(&models).Error; err != nil {
		return nil, err
	}
	result := make([]domain.Admin, 0, len(models))
	for _, model := range models {
		result = append(result, adminDomain(model))
	}
	if err := r.db.WithContext(ctx).Exec(`INSERT INTO admin_audit_logs(action,target_type,metadata)
		VALUES ('admin.list','admin','{"source":"cms-admin"}'::jsonb)`).Error; err != nil {
		return nil, err
	}
	return result, nil
}

func (r *Repository) AdminByEmail(ctx context.Context, email string) (domain.Admin, error) {
	var model database.AdminUser
	err := r.db.WithContext(ctx).Where("email = ?", email).First(&model).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.Admin{}, domain.ErrUnauthorized
	}
	return adminDomain(model), err
}

func (r *Repository) SetAdminDisabled(ctx context.Context, id int64, disabled bool) error {
	var value any
	if disabled {
		value = time.Now().UTC()
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := affected(tx.Model(&database.AdminUser{}).Where("id = ?", id).
			Updates(map[string]any{"disabled_at": value, "updated_at": time.Now().UTC()})); err != nil {
			return err
		}
		action := "admin.enable"
		if disabled {
			action = "admin.disable"
		}
		return tx.Exec(`INSERT INTO admin_audit_logs(action,target_type,target_id,metadata)
			VALUES (?,'admin',?,'{"source":"cms-admin"}'::jsonb)`, action, fmt.Sprint(id)).Error
	})
}

func (r *Repository) SetAdminPassword(ctx context.Context, id int64, hash string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := affected(tx.Model(&database.AdminUser{}).Where("id = ?", id).
			Updates(map[string]any{"password_hash": hash, "updated_at": time.Now().UTC()})); err != nil {
			return err
		}
		return tx.Exec(`INSERT INTO admin_audit_logs(action,target_type,target_id,metadata)
			VALUES ('admin.password.reset','admin',?,'{"source":"cms-admin"}'::jsonb)`, fmt.Sprint(id)).Error
	})
}

func (r *Repository) CreateSession(ctx context.Context, adminID int64, hash string, expires time.Time, ip string) error {
	return r.db.WithContext(ctx).Exec(`INSERT INTO admin_sessions
		(token_hash,admin_user_id,expires_at,last_seen_at,ip_address)
		VALUES (?,?,?,?,NULLIF(?,'')::inet)`, hash, adminID, expires, time.Now().UTC(), ip).Error
}

func (r *Repository) SessionByHash(ctx context.Context, hash string, now time.Time) (domain.Admin, error) {
	var model database.AdminUser
	err := r.db.WithContext(ctx).Table("admin_users a").Select("a.*").
		Joins("JOIN admin_sessions s ON s.admin_user_id = a.id").
		Where("s.token_hash = ? AND s.expires_at > ? AND a.disabled_at IS NULL", hash, now).
		First(&model).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.Admin{}, domain.ErrUnauthorized
	}
	if err == nil {
		r.db.WithContext(ctx).Model(&database.AdminSession{}).Where("token_hash = ?", hash).Update("last_seen_at", now)
	}
	return adminDomain(model), err
}

func (r *Repository) DeleteSession(ctx context.Context, hash string) error {
	return r.db.WithContext(ctx).Where("token_hash = ?", hash).Delete(&database.AdminSession{}).Error
}

func (r *Repository) DeleteAdminSessions(ctx context.Context, id int64) error {
	return r.db.WithContext(ctx).Where("admin_user_id = ?", id).Delete(&database.AdminSession{}).Error
}

func (r *Repository) Audit(ctx context.Context, adminID int64, action, targetType, targetID string, metadata map[string]any, ip string) error {
	body := []byte("{}")
	if metadata != nil {
		var err error
		if body, err = json.Marshal(metadata); err != nil {
			return err
		}
	}
	return r.db.WithContext(ctx).Exec(`INSERT INTO admin_audit_logs
		(admin_user_id,action,target_type,target_id,metadata,ip_address)
		VALUES (?,?,?,?,?::jsonb,NULLIF(?,'')::inet)`,
		adminID, action, targetType, targetID, string(body), ip).Error
}

func (r *Repository) Dashboard(ctx context.Context) (map[string]any, error) {
	type row struct {
		Users, Suspended, PendingVerifications, ActiveJobs, HiddenJobs, MatchesToday, Messages, HiddenReviews int64
	}
	var counts row
	err := r.db.WithContext(ctx).Raw(`SELECT
		(SELECT COUNT(*) FROM users) users,
		(SELECT COUNT(*) FROM users WHERE suspended_at IS NOT NULL) suspended,
		(SELECT COUNT(*) FROM user_verifications WHERE status='pending') pending_verifications,
		(SELECT COUNT(*) FROM jobs WHERE deleted_at IS NULL AND hidden_at IS NULL) active_jobs,
		(SELECT COUNT(*) FROM jobs WHERE hidden_at IS NOT NULL) hidden_jobs,
		(SELECT COUNT(*) FROM matches WHERE created_at >= CURRENT_DATE) matches_today,
		(SELECT COUNT(*) FROM messages) messages,
		(SELECT COUNT(*) FROM reviews WHERE hidden_at IS NOT NULL) hidden_reviews`).Scan(&counts).Error
	return map[string]any{
		"activeUsers": counts.Users - counts.Suspended, "suspendedUsers": counts.Suspended,
		"pendingVerifications": counts.PendingVerifications, "openJobs": counts.ActiveJobs,
		"hiddenJobs": counts.HiddenJobs, "matchesToday": counts.MatchesToday, "messages": counts.Messages,
		"reportedContent": counts.HiddenJobs + counts.HiddenReviews,
	}, err
}

func (r *Repository) List(ctx context.Context, kind string, filters map[string]string, limit, offset int) (domain.ListResult, error) {
	query, countQuery, args, err := listSQL(kind, filters)
	if err != nil {
		return domain.ListResult{}, err
	}
	var total int64
	if err := r.db.WithContext(ctx).Raw(countQuery, args...).Scan(&total).Error; err != nil {
		return domain.ListResult{}, err
	}
	var items []map[string]any
	pageArgs := append(append([]any{}, args...), limit, offset)
	if err := r.db.WithContext(ctx).Raw(query+" LIMIT ? OFFSET ?", pageArgs...).Scan(&items).Error; err != nil {
		return domain.ListResult{}, err
	}
	if items == nil {
		items = []map[string]any{}
	}
	return domain.ListResult{Items: items, Page: domain.Page{Limit: limit, Offset: offset, Total: total}}, nil
}

func listSQL(kind string, f map[string]string) (string, string, []any, error) {
	var selectSQL, from, order string
	countSelect := "SELECT COUNT(*)"
	conditions, args := []string{"1=1"}, []any{}
	switch kind {
	case "verifications":
		selectSQL = `SELECT v.user_id,u.email,u.name,v.phone,v.status,v.submitted_at,v.reviewed_at,v.verified_at`
		from, order = ` FROM user_verifications v JOIN users u ON u.user_id=v.user_id`, ` ORDER BY v.submitted_at DESC NULLS LAST`
		addEqual(&conditions, &args, "v.status", f["status"])
		addSearch(&conditions, &args, f["q"], "u.email", "u.name", "v.phone")
	case "users":
		selectSQL = `SELECT u.user_id,u.email,u.name,COALESCE(v.phone,p.phone) phone,
			COALESCE(v.status,'unverified') verification_status,u.last_seen,u.suspended_at,u.suspension_reason,u.created_at`
		from = ` FROM users u LEFT JOIN user_verifications v ON v.user_id=u.user_id LEFT JOIN profiles p ON p.user_id=u.user_id`
		order = ` ORDER BY u.created_at DESC`
		if f["status"] == "suspended" {
			conditions = append(conditions, "u.suspended_at IS NOT NULL")
		} else if f["status"] == "active" {
			conditions = append(conditions, "u.suspended_at IS NULL")
		}
		addSearch(&conditions, &args, f["q"], "u.email", "u.name")
	case "jobs":
		selectSQL = `SELECT j.id,j.owner_user_id,j.business,j.title,j.category,j.pay_amount,j.pay_unit,j.created_at,j.hidden_at,j.deleted_at`
		from, order = ` FROM jobs j`, ` ORDER BY j.created_at DESC`
		if f["status"] == "hidden" {
			conditions = append(conditions, "j.hidden_at IS NOT NULL")
		} else if f["status"] == "visible" {
			conditions = append(conditions, "j.hidden_at IS NULL AND j.deleted_at IS NULL")
		}
		addEqual(&conditions, &args, "j.category", f["category"])
		addSearch(&conditions, &args, f["q"], "j.title", "j.business")
	case "reviews":
		selectSQL = `SELECT r.id,r.worker_id,r.match_id,r.reviewer_user_id,r.author,r.rating,r.comment,r.created_at,r.hidden_at`
		from, order = ` FROM reviews r`, ` ORDER BY r.created_at DESC`
		if f["status"] == "hidden" {
			conditions = append(conditions, "r.hidden_at IS NOT NULL")
		} else if f["status"] == "visible" {
			conditions = append(conditions, "r.hidden_at IS NULL")
		}
		addSearch(&conditions, &args, f["q"], "r.author", "r.comment")
	case "matches":
		selectSQL = `SELECT m.id,m.kind,m.worker_user_id,m.employer_user_id,m.job_id,m.job_done,m.reviewed,m.created_at,
			COUNT(msg.id) message_count,MAX(msg.created_at) last_message_at`
		from, order, countSelect = ` FROM matches m LEFT JOIN messages msg ON msg.match_id=m.id`, ` GROUP BY m.id ORDER BY m.created_at DESC`, "SELECT COUNT(DISTINCT m.id)"
		addEqual(&conditions, &args, "m.kind", f["kind"])
	case "swipes":
		selectSQL, from, order = `SELECT s.id,s.swiper_user_id,s.target_type,s.target_id,s.direction,s.created_at`, ` FROM swipes s`, ` ORDER BY s.created_at DESC`
		addEqual(&conditions, &args, "s.direction", f["direction"])
		addEqual(&conditions, &args, "s.target_type", f["targetType"])
	case "schedules":
		selectSQL, from, order = `SELECT s.id,s.message_id,s.kind,s.when_text,s.status,s.proposed_by,s.created_at,s.updated_at`, ` FROM message_schedules s`, ` ORDER BY s.created_at DESC`
		addEqual(&conditions, &args, "s.status", f["status"])
	case "messages":
		selectSQL, from, order = `SELECT m.id,m.match_id,m.sender,m.kind,m.created_at`, ` FROM messages m`, ` ORDER BY m.created_at DESC`
		addEqual(&conditions, &args, "m.kind", f["kind"])
	case "audit-logs":
		selectSQL = `SELECT l.id,l.admin_user_id,a.email admin_email,a.role admin_role,l.action,l.target_type,l.target_id,l.metadata,l.ip_address,l.created_at`
		from, order = ` FROM admin_audit_logs l LEFT JOIN admin_users a ON a.id=l.admin_user_id`, ` ORDER BY l.created_at DESC`
		addEqual(&conditions, &args, "l.action", f["action"])
	default:
		return "", "", nil, domain.ErrInvalidInput
	}
	where := " WHERE " + strings.Join(conditions, " AND ")
	return selectSQL + from + where + order, countSelect + from + where, args, nil
}

func (r *Repository) Detail(ctx context.Context, kind, id string) (map[string]any, error) {
	queries := map[string]string{
		"verifications": `SELECT v.user_id,u.email,u.name,v.phone,v.nik,v.ktp_photo_path,v.face_photo_path,
			v.status,v.rejection_reason,v.submitted_at,v.reviewed_at,v.verified_at FROM user_verifications v JOIN users u ON u.user_id=v.user_id WHERE v.user_id=?`,
		"users": `SELECT u.user_id,u.email,u.name,u.picture,u.last_seen,u.suspended_at,u.suspension_reason,u.history_cleaned_at,u.created_at,
			p.category,p.experience_label,p.availability,p.bio,p.rate,COALESCE(v.phone,p.phone) phone,COALESCE(v.status,'unverified') verification_status
			FROM users u LEFT JOIN profiles p ON p.user_id=u.user_id LEFT JOIN user_verifications v ON v.user_id=u.user_id WHERE u.user_id=?`,
		"jobs": `SELECT id,owner_user_id,business,title,role,category,pay_amount,pay_unit,job_type,description,phone,workers_needed,
			hidden_at,hidden_reason,deleted_at,created_at FROM jobs WHERE id=?`,
		"reviews":   `SELECT id,worker_id,match_id,reviewer_user_id,author,rating,comment,hidden_at,hidden_reason,created_at FROM reviews WHERE id=?`,
		"matches":   `SELECT id,kind,worker_user_id,employer_user_id,job_id,job_done,reviewed,created_at,updated_at FROM matches WHERE id=?`,
		"swipes":    `SELECT id,swiper_user_id,target_type,target_id,direction,created_at,updated_at FROM swipes WHERE id=?`,
		"schedules": `SELECT id,message_id,kind,when_text,status,proposed_by,created_at,updated_at FROM message_schedules WHERE id=?`,
		"messages":  `SELECT id,match_id,sender,kind,created_at FROM messages WHERE id=?`,
		"user-history": `SELECT u.user_id,
			(SELECT COUNT(*) FROM user_sessions s WHERE s.user_id=u.user_id) session_count,
			(SELECT COUNT(*) FROM swipes s WHERE s.swiper_user_id=u.user_id) swipe_count,
			(SELECT COUNT(*) FROM match_participants p WHERE p.user_id=u.user_id) match_count,
			(SELECT COUNT(*) FROM reviews r WHERE r.reviewer_user_id=u.user_id) review_count,u.history_cleaned_at
			FROM users u WHERE u.user_id=?`,
	}
	query, ok := queries[kind]
	if !ok {
		return nil, domain.ErrInvalidInput
	}
	var result map[string]any
	if err := r.db.WithContext(ctx).Raw(query, id).Scan(&result).Error; err != nil {
		return nil, err
	}
	if len(result) == 0 {
		return nil, domain.ErrNotFound
	}
	return result, nil
}

func (r *Repository) SetVerification(ctx context.Context, userID, status, reason string, adminID int64, ip string) error {
	now := time.Now().UTC()
	updates := map[string]any{"status": status, "rejection_reason": reason, "reviewed_at": now, "updated_at": now}
	if status == "approved" {
		updates["verified_at"] = now
	} else {
		updates["verified_at"] = nil
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := affected(tx.Table("user_verifications").Where("user_id=? AND status='pending'", userID).Updates(updates)); err != nil {
			return err
		}
		body, _ := json.Marshal(map[string]any{"decision": status})
		return tx.Exec(`INSERT INTO admin_audit_logs(admin_user_id,action,target_type,target_id,metadata,ip_address)
			VALUES (?,'verification.review','user',?,?::jsonb,NULLIF(?,'')::inet)`, adminID, userID, string(body), ip).Error
	})
}

func (r *Repository) SuspendUser(ctx context.Context, id string, suspended bool, reason string) error {
	var at any
	if suspended {
		at = time.Now().UTC()
	}
	return affected(r.db.WithContext(ctx).Table("users").Where("user_id=?", id).
		Updates(map[string]any{"suspended_at": at, "suspension_reason": reason, "updated_at": time.Now().UTC()}))
}

func (r *Repository) RevokeUserSessions(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Exec("DELETE FROM user_sessions WHERE user_id=?", id).Error
}

func (r *Repository) SetHidden(ctx context.Context, kind, id string, hidden bool, reason string) error {
	if kind != "jobs" && kind != "reviews" {
		return domain.ErrInvalidInput
	}
	var at any
	if hidden {
		at = time.Now().UTC()
	}
	return affected(r.db.WithContext(ctx).Table(kind).Where("id=?", id).
		Updates(map[string]any{"hidden_at": at, "hidden_reason": reason}))
}

func (r *Repository) CleanupPreview(ctx context.Context, userID string) (domain.CleanupPreview, error) {
	scope, confirmation := "user", "DELETE USER "+userID+" HISTORY"
	whereUser, whereMatch := "WHERE swiper_user_id=?", `WHERE id IN (
		SELECT match_id FROM match_participants WHERE user_id=?
		UNION SELECT id FROM matches WHERE user_id=? OR worker_user_id=? OR employer_user_id=?)`
	argsUser, argsMatch := []any{userID}, []any{userID, userID, userID, userID}
	if userID == "" {
		scope, confirmation, whereUser, whereMatch = "global", "DELETE ALL HISTORY", "", ""
		argsUser, argsMatch = nil, nil
	}
	count := func(table, where string, args ...any) (int64, error) {
		var n int64
		err := r.db.WithContext(ctx).Raw("SELECT COUNT(*) FROM "+table+" "+where, args...).Scan(&n).Error
		return n, err
	}
	swipes, err := count("swipes", whereUser, argsUser...)
	if err != nil {
		return domain.CleanupPreview{}, err
	}
	matches, err := count("matches", whereMatch, argsMatch...)
	if err != nil {
		return domain.CleanupPreview{}, err
	}
	messageWhere, scheduleWhere := "", ""
	var messageArgs []any
	if userID != "" {
		messageWhere = "WHERE match_id IN (SELECT id FROM matches " + whereMatch + ")"
		scheduleWhere = "WHERE message_id IN (SELECT id FROM messages " + messageWhere + ")"
		messageArgs = argsMatch
	}
	messages, err := count("messages", messageWhere, messageArgs...)
	if err != nil {
		return domain.CleanupPreview{}, err
	}
	schedules, err := count("message_schedules", scheduleWhere, messageArgs...)
	if err != nil {
		return domain.CleanupPreview{}, err
	}
	reviewWhere, sessionWhere := "", ""
	var reviewArgs, sessionArgs []any
	if userID != "" {
		reviewWhere = "WHERE reviewer_user_id=? OR match_id IN (SELECT id FROM matches " + whereMatch + ")"
		reviewArgs = append([]any{userID}, argsMatch...)
		sessionWhere, sessionArgs = "WHERE user_id=?", []any{userID}
	}
	reviews, err := count("reviews", reviewWhere, reviewArgs...)
	if err != nil {
		return domain.CleanupPreview{}, err
	}
	sessions, err := count("user_sessions", sessionWhere, sessionArgs...)
	return domain.CleanupPreview{Scope: scope, UserID: userID, Swipes: swipes, Matches: matches,
		Messages: messages, Schedules: schedules, Reviews: reviews, Sessions: sessions, Confirmation: confirmation}, err
}

func (r *Repository) Cleanup(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if userID == "" {
			for _, table := range []string{"message_schedules", "messages", "reviews", "match_read_receipts", "match_reviewers", "match_participants", "matches", "swipes", "user_sessions"} {
				if err := tx.Exec("DELETE FROM " + table).Error; err != nil {
					return err
				}
			}
			return tx.Exec("UPDATE users SET history_cleaned_at=?", time.Now().UTC()).Error
		}
		var ids []string
		if err := tx.Raw(`SELECT id FROM matches WHERE user_id=? OR worker_user_id=? OR employer_user_id=?
			OR id IN (SELECT match_id FROM match_participants WHERE user_id=?)`, userID, userID, userID, userID).Scan(&ids).Error; err != nil {
			return err
		}
		if len(ids) > 0 {
			if err := tx.Exec("DELETE FROM reviews WHERE match_id IN ?", ids).Error; err != nil {
				return err
			}
			if err := tx.Exec("DELETE FROM matches WHERE id IN ?", ids).Error; err != nil {
				return err
			}
		}
		for _, query := range []string{
			"DELETE FROM reviews WHERE reviewer_user_id=?",
			"DELETE FROM swipes WHERE swiper_user_id=?",
			"DELETE FROM user_sessions WHERE user_id=?",
		} {
			if err := tx.Exec(query, userID).Error; err != nil {
				return err
			}
		}
		return affected(tx.Table("users").Where("user_id=?", userID).Update("history_cleaned_at", time.Now().UTC()))
	})
}

func addEqual(conditions *[]string, args *[]any, column, value string) {
	if value != "" {
		*conditions = append(*conditions, column+" = ?")
		*args = append(*args, value)
	}
}

func addSearch(conditions *[]string, args *[]any, value string, columns ...string) {
	value = strings.TrimSpace(value)
	if value == "" {
		return
	}
	parts := make([]string, len(columns))
	for i, column := range columns {
		parts[i] = column + " ILIKE ?"
		*args = append(*args, "%"+value+"%")
	}
	*conditions = append(*conditions, "("+strings.Join(parts, " OR ")+")")
}

func affected(result *gorm.DB) error {
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func adminDomain(model database.AdminUser) domain.Admin {
	return domain.Admin{ID: model.ID, Email: model.Email, PasswordHash: model.PasswordHash,
		Role: model.Role, DisabledAt: model.DisabledAt, CreatedAt: model.CreatedAt}
}
