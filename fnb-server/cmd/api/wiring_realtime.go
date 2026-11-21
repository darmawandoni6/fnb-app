package main

import (
	"context"
	"log/slog"

	httpDelivery "fnb-server/internal/delivery/http"
	"fnb-server/internal/repository"
	"fnb-server/internal/usecase"
	"gorm.io/gorm"
)

func newHub(ctx context.Context) *usecase.Hub {
	hub := usecase.NewHub()
	go hub.Run(ctx)
	return hub
}

func newWSHandler(db *gorm.DB, hub *usecase.Hub, authUsecase *usecase.AuthUsecase, sessionUsecase *usecase.TableSessionUsecase) *httpDelivery.WSHandler {
	return httpDelivery.NewWSHandler(hub, authUsecase, repository.NewOrderRepository(db), sessionUsecase)
}

func newSchedulerUsecase(db *gorm.DB, hub *usecase.Hub, log *slog.Logger) *usecase.SchedulerUsecase {
	orderRepo := repository.NewOrderRepository(db)
	sessionRepo := repository.NewTableSessionRepository(db)
	settingRepo := repository.NewSettingRepository(db)
	return usecase.NewSchedulerUsecase(orderRepo, newOrderTxRunner(db), sessionRepo, settingRepo, hub, nil, log)
}
