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
	handlers, authUsecase := newHandlers(db, cfg)
	return httpDelivery.NewRouterWithUpload(handlers, authUsecase, cfg.UploadDir, cfg.IsDevelopment(), log)
}

func newHandlers(db *gorm.DB, cfg *config.Config) (httpDelivery.Handlers, *usecase.AuthUsecase) {
	authUsecase := newAuthUsecase(db, cfg)
	categoryRepo := repository.NewMenuCategoryRepository(db)
	adminHandler := newAdminHandler(db, categoryRepo, cfg)
	handlers := httpDelivery.Handlers{
		Auth:   newAuthHandler(authUsecase, cfg),
		Public: newPublicHandler(db),
		Order:  newOrderHandler(db),
		Admin:  adminHandler,
	}
	return handlers, authUsecase
}

func newAdminHandler(db *gorm.DB, categoryRepo domain.MenuCategoryRepository, cfg *config.Config) *httpDelivery.AdminHandler {
	menuRepo := repository.NewMenuRepository(db)
	tableRepo := repository.NewTableRepository(db)
	return httpDelivery.NewAdminHandler(usecase.NewMenuCategoryUsecase(categoryRepo), usecase.NewMenuUsecase(menuRepo, categoryRepo), usecase.NewTableUsecase(tableRepo))
}

func newAuthUsecase(db *gorm.DB, cfg *config.Config) *usecase.AuthUsecase {
	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	return usecase.NewAuthUsecase(userRepo, sessionRepo, cfg.JWTSecret, cfg.AccessTTL, cfg.RefreshTTL)
}

func newAuthHandler(authUsecase *usecase.AuthUsecase, cfg *config.Config) *httpDelivery.AuthHandler {
	return httpDelivery.NewAuthHandler(authUsecase, !cfg.IsDevelopment())
}

func newPublicHandler(db *gorm.DB) *httpDelivery.PublicHandler {
	tableRepo := repository.NewTableRepository(db)
	menuRepo := repository.NewMenuRepository(db)
	settingRepo := repository.NewSettingRepository(db)
	orderRepo := repository.NewOrderRepository(db)
	withTx := func(ctx context.Context, fn func(usecase.OrderTx) error) error {
		return database.WithTx(ctx, db, func(tx *gorm.DB) error {
			return fn(repository.NewOrderRepository(tx))
		})
	}
	publicUsecase := usecase.NewPublicUsecase(tableRepo, menuRepo, settingRepo, orderRepo, withTx)
	return httpDelivery.NewPublicHandler(publicUsecase)
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
