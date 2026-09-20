package application

import (
	"context"
	"regexp"
	"strings"
	"time"

	"kerjo/backend/internal/verification/domain"
)

type Repository interface {
	Get(context.Context, string) (domain.Verification, error)
	Submit(context.Context, string, domain.Submission, time.Time) (domain.Verification, error)
	SaveDocument(context.Context, string, string, string, time.Time) error
}

type Service struct {
	repository Repository
	now        func() time.Time
}

func New(repository Repository) *Service {
	return &Service{repository: repository, now: func() time.Time { return time.Now().UTC() }}
}

func (s *Service) Get(ctx context.Context, userID string) (domain.View, error) {
	verification, err := s.repository.Get(ctx, userID)
	if err != nil {
		return domain.View{}, err
	}
	return toView(verification), nil
}

func (s *Service) Status(ctx context.Context, userID string) (domain.Status, error) {
	verification, err := s.repository.Get(ctx, userID)
	if err != nil {
		return "", err
	}
	return verification.Status, nil
}

func (s *Service) RequireApproved(ctx context.Context, userID string) error {
	status, err := s.Status(ctx, userID)
	if err != nil {
		return err
	}
	if status != domain.StatusApproved {
		return domain.ErrVerificationRequired
	}
	return nil
}

func (s *Service) Approved(ctx context.Context, userID string) (bool, error) {
	status, err := s.Status(ctx, userID)
	return status == domain.StatusApproved, err
}

func (s *Service) Submit(ctx context.Context, userID string, input domain.Submission) (domain.View, error) {
	input.Phone = normalizePhone(input.Phone)
	input.NIK = strings.TrimSpace(input.NIK)
	if !regexp.MustCompile(`^08[0-9]{8,11}$`).MatchString(input.Phone) ||
		!regexp.MustCompile(`^[0-9]{16}$`).MatchString(input.NIK) {
		return domain.View{}, domain.ErrInvalidInput
	}
	current, err := s.repository.Get(ctx, userID)
	if err != nil {
		return domain.View{}, err
	}
	if current.KTPPhotoPath == "" || current.FacePhotoPath == "" {
		return domain.View{}, domain.ErrInvalidInput
	}
	verification, err := s.repository.Submit(ctx, userID, input, s.now())
	if err != nil {
		return domain.View{}, err
	}
	return toView(verification), nil
}

func (s *Service) SaveDocument(ctx context.Context, userID, kind, objectPath string) error {
	if kind != "ktp" && kind != "face" {
		return domain.ErrInvalidInput
	}
	prefix := "kerjo/verification/" + userID + "/" + kind + "/"
	if !strings.HasPrefix(objectPath, prefix) {
		return domain.ErrInvalidInput
	}
	return s.repository.SaveDocument(ctx, userID, kind, objectPath, s.now())
}

func (s *Service) DocumentPath(ctx context.Context, userID, kind string) (string, error) {
	verification, err := s.repository.Get(ctx, userID)
	if err != nil {
		return "", err
	}
	switch kind {
	case "ktp":
		if verification.KTPPhotoPath != "" {
			return verification.KTPPhotoPath, nil
		}
	case "face":
		if verification.FacePhotoPath != "" {
			return verification.FacePhotoPath, nil
		}
	}
	return "", domain.ErrDocumentNotFound
}

func normalizePhone(value string) string {
	value = strings.TrimSpace(value)
	var digits strings.Builder
	for _, character := range value {
		if character >= '0' && character <= '9' {
			digits.WriteRune(character)
		}
	}
	result := digits.String()
	if strings.HasPrefix(result, "62") {
		result = "0" + strings.TrimPrefix(result, "62")
	}
	return result
}

func toView(verification domain.Verification) domain.View {
	masked := ""
	if len(verification.NIK) == 16 {
		masked = "************" + verification.NIK[12:]
	}
	status := verification.Status
	if status == "" {
		status = domain.StatusUnverified
	}
	return domain.View{
		Phone: verification.Phone, NIKMasked: masked,
		HasKTPPhoto: verification.KTPPhotoPath != "", HasFacePhoto: verification.FacePhotoPath != "",
		Status: status, RejectionReason: verification.RejectionReason,
		SubmittedAt: verification.SubmittedAt, ReviewedAt: verification.ReviewedAt, VerifiedAt: verification.VerifiedAt,
	}
}
