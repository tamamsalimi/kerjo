package domain

import (
	"errors"
	"time"
)

const (
	RoleSuperadmin = "superadmin"
	RoleModerator  = "moderator"
	RoleReviewer   = "reviewer"
)

var (
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrNotFound     = errors.New("not found")
	ErrInvalidInput = errors.New("invalid input")
	ErrConflict     = errors.New("conflict")
)

type Admin struct {
	ID           int64      `json:"id"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	Role         string     `json:"role"`
	DisabledAt   *time.Time `json:"disabledAt,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
}

func ValidRole(role string) bool {
	return role == RoleSuperadmin || role == RoleModerator || role == RoleReviewer
}

type Page struct {
	Limit  int   `json:"limit"`
	Offset int   `json:"offset"`
	Total  int64 `json:"total"`
}

type ListResult struct {
	Items any  `json:"items"`
	Page  Page `json:"page"`
}

type CleanupPreview struct {
	Scope        string `json:"scope"`
	UserID       string `json:"userId,omitempty"`
	Swipes       int64  `json:"swipes"`
	Matches      int64  `json:"matches"`
	Messages     int64  `json:"messages"`
	Schedules    int64  `json:"schedules"`
	Reviews      int64  `json:"reviews"`
	Sessions     int64  `json:"sessions"`
	Confirmation string `json:"confirmation"`
}
