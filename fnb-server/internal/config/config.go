package config

import (
	"log/slog"
	"os"
	"time"
)

const (
	defaultDSN  = "host=localhost user=postgres password=postgres dbname=fnb-app port=5432 sslmode=disable TimeZone=UTC"
	defaultPort = "8080"
)

// Config is the process environment, loaded once at startup.
type Config struct {
	DatabaseURL string
	Environment string
	Port        string
	LogLevel    slog.Level
	JWTSecret   string
	AccessTTL   time.Duration
	RefreshTTL  time.Duration
}

func LoadConfig() *Config {
	return &Config{
		DatabaseURL: getEnv("DATABASE_URL", defaultDSN),
		Environment: getEnv("APP_ENV", EnvProduction),
		Port:        getEnv("PORT", defaultPort),
		LogLevel:    parseLevel(getEnv("LOG_LEVEL", "info")),
		JWTSecret:   getEnv("JWT_SECRET", ""),
		AccessTTL:   getDuration("ACCESS_TTL", 15*time.Minute),
		RefreshTTL:  getDuration("REFRESH_TTL", 720*time.Hour),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func parseLevel(s string) slog.Level {
	var l slog.Level
	if err := l.UnmarshalText([]byte(s)); err != nil {
		return slog.LevelInfo
	}
	return l
}

func getDuration(key string, def time.Duration) time.Duration {
	raw, ok := os.LookupEnv(key)
	if !ok || raw == "" {
		return def
	}
	d, err := time.ParseDuration(raw)
	if err != nil || d <= 0 {
		return def
	}
	return d
}
