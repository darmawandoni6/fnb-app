package http

import (
	"log/slog"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func NewRouter(authHandler *AuthHandler, publicHandler *PublicHandler, isDevelopment bool, log *slog.Logger) *echo.Echo {
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

	publicGroup := e.Group("/public")
	publicGroup.GET("/tables/:qr_token/menu", publicHandler.Menu, qrRateLimit(60, 60))
	publicGroup.POST("/tables/:qr_token/orders", publicHandler.CreateOrder, qrRateLimit(5, 5))
	publicGroup.GET("/orders/:tracking_token", publicHandler.OrderStatus, statusRateLimit(30, 30))
	publicGroup.POST("/orders/:tracking_token/cancel", publicHandler.CancelItem)

	return e
}
