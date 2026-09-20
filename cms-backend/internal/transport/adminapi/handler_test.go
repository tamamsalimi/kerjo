package adminapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"kerjo/cms-backend/internal/ops/domain"
)

func TestLiveHealthAndStrictCORS(t *testing.T) {
	handler := New(nil, nil, nil, []string{"https://cms.example.com"}, true).Routes()
	request := httptest.NewRequest(http.MethodGet, "/health/live", nil)
	request.Header.Set("Origin", "https://evil.example.com")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK || response.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("strict CORS failed: status=%d headers=%v", response.Code, response.Header())
	}
	request = httptest.NewRequest(http.MethodOptions, "/api/auth/login", nil)
	request.Header.Set("Origin", "https://cms.example.com")
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent || response.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("approved preflight failed: status=%d headers=%v", response.Code, response.Header())
	}
}

func TestLoginRejectsMissingOrigin(t *testing.T) {
	handler := New(nil, nil, nil, []string{"https://cms.example.com"}, true).Routes()
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/auth/login", nil))
	if response.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", response.Code)
	}
}

func TestThrottleAndReadPermissions(t *testing.T) {
	throttle := newThrottle(2, time.Second)
	if !throttle.allow("ip") || !throttle.allow("ip") || throttle.allow("ip") {
		t.Fatal("throttle did not enforce limit")
	}
	reviewer := domain.Admin{Role: domain.RoleReviewer}
	if !canRead(reviewer, "verifications") || canRead(reviewer, "users") {
		t.Fatal("reviewer read permissions are incorrect")
	}
}
