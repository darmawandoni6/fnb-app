package main

import (
	"context"

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
