package database

import "time"

type User struct {
	ID               string `gorm:"column:user_id;primaryKey;size:64"`
	Email            string `gorm:"size:320;not null"`
	GoogleSub        *string
	Name             string
	Picture          string
	LastSeen         *time.Time
	SuspendedAt      *time.Time
	SuspensionReason string
	HistoryCleanedAt *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func (User) TableName() string { return "users" }

type UserSession struct {
	ID        int64 `gorm:"primaryKey;autoIncrement"`
	TokenHash string
	UserID    string
	CreatedAt time.Time
	ExpiresAt time.Time
}

func (UserSession) TableName() string { return "user_sessions" }

type UserVerification struct {
	UserID          string `gorm:"primaryKey;size:64"`
	Phone           string
	NIK             string
	KTPPhotoPath    string
	FacePhotoPath   string
	Status          string
	RejectionReason string
	SubmittedAt     *time.Time
	ReviewedAt      *time.Time
	VerifiedAt      *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

func (UserVerification) TableName() string { return "user_verifications" }

type Profile struct {
	UserID          string `gorm:"primaryKey;size:64"`
	Name            string
	Category        string
	ExperienceLabel string
	LastEducation   string
	Availability    string
	Bio             string
	Rate            string
	Phone           string
	AllowDirectCall bool
	PhotoURL        string
	PhotoURLs       []string `gorm:"serializer:json;type:jsonb"`
	EmployerType    string
	Latitude        *float64
	Longitude       *float64
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

func (Profile) TableName() string { return "profiles" }

type Job struct {
	ID                 string `gorm:"primaryKey;size:64"`
	OwnerUserID        *string
	Business           string
	EmployerType       string
	Title              string
	Role               string
	Category           string
	PayAmount          int
	PayUnit            string
	DistanceKM         float64
	JobType            string
	MinExperienceLabel string
	ExperienceBucket   string
	Description        string
	Phone              string
	AllowDirectCall    bool
	PhotoURLs          []string `gorm:"serializer:json;type:jsonb;not null;default:[]"`
	ScreeningQuestions []string `gorm:"serializer:json;type:jsonb"`
	WorkersNeeded      int
	Latitude           *float64
	Longitude          *float64
	CreatedAt          time.Time
	UpdatedAt          time.Time
	DeletedAt          *time.Time
	HiddenAt           *time.Time
	HiddenReason       string
}

func (Job) TableName() string { return "jobs" }

type Worker struct {
	ID               string `gorm:"primaryKey;size:64"`
	Name             string
	Category         string
	Role             string
	ExperienceLabel  string
	LastEducation    string
	ExperienceYears  int
	ExperienceBucket string
	DistanceKM       float64
	PayAmount        int
	PayUnit          string
	Rating           float64
	JobsCompleted    int
	Verified         bool
	IsNew            bool
	Avatar           string
	Bio              string
	CreatedAt        time.Time
	UpdatedAt        time.Time
	DeletedAt        *time.Time
}

func (Worker) TableName() string { return "workers" }

type Review struct {
	ID             string `gorm:"primaryKey;size:64"`
	WorkerID       string
	MatchID        *string
	ReviewerUserID *string
	Author         string
	Rating         int
	Comment        string
	DisplayDate    string
	CreatedAt      time.Time
	HiddenAt       *time.Time
	HiddenReason   string
}

func (Review) TableName() string { return "reviews" }

type Swipe struct {
	ID               int64 `gorm:"primaryKey;autoIncrement"`
	SwiperUserID     string
	TargetType       string
	TargetID         string
	Direction        string
	ScreeningAnswers []string `gorm:"serializer:json;type:jsonb"`
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func (Swipe) TableName() string { return "swipes" }

type Match struct {
	ID                    string `gorm:"primaryKey;size:64"`
	Kind                  string
	UserID                *string
	EntityType            string
	EntityID              string
	Title                 string
	Subtitle              string
	Image                 string
	Category              string
	WorkerUserID          *string
	EmployerUserID        *string
	JobID                 *string
	WorkerName            string
	WorkerCategory        string
	WorkerAvatar          string
	WorkerPhone           string
	WorkerAllowDirectCall bool
	JobTitle              string
	JobBusiness           string
	JobCategory           string
	JobPhone              string
	JobAllowDirectCall    bool
	JobDone               bool
	Reviewed              bool
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

func (Match) TableName() string { return "matches" }

type MatchParticipant struct {
	MatchID string `gorm:"primaryKey"`
	UserID  string `gorm:"primaryKey"`
	Role    string
}

func (MatchParticipant) TableName() string { return "match_participants" }

type MatchReadReceipt struct {
	MatchID string `gorm:"primaryKey"`
	UserID  string `gorm:"primaryKey"`
	ReadAt  time.Time
}

func (MatchReadReceipt) TableName() string { return "match_read_receipts" }

type MatchReviewer struct {
	MatchID string `gorm:"primaryKey"`
	UserID  string `gorm:"primaryKey"`
}

func (MatchReviewer) TableName() string { return "match_reviewers" }

type Message struct {
	ID        int64 `gorm:"primaryKey;autoIncrement"`
	LegacyID  *string
	MatchID   string
	Sender    string
	Kind      string
	Text      string
	CreatedAt time.Time
}

func (Message) TableName() string { return "messages" }

type MessageSchedule struct {
	ID         string `gorm:"primaryKey;size:64"`
	MessageID  int64
	Kind       string
	WhenText   string `gorm:"column:when_text"`
	Note       string
	Status     string
	ProposedBy string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

func (MessageSchedule) TableName() string { return "message_schedules" }
