package database

import "time"

// CMS-owned models map the tables created by backend migration 000005.
// This module never runs AutoMigrate; the shared migration service owns schema changes.
type AdminUser struct {
	ID           int64 `gorm:"primaryKey;autoIncrement"`
	Email        string
	PasswordHash string
	Role         string
	DisabledAt   *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (AdminUser) TableName() string { return "admin_users" }

type AdminSession struct {
	ID          int64 `gorm:"primaryKey;autoIncrement"`
	TokenHash   string
	AdminUserID int64
	CreatedAt   time.Time
	ExpiresAt   time.Time
	LastSeenAt  time.Time
	IPAddress   string `gorm:"column:ip_address"`
}

func (AdminSession) TableName() string { return "admin_sessions" }

type AdminAuditLog struct {
	ID          int64 `gorm:"primaryKey;autoIncrement"`
	AdminUserID *int64
	Action      string
	TargetType  string
	TargetID    string
	Metadata    []byte `gorm:"type:jsonb"`
	IPAddress   string `gorm:"column:ip_address"`
	CreatedAt   time.Time
}

func (AdminAuditLog) TableName() string { return "admin_audit_logs" }
