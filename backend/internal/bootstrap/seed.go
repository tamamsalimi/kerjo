package bootstrap

import (
	"context"
	"log/slog"

	"gorm.io/gorm"
)

func Seed(ctx context.Context, _ *gorm.DB, logger *slog.Logger) error {
	if logger != nil {
		logger.InfoContext(ctx, "demo seed skipped")
	}
	return nil
}
