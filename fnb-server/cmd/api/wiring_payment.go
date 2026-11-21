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
	"gorm.io/gorm"
)

func newSnapGateway(cfg *config.Config) domain.SnapGateway {
	if cfg.MidtransServerKey == "" {
		return nil
	}
	return repository.NewMidtransClient(cfg.MidtransServerKey, cfg.MidtransIsProduction)
}

func newOrderTxRunner(db *gorm.DB) usecase.TxRunner {
	return func(ctx context.Context, fn func(usecase.OrderTx) error) error {
		return database.WithTx(ctx, db, func(tx *gorm.DB) error {
			return fn(repository.NewOrderRepository(tx))
		})
	}
}

func newPaymentHandler(db *gorm.DB, cfg *config.Config, hub *usecase.Hub, log *slog.Logger) *httpDelivery.PaymentHandler {
	orderRepo := repository.NewOrderRepository(db)
	paymentUsecase := usecase.NewPaymentUsecase(orderRepo, newOrderTxRunner(db), cfg.MidtransServerKey, hub, log)
	return httpDelivery.NewPaymentHandler(paymentUsecase)
}
