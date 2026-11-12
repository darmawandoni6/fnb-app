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
	Admin  *AdminHandler
	Stock  *StockHandler
	Users  *UsersSettingsHandler
}

func NewRouter(h Handlers, authUsecase *usecase.AuthUsecase, isDevelopment bool, log *slog.Logger) *echo.Echo {
	return NewRouterWithUpload(h, authUsecase, "./uploads", isDevelopment, log)
}

func NewRouterWithUpload(h Handlers, authUsecase *usecase.AuthUsecase, uploadDir string, isDevelopment bool, log *slog.Logger) *echo.Echo {
	e := echo.New()
	e.Binder = NewBinder()
	e.HTTPErrorHandler = ErrorHandler(isDevelopment, log)
	if log != nil {
		e.Use(RequestLogger(log))
	}
	e.Use(middleware.Recover())

	e.GET("/health", Health)
	e.Static("/static", uploadDir)

	admin := e.Group("", JWTMiddleware(authUsecase), RequireRoles(domain.UserRoleOwner))
	admin.GET("/menu-categories", h.Admin.Categories)
	admin.POST("/menu-categories", h.Admin.CreateCategory)
	admin.PATCH("/menu-categories/:id", h.Admin.UpdateCategory)
	admin.DELETE("/menu-categories/:id", h.Admin.DeleteCategory)
	admin.GET("/menus", h.Admin.Menus)
	admin.POST("/menus", h.Admin.CreateMenu)
	admin.PATCH("/menus/:id", h.Admin.UpdateMenu)
	admin.DELETE("/menus/:id", h.Admin.DeleteMenu)
	admin.GET("/tables", h.Admin.Tables)
	admin.POST("/tables", h.Admin.CreateTable)
	admin.PATCH("/tables/:id", h.Admin.UpdateTable)
	admin.DELETE("/tables/:id", h.Admin.DeleteTable)

	stock := e.Group("", JWTMiddleware(authUsecase))
	stock.GET("/ingredients", h.Stock.ListIngredients, RequireRoles(domain.UserRoleOwner, domain.UserRoleCashier))
	stock.POST("/ingredients", h.Stock.CreateIngredient, RequireRoles(domain.UserRoleOwner))
	stock.PATCH("/ingredients/:id", h.Stock.UpdateIngredient, RequireRoles(domain.UserRoleOwner))
	stock.POST("/ingredients/:id/restock", h.Stock.Restock, RequireRoles(domain.UserRoleOwner))
	stock.GET("/recipe-items", h.Stock.ListRecipes, RequireRoles(domain.UserRoleOwner, domain.UserRoleCashier))
	stock.POST("/recipe-items", h.Stock.CreateRecipe, RequireRoles(domain.UserRoleOwner))
	stock.PATCH("/recipe-items/:id", h.Stock.UpdateRecipe, RequireRoles(domain.UserRoleOwner))
	stock.DELETE("/recipe-items/:id", h.Stock.DeleteRecipe, RequireRoles(domain.UserRoleOwner))
	admin.GET("/users", h.Users.ListUsers)
	admin.POST("/users", h.Users.CreateUser)
	admin.PATCH("/users/:id", h.Users.UpdateUser)
	admin.GET("/settings", h.Users.GetSettings)
	admin.PATCH("/settings", h.Users.UpdateSettings)

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
