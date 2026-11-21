package main

import (
	"context"
	"log/slog"

	"fnb-server/internal/config"
	"fnb-server/internal/database"
	httpDelivery "fnb-server/internal/delivery/http"
	"fnb-server/internal/domain"
	"fnb-server/internal/repository"
	"fnb-server/internal/usecase"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

func newRouter(db *gorm.DB, cfg *config.Config, log *slog.Logger) *echo.Echo {
	handlers, authUsecase, sessionUsecase := newHandlers(db, cfg)
	return httpDelivery.NewRouterWithUpload(handlers, authUsecase, sessionUsecase, cfg.UploadDir, cfg.IsDevelopment(), log)
}

func newHandlers(db *gorm.DB, cfg *config.Config) (httpDelivery.Handlers, *usecase.AuthUsecase, *usecase.TableSessionUsecase) {
	authUsecase := newAuthUsecase(db, cfg)
	sessionUsecase := newTableSessionUsecase(db)
	categoryRepo := repository.NewMenuCategoryRepository(db)
	adminHandler := newAdminHandler(db, categoryRepo, cfg)
	handlers := httpDelivery.Handlers{
		Auth:   newAuthHandler(authUsecase, cfg),
		Public: newPublicHandler(db, sessionUsecase),
		Order:  newOrderHandler(db),
		Admin:  adminHandler,
		Stock:  newStockHandler(db),
		Users:  newUsersSettingsHandler(db),
	}
	return handlers, authUsecase, sessionUsecase
}

func newAdminHandler(db *gorm.DB, categoryRepo domain.MenuCategoryRepository, cfg *config.Config) *httpDelivery.AdminHandler {
	menuRepo := repository.NewMenuRepository(db)
	tableRepo := repository.NewTableRepository(db)
	return httpDelivery.NewAdminHandler(usecase.NewMenuCategoryUsecase(categoryRepo), usecase.NewMenuUsecase(menuRepo, categoryRepo), usecase.NewTableUsecase(tableRepo), cfg.UploadDir)
}

func newStockHandler(db *gorm.DB) *httpDelivery.StockHandler {
	ingredientRepo := repository.NewIngredientRepository(db)
	recipeRepo := repository.NewRecipeItemRepository(db)
	menuRepo := repository.NewMenuRepository(db)
	ingredientUsecase := usecase.NewIngredientUsecase(ingredientRepo, repository.NewStockTx(db))
	recipeUsecase := usecase.NewRecipeItemUsecase(recipeRepo, menuRepo, ingredientRepo)
	return httpDelivery.NewStockHandler(ingredientUsecase, recipeUsecase)
}

func newUsersSettingsHandler(db *gorm.DB) *httpDelivery.UsersSettingsHandler {
	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	settingRepo := repository.NewSettingRepository(db)
	return httpDelivery.NewUsersSettingsHandler(usecase.NewUserAdminUsecase(userRepo, sessionRepo), usecase.NewSettingsUsecase(settingRepo))
}

func newAuthUsecase(db *gorm.DB, cfg *config.Config) *usecase.AuthUsecase {
	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	return usecase.NewAuthUsecase(userRepo, sessionRepo, cfg.JWTSecret, cfg.AccessTTL, cfg.RefreshTTL)
}

func newAuthHandler(authUsecase *usecase.AuthUsecase, cfg *config.Config) *httpDelivery.AuthHandler {
	return httpDelivery.NewAuthHandler(authUsecase, !cfg.IsDevelopment())
}

func newTableSessionUsecase(db *gorm.DB) *usecase.TableSessionUsecase {
	sessionRepo := repository.NewTableSessionRepository(db)
	tableRepo := repository.NewTableRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	return usecase.NewTableSessionUsecase(sessionRepo, tableRepo, auditRepo)
}

func newPublicHandler(db *gorm.DB, sessionUsecase *usecase.TableSessionUsecase) *httpDelivery.PublicHandler {
	tableRepo := repository.NewTableRepository(db)
	menuRepo := repository.NewMenuRepository(db)
	settingRepo := repository.NewSettingRepository(db)
	publicUsecase := usecase.NewPublicUsecase(tableRepo, menuRepo, settingRepo)
	return httpDelivery.NewPublicHandler(publicUsecase, sessionUsecase)
}

func newOrderHandler(db *gorm.DB) *httpDelivery.OrderHandler {
	orderRepo := repository.NewOrderRepository(db)
	menuRepo := repository.NewMenuRepository(db)
	settingRepo := repository.NewSettingRepository(db)
	withTx := func(ctx context.Context, fn func(usecase.OrderTx) error) error {
		return database.WithTx(ctx, db, func(tx *gorm.DB) error {
			return fn(repository.NewOrderRepository(tx))
		})
	}
	orderUsecase := usecase.NewOrderUsecase(orderRepo, menuRepo, settingRepo, withTx)
	return httpDelivery.NewOrderHandler(orderUsecase)
}
