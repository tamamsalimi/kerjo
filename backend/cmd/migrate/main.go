package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/joho/godotenv"

	"kerjo/backend/internal/bootstrap"
	"kerjo/backend/internal/platform/config"
	"kerjo/backend/internal/platform/database"
	"kerjo/backend/internal/platform/logging"
	"kerjo/backend/migrations"
)

func main() {
	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}
	logger := logging.New(cfg.LogLevel, cfg.Environment)
	ctx := context.Background()
	db, sqlDB, err := database.Open(ctx, database.Options{
		URL: cfg.DatabaseURL, MaxOpenConns: 2, MaxIdleConns: 1,
		ConnMaxLifetime: cfg.DBConnMaxLifetime, Logger: logging.NewGORM(logger),
	})
	if err != nil {
		logger.Error("database startup failed", "error", err)
		os.Exit(1)
	}
	defer sqlDB.Close()

	command := "up"
	if len(os.Args) > 1 {
		command = os.Args[1]
	}
	switch command {
	case "up":
		if err := migrations.Up(ctx, db); err != nil {
			logger.Error("migration failed", "error", err)
			os.Exit(1)
		}
		if err := bootstrap.Seed(ctx, db, logger); err != nil {
			logger.Error("seed failed", "error", err)
			os.Exit(1)
		}
	case "down":
		if err := migrations.Down(ctx, db); err != nil {
			logger.Error("rollback failed", "error", err)
			os.Exit(1)
		}
	default:
		logger.Error("unknown migration command", "command", command)
		os.Exit(2)
	}
	logger.Info("database migration complete", "command", command)
}
