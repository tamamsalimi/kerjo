package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	identityapp "kerjo/backend/internal/identity/application"
	identitydomain "kerjo/backend/internal/identity/domain"
	marketplaceapp "kerjo/backend/internal/marketplace/application"
	marketplacedomain "kerjo/backend/internal/marketplace/domain"
)

type fakeIdentityRepository struct{}

func (fakeIdentityRepository) UpsertGoogleUser(context.Context, identityapp.GoogleClaims) (identitydomain.User, error) {
	return identitydomain.User{}, nil
}
func (fakeIdentityRepository) CreateSession(context.Context, string, string, time.Time, time.Time) error {
	return nil
}
func (fakeIdentityRepository) UserByTokenHash(context.Context, string, time.Time) (identitydomain.User, error) {
	return identitydomain.User{
		ID: "user_dual_role", Email: "user@example.com",
	}, nil
}
func (fakeIdentityRepository) DeleteSession(context.Context, string) error      { return nil }
func (fakeIdentityRepository) HasProfile(context.Context, string) (bool, error) { return false, nil }
func (fakeIdentityRepository) VerificationStatus(context.Context, string) (string, error) {
	return "unverified", nil
}
func (fakeIdentityRepository) TouchLastSeen(context.Context, string, time.Time) error {
	return nil
}

type fakeMarketplaceRepository struct{}

func (fakeMarketplaceRepository) Profile(context.Context, string) (*marketplacedomain.Profile, error) {
	return &marketplacedomain.Profile{
		Name: "Budi", Category: "Bersih-bersih", PhotoURL: "/api/files/profile.jpg",
	}, nil
}
func (fakeMarketplaceRepository) SaveProfile(_ context.Context, profile marketplacedomain.Profile) (marketplacedomain.Profile, error) {
	return profile, nil
}
func (fakeMarketplaceRepository) ListJobs(context.Context, string, marketplacedomain.Filters) ([]marketplacedomain.Job, error) {
	return []marketplacedomain.Job{{ID: "job_1"}}, nil
}
func (fakeMarketplaceRepository) ListWorkers(context.Context, string, marketplacedomain.Filters) ([]marketplacedomain.Worker, error) {
	return []marketplacedomain.Worker{{ID: "wk_1"}}, nil
}
func (fakeMarketplaceRepository) Job(context.Context, string) (marketplacedomain.Job, error) {
	return marketplacedomain.Job{}, nil
}
func (fakeMarketplaceRepository) Worker(context.Context, string) (marketplacedomain.Worker, error) {
	return marketplacedomain.Worker{}, nil
}
func (fakeMarketplaceRepository) CreateJob(context.Context, string, marketplacedomain.JobInput) (marketplacedomain.Job, error) {
	return marketplacedomain.Job{}, nil
}
func (fakeMarketplaceRepository) AddJobPhoto(context.Context, string, string, string) (marketplacedomain.Job, error) {
	return marketplacedomain.Job{}, nil
}
func (fakeMarketplaceRepository) OwnedJobs(context.Context, string) ([]marketplacedomain.Job, error) {
	return nil, nil
}
func (fakeMarketplaceRepository) ActiveJobCategories(context.Context, string) ([]string, error) {
	return []string{"Bersih-bersih"}, nil
}
func (fakeMarketplaceRepository) WorkerByUserID(context.Context, string) (marketplacedomain.Worker, error) {
	return marketplacedomain.Worker{}, nil
}
func (fakeMarketplaceRepository) Reviews(context.Context, string) ([]marketplacedomain.Review, error) {
	return nil, nil
}

func TestPublicContractAndAuthentication(t *testing.T) {
	handler := New(Dependencies{
		Identity:    identityapp.New(fakeIdentityRepository{}),
		Marketplace: marketplaceapp.New(fakeMarketplaceRepository{}),
		Logger:      slog.Default(),
	}).Routes()

	tests := []struct {
		method string
		path   string
		body   string
		status int
	}{
		{http.MethodGet, "/api/", "", http.StatusOK},
		{http.MethodGet, "/api/auth/me", "", http.StatusUnauthorized},
		{http.MethodPost, "/api/auth/google", `{"id_token":"value"}`, http.StatusServiceUnavailable},
		{http.MethodPost, "/api/auth/role", `{"account_role":"employer"}`, http.StatusNotFound},
		{http.MethodPost, "/api/auth/session", `{}`, http.StatusNotFound},
		{http.MethodPost, "/api/profile/photos", "", http.StatusUnauthorized},
		{http.MethodPost, "/api/jobs/job_1/photos", "", http.StatusUnauthorized},
		{http.MethodGet, "/api/files/kerjo/verification/user_1/ktp/document.jpg", "", http.StatusNotFound},
	}
	for _, test := range tests {
		request := httptest.NewRequest(test.method, test.path, strings.NewReader(test.body))
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != test.status {
			t.Errorf("%s %s status = %d; want %d; body=%s", test.method, test.path, response.Code, test.status, response.Body)
		}
	}
}

func TestAuthenticatedUserCanBrowseBothCardTypes(t *testing.T) {
	handler := New(Dependencies{
		Identity:    identityapp.New(fakeIdentityRepository{}),
		Marketplace: marketplaceapp.New(fakeMarketplaceRepository{}),
		Logger:      slog.Default(),
	}).Routes()
	for _, path := range []string{"/api/jobs", "/api/workers"} {
		request := httptest.NewRequest(http.MethodGet, path, nil)
		request.Header.Set("Authorization", "Bearer valid-token")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Errorf("GET %s status = %d; want 200; body=%s", path, response.Code, response.Body)
		}
	}
}

func TestAuthenticatedUserCanCreateWorkerProfileAndPostJob(t *testing.T) {
	handler := New(Dependencies{
		Identity:    identityapp.New(fakeIdentityRepository{}),
		Marketplace: marketplaceapp.New(fakeMarketplaceRepository{}),
		Logger:      slog.Default(),
	}).Routes()
	tests := []struct {
		path string
		body string
	}{
		{"/api/profile", `{"name":"Dwi","category":"Masak","experience_label":"Baru","availability":"","bio":"","rate":"","phone":"","photo_url":""}`},
		{"/api/jobs", `{"business":"Warung Dwi","title":"Bantu Masak","category":"Masak","pay_amount":100000,"pay_unit":"/hari","distance_km":2,"job_type":"Harian","min_experience_label":"Baru","description":"","phone":"","screening_questions":[],"workers_needed":1}`},
	}
	for _, test := range tests {
		request := httptest.NewRequest(http.MethodPost, test.path, strings.NewReader(test.body))
		request.Header.Set("Authorization", "Bearer valid-token")
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Errorf("POST %s status = %d; want 200; body=%s", test.path, response.Code, response.Body)
		}
	}
}
