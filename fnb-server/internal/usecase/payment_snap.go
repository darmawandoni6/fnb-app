package usecase

import (
	"context"
	"log/slog"

	"fnb-server/internal/domain"
)

func attachSnap(ctx context.Context, gateway domain.SnapGateway, order *domain.Order, items []domain.OrderItem, log *slog.Logger) {
	if gateway == nil || order.PaymentMethod == nil || *order.PaymentMethod != domain.PaymentMethodNonCash {
		return
	}
	snap, err := gateway.CreateSnap(ctx, domain.BuildSnapRequest(order, items))
	if err != nil {
		if log != nil {
			log.Warn("snap creation failed", "order_number", order.OrderNumber, "error", err)
		}
		return
	}
	order.SnapToken = &snap.Token
	order.PaymentURL = &snap.RedirectURL
}

func pendingPaymentLog(order *domain.Order) *domain.PaymentLog {
	if order.PaymentMethod == nil || *order.PaymentMethod != domain.PaymentMethodNonCash {
		return nil
	}
	gateway := domain.PaymentGatewayMidtrans
	return &domain.PaymentLog{
		OrderID: order.ID,
		Method:  domain.PaymentMethodNonCash,
		Gateway: &gateway,
		Amount:  order.TotalAmount,
		Status:  domain.PaymentLogStatusPending,
	}
}
