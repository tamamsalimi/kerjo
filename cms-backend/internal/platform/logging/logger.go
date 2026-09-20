package logging

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log/slog"
	"os"
	"strings"
	"time"

	gormlogger "gorm.io/gorm/logger"
)

func New(level, environment string) *slog.Logger {
	var slogLevel slog.Level
	switch strings.ToLower(level) {
	case "debug":
		slogLevel = slog.LevelDebug
	case "warn", "warning":
		slogLevel = slog.LevelWarn
	case "error":
		slogLevel = slog.LevelError
	default:
		slogLevel = slog.LevelInfo
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slogLevel, AddSource: environment != "production",
	})).With("service", "kerjo-cms-api", "environment", environment)
}

type GORMLogger struct {
	logger        *slog.Logger
	level         gormlogger.LogLevel
	slowThreshold time.Duration
}

func NewGORM(logger *slog.Logger) GORMLogger {
	return GORMLogger{logger: logger, level: gormlogger.Warn, slowThreshold: 500 * time.Millisecond}
}

func (l GORMLogger) LogMode(level gormlogger.LogLevel) gormlogger.Interface {
	l.level = level
	return l
}
func (l GORMLogger) Info(ctx context.Context, message string, values ...any) {
	if l.level >= gormlogger.Info {
		l.logger.DebugContext(ctx, message, "values", values)
	}
}
func (l GORMLogger) Warn(ctx context.Context, message string, values ...any) {
	if l.level >= gormlogger.Warn {
		l.logger.WarnContext(ctx, message, "values", values)
	}
}
func (l GORMLogger) Error(ctx context.Context, message string, values ...any) {
	if l.level >= gormlogger.Error {
		l.logger.ErrorContext(ctx, message, "values", values)
	}
}
func (l GORMLogger) Trace(ctx context.Context, started time.Time, query func() (string, int64), err error) {
	if l.level == gormlogger.Silent {
		return
	}
	elapsed := time.Since(started)
	sql, rows := query()
	sum := sha256.Sum256([]byte(sql))
	attrs := []any{"duration_ms", elapsed.Milliseconds(), "rows", rows,
		"query_fingerprint", hex.EncodeToString(sum[:8])}
	switch {
	case err != nil && !errors.Is(err, gormlogger.ErrRecordNotFound):
		l.logger.ErrorContext(ctx, "database query failed", append(attrs, "error", err)...)
	case elapsed > l.slowThreshold:
		l.logger.WarnContext(ctx, "slow database query", attrs...)
	case l.level >= gormlogger.Info:
		l.logger.DebugContext(ctx, "database query", attrs...)
	}
}
