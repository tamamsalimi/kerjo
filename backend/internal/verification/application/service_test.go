package application

import (
	"context"
	"testing"
	"time"

	"kerjo/backend/internal/verification/domain"
)

type repositoryFake struct {
	verification domain.Verification
}

func (r *repositoryFake) Get(context.Context, string) (domain.Verification, error) {
	return r.verification, nil
}

func (r *repositoryFake) Submit(_ context.Context, userID string, input domain.Submission, now time.Time) (domain.Verification, error) {
	r.verification.UserID = userID
	r.verification.Phone = input.Phone
	r.verification.NIK = input.NIK
	r.verification.Status = domain.StatusPending
	r.verification.SubmittedAt = &now
	return r.verification, nil
}

func (r *repositoryFake) SaveDocument(_ context.Context, _ string, kind, objectPath string, _ time.Time) error {
	if kind == "ktp" {
		r.verification.KTPPhotoPath = objectPath
	} else {
		r.verification.FacePhotoPath = objectPath
	}
	return nil
}

func TestSubmitNormalizesAndMasksSensitiveData(t *testing.T) {
	repository := &repositoryFake{verification: domain.Verification{
		KTPPhotoPath: "ktp.jpg", FacePhotoPath: "face.jpg",
	}}
	service := New(repository)
	view, err := service.Submit(context.Background(), "user_1", domain.Submission{
		Phone: "+62 812-3456-7890", NIK: "3173012345678901",
	})
	if err != nil {
		t.Fatal(err)
	}
	if view.Phone != "081234567890" || view.NIKMasked != "************8901" {
		t.Fatalf("unexpected masked view: %#v", view)
	}
	if view.Status != domain.StatusPending {
		t.Fatalf("status = %q; want pending", view.Status)
	}
}

func TestSubmitRequiresBothDocuments(t *testing.T) {
	service := New(&repositoryFake{})
	if _, err := service.Submit(context.Background(), "user_1", domain.Submission{
		Phone: "081234567890", NIK: "3173012345678901",
	}); err != domain.ErrInvalidInput {
		t.Fatalf("error = %v; want invalid input", err)
	}
}

func TestRequireApproved(t *testing.T) {
	service := New(&repositoryFake{verification: domain.Verification{Status: domain.StatusPending}})
	if err := service.RequireApproved(context.Background(), "user_1"); err != domain.ErrVerificationRequired {
		t.Fatalf("error = %v; want verification required", err)
	}
}
