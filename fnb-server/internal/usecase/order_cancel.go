package usecase

import (
	"context"
	"net/http"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

func cancelOrderHelper(
	ctx context.Context,
	orderRepo domain.OrderQueryRepository,
	withTx TxRunner,
	publisher domain.Publisher,
	orderID uuid.UUID,
	reason string,
	actorID *uuid.UUID,
	actorRole *domain.UserRole,
) (*domain.Order, error) {
	order, err := orderRepo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, domain.NewError(domain.CodeNotFound, "order not found", http.StatusNotFound, nil)
	}

	if order.PaymentStatus != domain.PaymentStatusUnpaid || order.CanceledAt != nil {
		return nil, domain.NewError(domain.CodeInvalidTransition, "order cannot be cancelled", http.StatusConflict, nil)
	}

	err = withTx(ctx, func(tx OrderTx) error {
		return cancelOrderInTx(ctx, tx, order, reason, actorID, actorRole)
	})
	if err != nil {
		return nil, err
	}
	markCancelled(order, reason, time.Now().UTC())

	if publisher != nil {
		publisher.PublishOrder(ctx, domain.OrderEvent{Event: "order.updated", Order: order})
		if order.TableSession != nil && order.TableSession.SessionToken != "" {
			publisher.PublishSession(ctx, order.TableSession.SessionToken, domain.OrderEvent{Event: "order.updated", Order: order})
		}
	}

	return order, nil
}

func cancelOrderInTx(
	ctx context.Context,
	tx OrderTx,
	order *domain.Order,
	reason string,
	actorID *uuid.UUID,
	actorRole *domain.UserRole,
) error {
	if err := tx.RestoreStock(ctx, order, order.Items); err != nil {
		return err
	}
	if err := tx.CancelOrder(ctx, order.ID, reason, actorID); err != nil {
		return err
	}
	if err := tx.UpdateAggregate(ctx, order.ID, domain.OrderStatusCancelled); err != nil {
		return err
	}
	audit := &domain.AuditLog{
		Entity:    "order",
		EntityID:  order.ID,
		Action:    "order_cancelled",
		ToValue:   &reason,
		ActorID:   actorID,
		ActorRole: actorRole,
	}
	return tx.Audit(ctx, audit)
}

func markCancelled(order *domain.Order, reason string, at time.Time) {
	order.Status = domain.OrderStatusCancelled
	order.CancelReason = &reason
	order.CanceledAt = &at
	for i := range order.Items {
		order.Items[i].Status = domain.OrderItemStatusCancelled
		order.Items[i].CancelledAt = &at
	}
}
