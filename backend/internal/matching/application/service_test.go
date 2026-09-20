package application

import (
	"context"
	"testing"

	"kerjo/backend/internal/matching/domain"
)

type repositoryFake struct {
	swipeCalls int
	canSwipe   bool
}

func (r *repositoryFake) CanSwipe(context.Context, string, string) (bool, error) {
	return r.canSwipe, nil
}
func (r *repositoryFake) Swipe(context.Context, string, domain.SwipeInput) (domain.SwipeResult, error) {
	r.swipeCalls++
	return domain.SwipeResult{}, nil
}
func (*repositoryFake) Undo(context.Context, string, string, string) error { return nil }
func (*repositoryFake) List(context.Context, string) ([]domain.MatchView, error) {
	return nil, nil
}
func (*repositoryFake) UnreadCount(context.Context, string) (int64, error) { return 0, nil }
func (*repositoryFake) Applicants(context.Context, string) ([]domain.Applicant, error) {
	return nil, nil
}
func (*repositoryFake) Get(context.Context, string, string) (domain.MatchView, error) {
	return domain.MatchView{}, nil
}
func (*repositoryFake) MarkRead(context.Context, string, string) error { return nil }
func (*repositoryFake) Complete(context.Context, string, string) error { return nil }
func (*repositoryFake) Review(context.Context, string, string, string, domain.ReviewInput) (map[string]any, error) {
	return nil, nil
}
func (*repositoryFake) ProfileHistory(context.Context, string) (domain.ProfileHistory, error) {
	return domain.ProfileHistory{}, nil
}

func TestAuthenticatedUserCanSwipeBothTargetTypes(t *testing.T) {
	repository := &repositoryFake{canSwipe: true}
	service := New(repository)
	for _, targetType := range []string{"job", "worker"} {
		_, err := service.Swipe(context.Background(), "user_1", domain.SwipeInput{
			TargetType: targetType, TargetID: "target_1", Direction: "right",
		})
		if err != nil {
			t.Fatalf("target %s error = %v", targetType, err)
		}
	}
	if repository.swipeCalls != 2 {
		t.Fatalf("repository swipe calls = %d; want 2", repository.swipeCalls)
	}
}

func TestSwipeRequiresTheMatchingSideSetup(t *testing.T) {
	repository := &repositoryFake{canSwipe: false}
	service := New(repository)
	tests := []struct {
		targetType string
		want       error
	}{
		{targetType: "job", want: ErrProfileRequired},
		{targetType: "worker", want: ErrJobRequired},
	}
	for _, test := range tests {
		_, err := service.Swipe(context.Background(), "user_1", domain.SwipeInput{
			TargetType: test.targetType, TargetID: "target_1", Direction: "right",
		})
		if err != test.want {
			t.Fatalf("target %s error = %v; want %v", test.targetType, err, test.want)
		}
	}
	if repository.swipeCalls != 0 {
		t.Fatalf("repository swipe calls = %d; want 0", repository.swipeCalls)
	}
}
