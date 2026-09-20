package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"kerjo/cms-backend/internal/config"
	opsapp "kerjo/cms-backend/internal/ops/application"
	opspostgres "kerjo/cms-backend/internal/ops/infrastructure/postgres"
	"kerjo/cms-backend/internal/platform/database"
	"kerjo/cms-backend/internal/platform/httpserver"
	"kerjo/cms-backend/internal/platform/logging"
	"kerjo/cms-backend/internal/platform/storage"
	"kerjo/cms-backend/internal/transport/adminapi"
)

func main() {
	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid CMS configuration", "error", err)
		os.Exit(1)
	}
	logger := logging.New(cfg.LogLevel, cfg.Environment)
	slog.SetDefault(logger)
	db, sqlDB, err := database.Open(context.Background(), database.Options{
		URL: cfg.DatabaseURL, MaxOpenConns: 20, MaxIdleConns: 5,
		ConnMaxLifetime: 30 * time.Minute, Logger: logging.NewGORM(logger),
	})
	if err != nil {
		logger.Error("database startup failed", "error", err)
		os.Exit(1)
	}
	defer sqlDB.Close()
	service := opsapp.New(opspostgres.New(db), cfg.SessionTTL)
	handler := adminapi.New(service, storage.NewLocal(cfg.StorageDir), sqlDB, cfg.AllowedOrigins, cfg.CookieSecure).Routes()
	server := httpserver.New(cfg.Address, handler)
	errs := make(chan error, 1)
	go func() {
		logger.Info("CMS API listening", "address", cfg.Address)
		errs <- server.ListenAndServe()
	}()
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	select {
	case signal := <-signals:
		logger.Info("shutdown signal received", "signal", signal.String())
	case err := <-errs:
		if !errors.Is(err, http.ErrServerClosed) {
			logger.Error("CMS API failed", "error", err)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
	}
}
