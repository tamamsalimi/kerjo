package domain

import "time"

type Schedule struct {
	ID         string `json:"id"`
	Kind       string `json:"kind"`
	When       string `json:"when"`
	Note       string `json:"note"`
	Status     string `json:"status"`
	ProposedBy string `json:"proposed_by"`
}

type Message struct {
	ID        int64     `json:"id,omitempty"`
	MatchID   string    `json:"match_id"`
	Sender    string    `json:"sender"`
	Kind      string    `json:"kind,omitempty"`
	Text      string    `json:"text"`
	Schedule  *Schedule `json:"schedule,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type ScheduleInput struct {
	Kind string
	When string
	Note string
}
