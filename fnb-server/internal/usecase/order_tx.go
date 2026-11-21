package usecase

import (
	"context"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

type OrderTx interface {
	NextOrderNumber(ctx context.Context, t domain.OrderType, day time.Time) (string, error)
	CreateOrder(ctx context.Context, o *domain.Order) error
	CreateItems(ctx context.Context, items []domain.OrderItem) error
	ConsumeStock(ctx context.Context, order *domain.Order, items []domain.OrderItem) error
	RestoreStock(ctx context.Context, order *domain.Order, items []domain.OrderItem) error
	SetItemStatus(ctx context.Context, orderID, itemID uuid.UUID, from, to domain.OrderItemStatus, actor *uuid.UUID) error
	CancelOrder(ctx context.Context, orderID uuid.UUID, reason string, actor *uuid.UUID) error
	UpdateAggregate(ctx context.Context, orderID uuid.UUID, status domain.OrderStatus) error
	Audit(ctx context.Context, entry *domain.AuditLog) error
}

type TxRunner func(context.Context, func(OrderTx) error) error
