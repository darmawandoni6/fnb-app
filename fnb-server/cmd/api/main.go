package main

import (
	"fnb-server/internal/config"
	"fnb-server/internal/database"
	httpDelivery "fnb-server/internal/delivery/http"
	"log"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	cfg := config.LoadConfig()

	_, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Fatalf("database initialization failed: %v", err)
	}

	e := echo.New()
	e.HTTPErrorHandler = httpDelivery.ErrorHandler(cfg.IsDevelopment())
	e.Use(middleware.RequestLogger())
	e.Use(middleware.Recover())
	e.GET("/health", httpDelivery.Health)

	if err := e.Start(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
