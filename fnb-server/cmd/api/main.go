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

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
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

	e := echo.New()
	e.Binder = httpDelivery.NewBinder()
	e.HTTPErrorHandler = httpDelivery.ErrorHandler(cfg.IsDevelopment(), log)
	e.Use(httpDelivery.RequestLogger(log))
	e.Use(middleware.Recover())

	e.GET("/health", httpDelivery.Health)

	authGroup := e.Group("/auth")
	authGroup.POST("/login", authHandler.Login)
	authGroup.POST("/refresh", authHandler.Refresh)
	authGroup.POST("/logout", authHandler.Logout)

	if err := e.Start(":" + cfg.Port); err != nil {
		log.Error("API server stopped", "error", err)
		os.Exit(1)
	}
}
