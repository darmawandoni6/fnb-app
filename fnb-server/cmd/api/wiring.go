package main

import (
	"context"

	"fnb-server/internal/config"
	"fnb-server/internal/database"
	httpDelivery "fnb-server/internal/delivery/http"
	"fnb-server/internal/repository"
	"fnb-server/internal/usecase"
	"gorm.io/gorm"
)

func newAuthHandler(db *gorm.DB, cfg *config.Config) *httpDelivery.AuthHandler {
	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	authUsecase := usecase.NewAuthUsecase(userRepo, sessionRepo, cfg.JWTSecret, cfg.AccessTTL, cfg.RefreshTTL)
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
