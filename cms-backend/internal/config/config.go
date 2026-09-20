package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Environment    string
	Address        string
	DatabaseURL    string
	StorageDir     string
	AllowedOrigins []string
	LogLevel       string
	SessionTTL     time.Duration
	CookieSecure   bool
}

func Load() (Config, error) {
	cfg := Config{
		Environment:    value("CMS_APP_ENV", "development"),
		Address:        value("CMS_ADDR", ":"+value("CMS_PORT", "8001")),
		DatabaseURL:    strings.TrimSpace(os.Getenv("CMS_DATABASE_URL")),
		StorageDir:     value("CMS_STORAGE_DIR", "data/uploads"),
		AllowedOrigins: csv(value("CMS_CORS_ALLOWED_ORIGINS", "http://localhost:5173")),
		LogLevel:       value("CMS_LOG_LEVEL", "info"),
		SessionTTL:     duration(value("CMS_SESSION_TTL", "12h"), 12*time.Hour),
	}
	secureDefault := cfg.Environment == "production"
	cfg.CookieSecure = boolean(value("CMS_COOKIE_SECURE", strconv.FormatBool(secureDefault)), secureDefault)
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("CMS_DATABASE_URL is required")
	}
	if len(cfg.AllowedOrigins) == 0 {
		return Config{}, fmt.Errorf("CMS_CORS_ALLOWED_ORIGINS must contain at least one origin")
	}
	return cfg, nil
}

func value(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func csv(raw string) []string {
	var result []string
	for _, item := range strings.Split(raw, ",") {
		if item = strings.TrimSpace(item); item != "" {
			result = append(result, item)
		}
	}
	return result
}

func duration(raw string, fallback time.Duration) time.Duration {
	value, err := time.ParseDuration(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func boolean(raw string, fallback bool) bool {
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return value
}
