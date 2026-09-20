package config

import "testing"

func TestLoadUsesCMSScopedEnvironment(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://legacy-key")
	t.Setenv("CMS_DATABASE_URL", "postgres://cms-key")
	t.Setenv("CMS_CORS_ALLOWED_ORIGINS", "https://cms.example.com")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DatabaseURL != "postgres://cms-key" {
		t.Fatalf("database URL = %q", cfg.DatabaseURL)
	}
	if len(cfg.AllowedOrigins) != 1 || cfg.AllowedOrigins[0] != "https://cms.example.com" {
		t.Fatalf("origins = %#v", cfg.AllowedOrigins)
	}
}
