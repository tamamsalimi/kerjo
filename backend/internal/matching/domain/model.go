package domain

import "time"

type SwipeInput struct {
	TargetType       string
	TargetID         string
	Direction        string
	JobID            string
	ScreeningAnswers []string
}

type MatchView struct {
	ID              string    `json:"id"`
	Kind            string    `json:"kind"`
	EntityType      string    `json:"entity_type"`
	EntityID        string    `json:"entity_id,omitempty"`
	Title           string    `json:"title"`
	Subtitle        string    `json:"subtitle"`
	Image           string    `json:"image"`
	Category        string    `json:"category"`
	JobDone         bool      `json:"job_done"`
	Reviewed        bool      `json:"reviewed"`
	CreatedAt       time.Time `json:"created_at"`
	LastMessage     string    `json:"last_message,omitempty"`
	Unread          int64     `json:"unread,omitempty"`
	Online          bool      `json:"online,omitempty"`
	Phone           string    `json:"phone,omitempty"`
	AllowDirectCall bool      `json:"allow_direct_call"`
	EmployerType    string    `json:"employer_type,omitempty"`
	PayAmount       int       `json:"pay_amount,omitempty"`
	PayUnit         string    `json:"pay_unit,omitempty"`
	PayDisplay      string    `json:"pay_display,omitempty"`
	JobType         string    `json:"job_type,omitempty"`
	Experience      string    `json:"experience_label,omitempty"`
	LastEducation   string    `json:"last_education,omitempty"`
	Description     string    `json:"description,omitempty"`
	Availability    string    `json:"availability,omitempty"`
	Bio             string    `json:"bio,omitempty"`
	Verified        bool      `json:"verified,omitempty"`
}

type SwipeResult struct {
	Matched bool       `json:"matched"`
	Match   *MatchView `json:"match,omitempty"`
}

type Applicant struct {
	ID                 string   `json:"id"`
	Name               string   `json:"name"`
	Category           string   `json:"category"`
	Role               string   `json:"role"`
	ExperienceLabel    string   `json:"experience_label"`
	LastEducation      string   `json:"last_education,omitempty"`
	ExperienceBucket   string   `json:"experience_bucket"`
	DistanceKM         float64  `json:"distance_km"`
	PayAmount          int      `json:"pay_amount"`
	PayUnit            string   `json:"pay_unit"`
	PayDisplay         string   `json:"pay_display,omitempty"`
	Rating             float64  `json:"rating"`
	JobsCompleted      int      `json:"jobs_completed"`
	Verified           bool     `json:"verified"`
	IsNew              bool     `json:"is_new"`
	Avatar             string   `json:"avatar"`
	Bio                string   `json:"bio"`
	Availability       string   `json:"availability,omitempty"`
	Phone              string   `json:"phone,omitempty"`
	AllowDirectCall    bool     `json:"allow_direct_call"`
	OwnerUserID        string   `json:"owner_user_id,omitempty"`
	IsReal             bool     `json:"is_real"`
	AppliedJobTitle    string   `json:"applied_job_title"`
	AppliedJobID       string   `json:"applied_job_id"`
	ScreeningQuestions []string `json:"screening_questions"`
	ScreeningAnswers   []string `json:"screening_answers"`
	Matched            bool     `json:"matched"`
	MatchID            *string  `json:"match_id"`
}

type ReviewInput struct {
	Rating  int
	Comment string
}

type RatingSummary struct {
	Average float64 `json:"average"`
	Count   int64   `json:"count"`
}

type RatingBreakdown struct {
	Combined RatingSummary `json:"combined"`
	Worker   RatingSummary `json:"worker"`
	Employer RatingSummary `json:"employer"`
}

type HistoryReview struct {
	ID           string    `json:"id"`
	MatchID      string    `json:"match_id"`
	Counterparty string    `json:"counterparty"`
	Rating       int       `json:"rating"`
	Comment      string    `json:"comment"`
	CreatedAt    time.Time `json:"created_at"`
}

type EmployerApplicantResponse struct {
	JobID              string    `json:"job_id"`
	WorkerID           string    `json:"worker_id"`
	WorkerName         string    `json:"worker_name"`
	Category           string    `json:"category,omitempty"`
	ExperienceLabel    string    `json:"experience_label,omitempty"`
	LastEducation      string    `json:"last_education,omitempty"`
	Rate               string    `json:"rate,omitempty"`
	PhotoURL           string    `json:"photo_url,omitempty"`
	Bio                string    `json:"bio,omitempty"`
	ScreeningQuestions []string  `json:"screening_questions"`
	ScreeningAnswers   []string  `json:"screening_answers"`
	CreatedAt          time.Time `json:"created_at"`
}

type EmployerJobHistory struct {
	ID                  string                       `json:"id"`
	Title               string                       `json:"title"`
	Business            string                       `json:"business"`
	EmployerType        string                       `json:"employer_type"`
	Status              string                       `json:"status"`
	PeopleNeeded        int                          `json:"people_needed"`
	PeopleFilled        int64                        `json:"people_filled"`
	ApplicantCount      int64                        `json:"applicant_count"`
	MatchCount          int64                        `json:"match_count"`
	ApplicantResponses  []EmployerApplicantResponse  `json:"applicant_responses"`
	CreatedAt           time.Time                    `json:"created_at"`
}

type WorkerJobHistory struct {
	ID                 string    `json:"id"`
	Title              string    `json:"title"`
	Business           string    `json:"business"`
	EmployerName       string    `json:"employer_name,omitempty"`
	EmployerType       string    `json:"employer_type,omitempty"`
	EmployerPhoto      string    `json:"employer_photo,omitempty"`
	Status             string    `json:"status"`
	MatchID            *string   `json:"match_id,omitempty"`
	ScreeningQuestions []string  `json:"screening_questions"`
	ScreeningAnswers   []string  `json:"screening_answers"`
	CreatedAt          time.Time `json:"created_at"`
}

type ProfileHistory struct {
	EmployerJobs    []EmployerJobHistory `json:"employer_jobs"`
	WorkerJobs      []WorkerJobHistory   `json:"worker_jobs"`
	RatingsGiven    []HistoryReview      `json:"ratings_given"`
	RatingsReceived []HistoryReview      `json:"ratings_received"`
	Ratings         RatingBreakdown      `json:"ratings"`
}
