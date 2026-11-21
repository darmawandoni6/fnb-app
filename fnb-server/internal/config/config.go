package config

import (
	"errors"
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
	DatabaseURL          string
	Environment          string
	Port                 string
	LogLevel             slog.Level
	JWTSecret            string
	AccessTTL            time.Duration
	RefreshTTL           time.Duration
	UploadDir            string
	SeedOwnerEmail       string
	SeedOwnerPassword    string
	OutletTimezone       string
	MidtransServerKey    string
	MidtransClientKey    string
	MidtransIsProduction bool
}

func LoadConfig() *Config {
	return &Config{
		DatabaseURL:          getEnv("DATABASE_URL", defaultDSN),
		Environment:          getEnv("APP_ENV", EnvProduction),
		Port:                 getEnv("PORT", defaultPort),
		LogLevel:             parseLevel(getEnv("LOG_LEVEL", "info")),
		JWTSecret:            getEnv("JWT_SECRET", ""),
		AccessTTL:            getDuration("ACCESS_TTL", 15*time.Minute),
		RefreshTTL:           getDuration("REFRESH_TTL", 720*time.Hour),
		UploadDir:            getEnv("UPLOAD_DIR", "./uploads"),
		SeedOwnerEmail:       getEnv("SEED_OWNER_EMAIL", ""),
		SeedOwnerPassword:    getEnv("SEED_OWNER_PASSWORD", ""),
		OutletTimezone:       getEnv("OUTLET_TIMEZONE", "Asia/Jakarta"),
		MidtransServerKey:    getEnv("MIDTRANS_SERVER_KEY", ""),
		MidtransClientKey:    getEnv("MIDTRANS_CLIENT_KEY", ""),
		MidtransIsProduction: getEnv("MIDTRANS_IS_PRODUCTION", "false") == "true",
	}
}

func (c *Config) Location() *time.Location {
	loc, err := time.LoadLocation(c.OutletTimezone)
	if err != nil {
		return time.FixedZone("WIB", 7*3600)
	}
	return loc
}

func (c *Config) Validate(log *slog.Logger) error {
	if c.Environment == EnvProduction {
		if c.JWTSecret == "" {
			return errors.New("JWT_SECRET is required in production")
		}
		if c.SeedOwnerEmail == "" || c.SeedOwnerPassword == "" {
			return errors.New("SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD are required in production")
		}
		if c.MidtransServerKey == "" {
			return errors.New("MIDTRANS_SERVER_KEY is required in production")
		}
	} else {
		if c.JWTSecret == "" {
			c.JWTSecret = "dev-secret-key-change-in-production"
			if log != nil {
				log.Warn("JWT_SECRET is empty; using default development secret key")
			}
		}
		if c.SeedOwnerEmail == "" || c.SeedOwnerPassword == "" {
			if log != nil {
				log.Warn("SEED_OWNER_EMAIL or SEED_OWNER_PASSWORD not set; owner seeding will be skipped")
			}
		}
		if c.MidtransServerKey == "" {
			if log != nil {
				log.Warn("MIDTRANS_SERVER_KEY not set; Midtrans Snap creation will be skipped")
			}
		}
	}
	return nil
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
