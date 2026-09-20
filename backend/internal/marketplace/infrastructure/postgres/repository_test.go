package postgres

import (
	"math"
	"testing"

	"kerjo/backend/internal/marketplace/domain"
)

func TestViewerDistanceUsesCoordinates(t *testing.T) {
	viewerLatitude, viewerLongitude := 0.0, 0.0
	targetLatitude, targetLongitude := 1.0, 0.0
	distance := viewerDistance(
		domain.Filters{Latitude: &viewerLatitude, Longitude: &viewerLongitude},
		&targetLatitude,
		&targetLongitude,
		9.9,
	)
	if math.Abs(distance-111.2) > 0.1 {
		t.Fatalf("distance = %.1f; want approximately 111.2", distance)
	}
}

func TestViewerDistanceFallsBackWithoutCoordinates(t *testing.T) {
	if distance := viewerDistance(domain.Filters{}, nil, nil, 3.4); distance != 3.4 {
		t.Fatalf("distance = %.1f; want fallback 3.4", distance)
	}
}

func TestParsePayAmount(t *testing.T) {
	if amount := parsePayAmount("Rp8.000.000/bulan"); amount != 8_000_000 {
		t.Fatalf("amount = %d; want 8000000", amount)
	}
}

func TestDistanceFilterUsesCalculatedDistance(t *testing.T) {
	filters := domain.Filters{MaxDistance: 2}
	if !matchesFilters("Akuntan", "Full-time", 1.1, 9_000_000, "3-5", 3, filters) {
		t.Fatal("expected a listing 1.1 km away to pass the 2 km filter")
	}
	if matchesFilters("Akuntan", "Full-time", 2.1, 9_000_000, "3-5", 3, filters) {
		t.Fatal("expected a listing 2.1 km away to fail the 2 km filter")
	}
}

func TestMultipleCategoryFiltersMatchAnySelectedCategory(t *testing.T) {
	filters := domain.Filters{Categories: []string{"Akuntan", "Staf Kantor"}}
	if !matchesFilters("Akuntan", "Full-time", 1, 700_000, "1-2", 2, filters) {
		t.Fatal("expected a selected category to pass")
	}
	if matchesFilters("Supir", "Full-time", 1, 700_000, "1-2", 2, filters) {
		t.Fatal("expected an unselected category to fail")
	}
}

func TestContinuousMaximumFilters(t *testing.T) {
	maxPay, maxExperience := 750_000.5, 2.7
	filters := domain.Filters{MaxPay: &maxPay, MaxExperience: &maxExperience}
	if !matchesFilters("Akuntan", "Full-time", 1, 700_000, "1-2", 2, filters) {
		t.Fatal("expected values below continuous maximums to pass")
	}
	if matchesFilters("Akuntan", "Full-time", 1, 800_000, "1-2", 2, filters) {
		t.Fatal("expected payment above the continuous maximum to fail")
	}
	if matchesFilters("Akuntan", "Full-time", 1, 700_000, "3-5", 3, filters) {
		t.Fatal("expected experience above the continuous maximum to fail")
	}
}

func TestExperienceFilterUsesDisplayedYearsInsteadOfBucketUpperBound(t *testing.T) {
	maxExperience := 3.0
	filters := domain.Filters{MaxExperience: &maxExperience}
	if !matchesFilters("Akuntan", "Full-time", 1, 700_000, "3-5", 3, filters) {
		t.Fatal("expected a card displaying 3 years to pass a 3-year maximum")
	}
	maxExperience = 2.9
	if matchesFilters("Akuntan", "Full-time", 1, 700_000, "3-5", 3, filters) {
		t.Fatal("expected a card displaying 3 years to fail a 2.9-year maximum")
	}
}

func TestExperienceLabelYearsUsesFirstDisplayedValue(t *testing.T) {
	for label, want := range map[string]float64{
		"Min. 3 tahun": 3,
		"3-5 tahun":    3,
		"5+ tahun":     5,
		"Baru":         0,
	} {
		if got := experienceLabelYears(label); got != want {
			t.Fatalf("experienceLabelYears(%q) = %.1f; want %.1f", label, got, want)
		}
	}
}

func TestMaxPayQueryValueNormalizesContinuousSliderValue(t *testing.T) {
	if value := maxPayQueryValue(5_215_028.718); value != 5_215_028 {
		t.Fatalf("value = %d; want 5215028", value)
	}
}

func TestRelevantJobCategoriesAreOrderedFirst(t *testing.T) {
	jobs := []domain.Job{
		{ID: "1", Category: "Supir"},
		{ID: "2", Category: "Retail / Toko"},
		{ID: "3", Category: "Teknisi"},
		{ID: "4", Category: "Retail / Toko"},
	}
	sortJobsByCategory(jobs, []string{"Retail / Toko", "Teknisi"})
	got := []string{jobs[0].ID, jobs[1].ID, jobs[2].ID, jobs[3].ID}
	want := []string{"2", "4", "3", "1"}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("job order = %#v; want %#v", got, want)
		}
	}
}

func TestRelevantWorkerCategoriesAreOrderedFirst(t *testing.T) {
	workers := []domain.Worker{
		{ID: "1", Category: "Admin"},
		{ID: "2", Category: "Fotografi"},
		{ID: "3", Category: "Admin"},
	}
	sortWorkersByCategory(workers, []string{"Fotografi"})
	if workers[0].ID != "2" {
		t.Fatalf("first worker = %s; want 2", workers[0].ID)
	}
}
