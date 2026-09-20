package domain

import (
	"errors"
	"time"
)

type Status string

const (
	StatusUnverified Status = "unverified"
	StatusPending    Status = "pending"
	StatusApproved   Status = "approved"
	StatusRejected   Status = "rejected"
)

var (
	ErrInvalidInput         = errors.New("invalid verification submission")
	ErrDocumentNotFound     = errors.New("verification document not found")
	ErrVerificationRequired = errors.New("identity verification is required")
)

type Verification struct {
	UserID          string
	Phone           string
	NIK             string
	KTPPhotoPath    string
	FacePhotoPath   string
	Status          Status
	RejectionReason string
	SubmittedAt     *time.Time
	ReviewedAt      *time.Time
	VerifiedAt      *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type Submission struct {
	Phone string
	NIK   string
}

type View struct {
	Phone           string     `json:"phone"`
	NIKMasked       string     `json:"nik_masked"`
	HasKTPPhoto     bool       `json:"has_ktp_photo"`
	HasFacePhoto    bool       `json:"has_face_photo"`
	Status          Status     `json:"status"`
	RejectionReason string     `json:"rejection_reason"`
	SubmittedAt     *time.Time `json:"submitted_at"`
	ReviewedAt      *time.Time `json:"reviewed_at"`
	VerifiedAt      *time.Time `json:"verified_at"`
}
