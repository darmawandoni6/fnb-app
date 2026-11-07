package main

import (
	"fnb-server/internal/config"
	"fnb-server/internal/database"
	httpDelivery "fnb-server/internal/delivery/http"
	"fnb-server/pkg/logger"
	"log/slog"
	"os"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	cfg := config.LoadConfig()
	log := logger.New(cfg.Environment, cfg.LogLevel)
	slog.SetDefault(log)

	_, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Error("database initialization failed", "error", err)
		os.Exit(1)
	}

	e := echo.New()
	e.HTTPErrorHandler = httpDelivery.ErrorHandler(cfg.IsDevelopment(), log)
	e.Use(httpDelivery.RequestLogger(log))
	e.Use(middleware.Recover())
	e.GET("/health", httpDelivery.Health)

	if err := e.Start(":" + cfg.Port); err != nil {
		log.Error("API server stopped", "error", err)
		os.Exit(1)
	}
}
