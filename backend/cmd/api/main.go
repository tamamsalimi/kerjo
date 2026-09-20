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

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/joho/godotenv"

	conversationapp "kerjo/backend/internal/conversation/application"
	conversationpostgres "kerjo/backend/internal/conversation/infrastructure/postgres"
	identityapp "kerjo/backend/internal/identity/application"
	identitypostgres "kerjo/backend/internal/identity/infrastructure/postgres"
	marketplaceapp "kerjo/backend/internal/marketplace/application"
	marketplacepostgres "kerjo/backend/internal/marketplace/infrastructure/postgres"
	matchingapp "kerjo/backend/internal/matching/application"
	matchingpostgres "kerjo/backend/internal/matching/infrastructure/postgres"
	"kerjo/backend/internal/platform/config"
	"kerjo/backend/internal/platform/database"
	"kerjo/backend/internal/platform/httpserver"
	"kerjo/backend/internal/platform/logging"
	"kerjo/backend/internal/platform/storage"
	"kerjo/backend/internal/transport/httpapi"
	verificationapp "kerjo/backend/internal/verification/application"
	verificationpostgres "kerjo/backend/internal/verification/infrastructure/postgres"
)

func main() {
	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}
	logger := logging.New(cfg.LogLevel, cfg.Environment)
	slog.SetDefault(logger)

	ctx := context.Background()
	gormDB, sqlDB, err := database.Open(ctx, database.Options{
		URL: cfg.DatabaseURL, MaxOpenConns: cfg.DBMaxOpenConns,
		MaxIdleConns: cfg.DBMaxIdleConns, ConnMaxLifetime: cfg.DBConnMaxLifetime,
		Logger: logging.NewGORM(logger),
	})
	if err != nil {
		logger.Error("database startup failed", "error", err)
		os.Exit(1)
	}
	defer sqlDB.Close()

	identityService := identityapp.New(identitypostgres.New(gormDB))
	marketplaceService := marketplaceapp.New(marketplacepostgres.New(gormDB))
	matchingService := matchingapp.New(matchingpostgres.New(gormDB))
	verificationService := verificationapp.New(verificationpostgres.New(gormDB))
	conversationService := conversationapp.New(conversationpostgres.New(gormDB), verificationService)

	keySet := oidc.NewRemoteKeySet(ctx, "https://www.googleapis.com/oauth2/v3/certs")
	verifier := oidc.NewVerifier(
		"https://accounts.google.com",
		keySet,
		&oidc.Config{SkipClientIDCheck: true, SkipIssuerCheck: true},
	)
	if len(cfg.GoogleClientIDs) == 0 {
		logger.Warn("GOOGLE_CLIENT_IDS is empty; Google sign-in is disabled")
	}

	api := httpapi.New(httpapi.Dependencies{
		Identity: identityService, Marketplace: marketplaceService,
		Matching: matchingService, Conversation: conversationService,
		Verification: verificationService,
		Storage:      storage.NewLocal(cfg.StorageDir), Verifier: verifier,
		GoogleClientIDs: cfg.GoogleClientIDs, DB: sqlDB, Logger: logger,
	})
	handler := httpserver.Middleware(logger, cfg.CORSAllowedOrigins, api.Routes())
	server := httpserver.New(cfg.Address, handler)

	errs := make(chan error, 1)
	go func() {
		logger.Info("API listening", "address", cfg.Address)
		errs <- server.ListenAndServe()
	}()

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	select {
	case signalValue := <-signals:
		logger.Info("shutdown signal received", "signal", signalValue.String())
	case serveErr := <-errs:
		if !errors.Is(serveErr, http.ErrServerClosed) {
			logger.Error("HTTP server failed", "error", serveErr)
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
	}
}
