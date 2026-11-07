package logger

import (
	"log/slog"
	"os"

	"fnb-server/internal/config"
)

func New(environment string, level slog.Level) *slog.Logger {
	options := &slog.HandlerOptions{Level: level}
	if environment == config.EnvDevelopment {
		return slog.New(slog.NewTextHandler(os.Stderr, options))
	}
	return slog.New(slog.NewJSONHandler(os.Stderr, options))
}
