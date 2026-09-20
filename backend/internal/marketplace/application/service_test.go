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

func TestPreferredCategoriesUsesExplicitSelectionFirst(t *testing.T) {
	got := preferredCategories(
		[]string{"Teknisi", "Retail / Toko"},
		[]string{"Bersih-bersih"},
	)
	want := []string{"Teknisi", "Retail / Toko"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("preferredCategories() = %#v; want %#v", got, want)
	}
}
