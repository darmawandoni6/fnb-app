package main

import (
	"log/slog"

	"fnb-server/internal/config"
	httpDelivery "fnb-server/internal/delivery/http"
	"fnb-server/internal/domain"
	"fnb-server/internal/repository"
	"fnb-server/internal/usecase"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

func newRouter(db *gorm.DB, cfg *config.Config, hub *usecase.Hub, log *slog.Logger) *echo.Echo {
	handlers, authUsecase, sessionUsecase := newHandlers(db, cfg, hub, log)
	return httpDelivery.NewRouterWithUpload(handlers, authUsecase, sessionUsecase, cfg.UploadDir, cfg.IsDevelopment(), log)
}

func newHandlers(db *gorm.DB, cfg *config.Config, hub *usecase.Hub, log *slog.Logger) (httpDelivery.Handlers, *usecase.AuthUsecase, *usecase.TableSessionUsecase) {
	authUsecase := newAuthUsecase(db, cfg)
	sessionUsecase := newTableSessionUsecase(db)
	categoryRepo := repository.NewMenuCategoryRepository(db)
	adminHandler := newAdminHandler(db, categoryRepo, sessionUsecase, hub, cfg)
	handlers := httpDelivery.Handlers{
		Auth:    newAuthHandler(authUsecase, cfg),
		Public:  newPublicHandler(db, sessionUsecase, hub, cfg),
		Order:   newOrderHandler(db, cfg, hub, log),
		Payment: newPaymentHandler(db, cfg, hub, log),
		Admin:   adminHandler,
		Stock:   newStockHandler(db),
		Users:   newUsersSettingsHandler(db),
		WS:      newWSHandler(db, hub, authUsecase, sessionUsecase),
		Audit:   httpDelivery.NewAuditHandler(usecase.NewAuditUsecase(repository.NewAuditRepository(db))),
		Report:  newReportHandler(db),
	}
	return handlers, authUsecase, sessionUsecase
}

func newAdminHandler(db *gorm.DB, categoryRepo domain.MenuCategoryRepository, sessionUsecase *usecase.TableSessionUsecase, hub *usecase.Hub, cfg *config.Config) *httpDelivery.AdminHandler {
	menuRepo := repository.NewMenuRepository(db)
	tableRepo := repository.NewTableRepository(db)
	return httpDelivery.NewAdminHandler(usecase.NewMenuCategoryUsecase(categoryRepo), usecase.NewMenuUsecase(menuRepo, categoryRepo), usecase.NewTableUsecase(tableRepo), sessionUsecase, hub, cfg.UploadDir)
}

func newStockHandler(db *gorm.DB) *httpDelivery.StockHandler {
	ingredientRepo := repository.NewIngredientRepository(db)
	recipeRepo := repository.NewRecipeItemRepository(db)
	menuRepo := repository.NewMenuRepository(db)
	movementRepo := repository.NewStockMovementRepository(db)
	settingRepo := repository.NewSettingRepository(db)
	ingredientUsecase := usecase.NewIngredientUsecase(ingredientRepo, repository.NewStockTx(db), movementRepo)
	recipeUsecase := usecase.NewRecipeItemUsecase(recipeRepo, menuRepo, ingredientRepo, settingRepo)
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

func newPublicHandler(db *gorm.DB, sessionUsecase *usecase.TableSessionUsecase, hub *usecase.Hub, cfg *config.Config) *httpDelivery.PublicHandler {
	tableRepo := repository.NewTableRepository(db)
	menuRepo := repository.NewMenuRepository(db)
	settingRepo := repository.NewSettingRepository(db)
	orderRepo := repository.NewOrderRepository(db)
	publicUsecase := usecase.NewPublicUsecase(tableRepo, menuRepo, settingRepo, orderRepo, newOrderTxRunner(db), hub, newSnapGateway(cfg), nil, cfg.Location())
	return httpDelivery.NewPublicHandler(publicUsecase, sessionUsecase)
}

func newOrderHandler(db *gorm.DB, cfg *config.Config, hub *usecase.Hub, log *slog.Logger) *httpDelivery.OrderHandler {
	orderRepo := repository.NewOrderRepository(db)
	menuRepo := repository.NewMenuRepository(db)
	settingRepo := repository.NewSettingRepository(db)
	orderUsecase := usecase.NewOrderUsecase(orderRepo, menuRepo, settingRepo, newOrderTxRunner(db), hub, newSnapGateway(cfg), log, cfg.Location())
	return httpDelivery.NewOrderHandler(orderUsecase)
}

func newReportHandler(db *gorm.DB) *httpDelivery.ReportHandler {
	reports := usecase.NewReportUsecase(repository.NewReportRepository(db), repository.NewOrderRepository(db))
	return httpDelivery.NewReportHandler(reports)
}
