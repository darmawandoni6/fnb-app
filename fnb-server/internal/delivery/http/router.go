package http

import (
	"log/slog"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func NewRouter(authHandler *AuthHandler, isDevelopment bool, log *slog.Logger) *echo.Echo {
	e := echo.New()
	e.Binder = NewBinder()
	e.HTTPErrorHandler = ErrorHandler(isDevelopment, log)
	e.Use(RequestLogger(log))
	e.Use(middleware.Recover())

	e.GET("/health", Health)

	authGroup := e.Group("/auth")
	authGroup.POST("/login", authHandler.Login)
	authGroup.POST("/refresh", authHandler.Refresh)
	authGroup.POST("/logout", authHandler.Logout)

	return e
}
