package application

import (
	"reflect"
	"testing"

	"kerjo/backend/internal/marketplace/domain"
)

func TestCleanPhotoURLsPreservesOrderAndRemovesEmptyDuplicates(t *testing.T) {
	got := cleanPhotoURLs([]string{" first.jpg ", "", "second.jpg", "first.jpg"})
	want := []string{"first.jpg", "second.jpg"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("cleanPhotoURLs() = %#v; want %#v", got, want)
	}
}

func TestCleanPhotoURLsPreservesNil(t *testing.T) {
	if got := cleanPhotoURLs(nil); got != nil {
		t.Fatalf("cleanPhotoURLs(nil) = %#v; want nil", got)
	}
}

func TestNormalizeJobInputKeepsMissingPhotosNilForUpdate(t *testing.T) {
	input, err := normalizeJobInput(domain.JobInput{
		Business: "Warung Bu Yanti",
		Title:    "Kasir",
		Category: "Retail / Toko",
	})
	if err != nil {
		t.Fatalf("normalizeJobInput() error = %v", err)
	}
	if input.PhotoURLs != nil {
		t.Fatalf("PhotoURLs = %#v; want nil so create can default and update can skip", input.PhotoURLs)
	}
}

func TestProfileCompleteRequiresIdentityCategoryAndPhoto(t *testing.T) {
	complete := &domain.Profile{Name: "Sari", Category: "Retail / Toko", PhotoURLs: []string{"sari.jpg"}}
	if !profileComplete(complete) {
		t.Fatal("expected a filled worker profile with a photo to be complete")
	}
	complete.PhotoURLs = nil
	if profileComplete(complete) {
		t.Fatal("expected a worker profile without a photo to be incomplete")
	}
}

func TestPreferredCategoriesKeepsProfessionFirst(t *testing.T) {
	got := preferredCategories(
		[]string{"Teknisi", "Retail / Toko"},
		[]string{"Bersih-bersih"},
	)
	want := []string{"Bersih-bersih", "Teknisi", "Retail / Toko"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("preferredCategories() = %#v; want %#v", got, want)
	}
}

func TestNormalizeEmployerTypeKeepsAgencyUnderCompany(t *testing.T) {
	for _, value := range []string{"Usaha/Perusahaan", "agency", "agensi"} {
		got, valid := normalizeEmployerType(value)
		if !valid || got != "usaha_perusahaan" {
			t.Fatalf("normalizeEmployerType(%q) = (%q, %v); want usaha_perusahaan, true", value, got, valid)
		}
	}
}
