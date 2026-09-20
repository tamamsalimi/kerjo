package migrations

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"kerjo/backend/internal/platform/database"
	"kerjo/backend/internal/platform/logging"
)

func TestUpDown(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not configured")
	}
	if !strings.Contains(strings.ToLower(url), "test") {
		t.Fatal("TEST_DATABASE_URL must identify an isolated test database")
	}
	ctx := context.Background()
	db, sqlDB, err := database.Open(ctx, database.Options{
		URL: url, MaxOpenConns: 2, MaxIdleConns: 1,
		ConnMaxLifetime: time.Minute, Logger: logging.NewGORM(logging.New("error", "test")),
	})
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()
	if err := Down(ctx, db); err != nil {
		t.Fatal(err)
	}
	if err := Up(ctx, db); err != nil {
		t.Fatal(err)
	}
	var count int64
	if err := db.Raw(`SELECT COUNT(*) FROM information_schema.tables
		WHERE table_schema = current_schema() AND table_name = 'users'`).Scan(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("users table count = %d; want 1", count)
	}
	if err := Down(ctx, db); err != nil {
		t.Fatal(err)
	}
}
