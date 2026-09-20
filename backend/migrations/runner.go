package migrations

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

//go:embed *.sql
var files embed.FS

type migration struct {
	version int64
	name    string
}

func Up(ctx context.Context, db *gorm.DB) error {
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lock(tx); err != nil {
			return err
		}
		applied, err := appliedVersions(tx)
		if err != nil {
			return err
		}
		items, err := list(".up.sql")
		if err != nil {
			return err
		}
		for _, item := range items {
			if applied[item.version] {
				continue
			}
			body, err := fs.ReadFile(files, item.name)
			if err != nil {
				return fmt.Errorf("read migration %s: %w", item.name, err)
			}
			if err := tx.Exec(string(body)).Error; err != nil {
				return fmt.Errorf("apply migration %s: %w", item.name, err)
			}
			if err := tx.Exec("INSERT INTO schema_migrations(version) VALUES (?)", item.version).Error; err != nil {
				return fmt.Errorf("record migration %s: %w", item.name, err)
			}
		}
		return nil
	})
}

func Down(ctx context.Context, db *gorm.DB) error {
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lock(tx); err != nil {
			return err
		}
		var version int64
		err := tx.Raw("SELECT COALESCE(MAX(version), 0) FROM schema_migrations").Scan(&version).Error
		if err != nil || version == 0 {
			return err
		}
		items, err := list(".down.sql")
		if err != nil {
			return err
		}
		for _, item := range items {
			if item.version != version {
				continue
			}
			body, err := fs.ReadFile(files, item.name)
			if err != nil {
				return fmt.Errorf("read migration %s: %w", item.name, err)
			}
			if err := tx.Exec(string(body)).Error; err != nil {
				return fmt.Errorf("revert migration %s: %w", item.name, err)
			}
			return tx.Exec("DELETE FROM schema_migrations WHERE version = ?", version).Error
		}
		return fmt.Errorf("down migration for version %d not found", version)
	})
}

func lock(tx *gorm.DB) error {
	if err := tx.Exec("SELECT pg_advisory_xact_lock(20260919)").Error; err != nil {
		return fmt.Errorf("lock migrations: %w", err)
	}
	return tx.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version BIGINT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`).Error
}

func appliedVersions(tx *gorm.DB) (map[int64]bool, error) {
	var versions []int64
	if err := tx.Raw("SELECT version FROM schema_migrations").Scan(&versions).Error; err != nil {
		return nil, err
	}
	result := make(map[int64]bool, len(versions))
	for _, version := range versions {
		result[version] = true
	}
	return result, nil
}

func list(suffix string) ([]migration, error) {
	names, err := fs.Glob(files, "*"+suffix)
	if err != nil {
		return nil, err
	}
	result := make([]migration, 0, len(names))
	for _, name := range names {
		prefix, _, _ := strings.Cut(name, "_")
		version, err := strconv.ParseInt(prefix, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid migration name %s", name)
		}
		result = append(result, migration{version: version, name: name})
	}
	sort.Slice(result, func(i, j int) bool {
		if suffix == ".down.sql" {
			return result[i].version > result[j].version
		}
		return result[i].version < result[j].version
	})
	return result, nil
}
