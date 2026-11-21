package main

import (
	"context"
	"log/slog"
	"os"

	"fnb-server/internal/config"
	"fnb-server/internal/database"
	"fnb-server/internal/repository"
	"fnb-server/internal/usecase"
	"fnb-server/pkg/logger"
)

func main() {
	cfg := config.LoadConfig()
	log := logger.New(cfg.Environment, cfg.LogLevel)
	slog.SetDefault(log)

	if err := cfg.Validate(log); err != nil {
		log.Error("configuration validation failed", "error", err)
		os.Exit(1)
	}

	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Error("database initialization failed", "error", err)
		os.Exit(1)
	}

	// Seed first owner if users table is empty
	userRepo := repository.NewUserRepository(db)
	seedUsecase := usecase.NewSeedUsecase(userRepo, cfg.SeedOwnerEmail, cfg.SeedOwnerPassword, log)
	if err := seedUsecase.SeedOwner(context.Background()); err != nil {
		log.Error("failed to seed owner", "error", err)
		os.Exit(1)
	}

	e := newRouter(db, cfg, log)

	if err := e.Start(":" + cfg.Port); err != nil {
		log.Error("API server stopped", "error", err)
		os.Exit(1)
	}
}
