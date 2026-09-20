package domain

import (
	"errors"
	"time"
)

var (
	ErrNotAuthenticated = errors.New("not authenticated")
	ErrInvalidSession   = errors.New("invalid session")
)

type User struct {
	ID        string
	Email     string
	GoogleSub string
	Name      string
	Picture   string
	LastSeen  *time.Time
	CreatedAt time.Time
}

type Session struct {
	ID        int64
	UserID    string
	CreatedAt time.Time
	ExpiresAt time.Time
}
