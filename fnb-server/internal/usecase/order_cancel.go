package usecase

import (
	"context"
	"math"
	"net/http"
	"time"

	"fnb-server/internal/domain"

	"github.com/google/uuid"
)

func cancelOrderItem(
	ctx context.Context,
	order *domain.Order,
	itemID uuid.UUID,
	refundActor *uuid.UUID,
	reason string,
	withTx TxRunner,
) (*domain.Order, error) {
	var target *domain.OrderItem
	for i := range order.Items {
		if order.Items[i].ID == itemID {
			target = &order.Items[i]
			break
		}
	}
	if target == nil {
		return nil, domain.NewError(domain.CodeNotFound, "order item not found", http.StatusNotFound, nil)
	}
	if target.Status != domain.OrderItemStatusPending {
		return nil, domain.NewError(domain.CodeInvalidTransition, "item cannot be cancelled", http.StatusConflict, nil)
	}

	refund := (*domain.Refund)(nil)
	if order.PaymentStatus == domain.PaymentStatusPaid {
		paymentMethod := domain.PaymentMethodCash
		if order.PaymentMethod != nil {
			paymentMethod = *order.PaymentMethod
		}
		subtotal := target.Price * int64(target.Qty)
		tax := int64(math.Round(float64(subtotal) * order.TaxPercent / 100))
		refund = &domain.Refund{
			Reason:         reason,
			SubtotalAmount: subtotal,
			TaxAmount:      tax,
			TotalAmount:    subtotal + tax,
			PaymentMethod:  paymentMethod,
			ActorID:        refundActor,
		}
		order.SubtotalAmount = maxInt64(0, order.SubtotalAmount-subtotal)
		order.TaxAmount = maxInt64(0, order.TaxAmount-tax)
		order.TotalAmount = maxInt64(0, order.TotalAmount-(subtotal+tax))
	}

	target.Status = domain.OrderItemStatusCancelled
	target.CancelledAt = timePtr(time.Now().UTC())

	active := false
	for _, item := range order.Items {
		if item.ID != itemID && item.Status != domain.OrderItemStatusCancelled {
			active = true
			break
		}
	}
	if !active {
		order.Status = domain.OrderStatusCancelled
		order.SubtotalAmount, order.TaxAmount, order.TotalAmount = 0, 0, 0
	}

	if err := withTx(ctx, func(tx OrderTx) error {
		return tx.PersistCancel(ctx, order, itemID, refund)
	}); err != nil {
		return nil, err
	}

	return order, nil
}

//go:fix inline
func timePtr(v time.Time) *time.Time { return new(v) }
func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
