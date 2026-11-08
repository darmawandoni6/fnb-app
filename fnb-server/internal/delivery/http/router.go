package http

import (
	"log/slog"

	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

type Handlers struct {
	Auth   *AuthHandler
	Public *PublicHandler
	Order  *OrderHandler
}

func NewRouter(h Handlers, authUsecase *usecase.AuthUsecase, isDevelopment bool, log *slog.Logger) *echo.Echo {
	e := echo.New()
	e.Binder = NewBinder()
	e.HTTPErrorHandler = ErrorHandler(isDevelopment, log)
	if log != nil {
		e.Use(RequestLogger(log))
	}
	e.Use(middleware.Recover())

	e.GET("/health", Health)

	authGroup := e.Group("/auth")
	authGroup.POST("/login", h.Auth.Login)
	authGroup.POST("/refresh", h.Auth.Refresh)
	authGroup.POST("/logout", h.Auth.Logout)

	publicGroup := e.Group("/public")
	publicGroup.GET("/tables/:qr_token/menu", h.Public.Menu, qrRateLimit(60, 60))
	publicGroup.POST("/tables/:qr_token/orders", h.Public.CreateOrder, qrRateLimit(5, 5))
	publicGroup.GET("/orders/:tracking_token", h.Public.OrderStatus, statusRateLimit(30, 30))
	publicGroup.POST("/orders/:tracking_token/cancel", h.Public.CancelItem)

	orders := e.Group("/orders", JWTMiddleware(authUsecase))
	orders.GET("", h.Order.List, RequireRoles(domain.UserRoleOwner, domain.UserRoleCashier, domain.UserRoleKitchen))
	orders.GET("/:id", h.Order.Get, RequireRoles(domain.UserRoleOwner, domain.UserRoleCashier, domain.UserRoleKitchen))
	orders.POST("/manual", h.Order.CreateManual, RequireRoles(domain.UserRoleOwner, domain.UserRoleCashier))
	orders.PATCH("/:id/payment", h.Order.UpdatePayment, RequireRoles(domain.UserRoleOwner, domain.UserRoleCashier))
	orders.PATCH("/:id/items/:item_id/status", h.Order.UpdateItemStatus, RequireRoles(domain.UserRoleOwner, domain.UserRoleCashier, domain.UserRoleKitchen))
	orders.POST("/:id/items/:item_id/cancel", h.Order.CancelItem, RequireRoles(domain.UserRoleOwner, domain.UserRoleCashier))

	return e
}
