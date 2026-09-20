package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Environment        string
	Address            string
	DatabaseURL        string
	StorageDir         string
	GoogleClientIDs    []string
	CORSAllowedOrigins []string
	LogLevel           string
	DBMaxOpenConns     int
	DBMaxIdleConns     int
	DBConnMaxLifetime  time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		Environment:        value("APP_ENV", "development"),
		Address:            address(),
		DatabaseURL:        strings.TrimSpace(os.Getenv("DATABASE_URL")),
		StorageDir:         value("STORAGE_DIR", "data/uploads"),
		GoogleClientIDs:    csvValues(os.Getenv("GOOGLE_CLIENT_IDS") + "," + os.Getenv("GOOGLE_CLIENT_ID")),
		CORSAllowedOrigins: csvValues(value("CORS_ALLOWED_ORIGINS", "http://localhost:8081")),
		LogLevel:           value("LOG_LEVEL", "info"),
		DBMaxOpenConns:     intValue("DB_MAX_OPEN_CONNS", 25),
		DBMaxIdleConns:     intValue("DB_MAX_IDLE_CONNS", 10),
		DBConnMaxLifetime:  durationValue("DB_CONN_MAX_LIFETIME", 30*time.Minute),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if len(cfg.CORSAllowedOrigins) == 0 {
		return Config{}, fmt.Errorf("CORS_ALLOWED_ORIGINS must contain at least one origin")
	}
	return cfg, nil
}

func value(key, fallback string) string {
	if result := strings.TrimSpace(os.Getenv(key)); result != "" {
		return result
	}
	return fallback
}

func address() string {
	if result := strings.TrimSpace(os.Getenv("ADDR")); result != "" {
		return result
	}
	return ":" + value("PORT", "8000")
}

func csvValues(raw string) []string {
	seen := map[string]bool{}
	result := []string{}
	for _, item := range strings.Split(raw, ",") {
		item = strings.TrimSpace(item)
		if item != "" && !seen[item] {
			seen[item] = true
			result = append(result, item)
		}
	}
	return result
}

func intValue(key string, fallback int) int {
	result, err := strconv.Atoi(strings.TrimSpace(os.Getenv(key)))
	if err != nil || result < 1 {
		return fallback
	}
	return result
}

func durationValue(key string, fallback time.Duration) time.Duration {
	result, err := time.ParseDuration(strings.TrimSpace(os.Getenv(key)))
	if err != nil || result <= 0 {
		return fallback
	}
	return result
}
