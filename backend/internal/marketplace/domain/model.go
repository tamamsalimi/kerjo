package domain

import "time"

type Profile struct {
	UserID          string    `json:"user_id"`
	Name            string    `json:"name"`
	Category        string    `json:"category"`
	ExperienceLabel string    `json:"experience_label"`
	Availability    string    `json:"availability"`
	Bio             string    `json:"bio"`
	Rate            string    `json:"rate"`
	Phone           string    `json:"phone"`
	PhotoURL        string    `json:"photo_url"`
	PhotoURLs       []string  `json:"photo_urls"`
	Latitude        *float64  `json:"-"`
	Longitude       *float64  `json:"-"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type Job struct {
	ID                 string    `json:"id"`
	OwnerUserID        *string   `json:"owner_user_id"`
	Business           string    `json:"business"`
	Title              string    `json:"title"`
	Role               string    `json:"role"`
	Category           string    `json:"category"`
	PayAmount          int       `json:"pay_amount"`
	PayUnit            string    `json:"pay_unit"`
	DistanceKM         float64   `json:"distance_km"`
	JobType            string    `json:"job_type"`
	MinExperienceLabel string    `json:"min_experience_label"`
	ExperienceBucket   string    `json:"experience_bucket"`
	Description        string    `json:"description"`
	Phone              string    `json:"phone"`
	PhotoURLs          []string  `json:"photo_urls"`
	ScreeningQuestions []string  `json:"screening_questions"`
	WorkersNeeded      int       `json:"workers_needed"`
	Latitude           *float64  `json:"-"`
	Longitude          *float64  `json:"-"`
	CreatedAt          time.Time `json:"created_at"`
}

type Worker struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	Category         string   `json:"category"`
	Role             string   `json:"role"`
	ExperienceLabel  string   `json:"experience_label"`
	ExperienceBucket string   `json:"experience_bucket"`
	DistanceKM       float64  `json:"distance_km"`
	PayAmount        int      `json:"pay_amount"`
	PayUnit          string   `json:"pay_unit"`
	PayDisplay       string   `json:"pay_display,omitempty"`
	Rating           float64  `json:"rating"`
	JobsCompleted    int      `json:"jobs_completed"`
	Verified         bool     `json:"verified"`
	IsNew            bool     `json:"is_new"`
	Avatar           string   `json:"avatar"`
	Bio              string   `json:"bio"`
	Availability     string   `json:"availability,omitempty"`
	Phone            string   `json:"phone,omitempty"`
	OwnerUserID      string   `json:"owner_user_id,omitempty"`
	IsReal           bool     `json:"is_real"`
	Reviews          []Review `json:"reviews,omitempty"`
}

type Review struct {
	ID        string    `json:"id"`
	WorkerID  string    `json:"worker_id"`
	Author    string    `json:"author"`
	Rating    int       `json:"rating"`
	Comment   string    `json:"comment"`
	Date      string    `json:"date"`
	CreatedAt time.Time `json:"created_at,omitempty"`
}

type Filters struct {
	Category           string
	Categories         []string
	JobType            string
	MaxDistance        float64
	MaxPay             *float64
	MaxExperience      *float64
	PayBracket         string
	Experience         string
	Latitude           *float64
	Longitude          *float64
	RelevantCategories []string
}

type JobInput struct {
	Business           string
	Title              string
	Category           string
	PayAmount          int
	PayUnit            string
	DistanceKM         float64
	JobType            string
	MinExperienceLabel string
	Description        string
	Phone              string
	ScreeningQuestions []string
	WorkersNeeded      int
	Latitude           *float64
	Longitude          *float64
}
