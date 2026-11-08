package main

import (
	"log/slog"
	"os"

	"fnb-server/internal/config"
	"fnb-server/internal/database"
	httpDelivery "fnb-server/internal/delivery/http"
	"fnb-server/internal/repository"
	"fnb-server/internal/usecase"
	"fnb-server/pkg/logger"
)

func main() {
	cfg := config.LoadConfig()
	log := logger.New(cfg.Environment, cfg.LogLevel)
	slog.SetDefault(log)

	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Error("database initialization failed", "error", err)
		os.Exit(1)
	}

	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	authUsecase := usecase.NewAuthUsecase(userRepo, sessionRepo, cfg.JWTSecret, cfg.AccessTTL, cfg.RefreshTTL)
	authHandler := httpDelivery.NewAuthHandler(authUsecase, !cfg.IsDevelopment())

	e := httpDelivery.NewRouter(authHandler, cfg.IsDevelopment(), log)

	if err := e.Start(":" + cfg.Port); err != nil {
		log.Error("API server stopped", "error", err)
		os.Exit(1)
	}
}
