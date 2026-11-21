package usecase

import (
	"context"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

type Refund struct {
	ID             uuid.UUID
	OrderID        uuid.UUID
	ActorID        *uuid.UUID
	Reason         string
	SubtotalAmount int64
	TaxAmount      int64
	TotalAmount    int64
	PaymentMethod  domain.PaymentMethod
}

type OrderTx interface {
	CreateOrder(context.Context, *domain.Order) error
	CreateItems(context.Context, []domain.OrderItem) error
	ConsumeStock(context.Context, []domain.OrderItem) error
	PersistCancel(context.Context, *domain.Order, uuid.UUID, interface{}) error
	SetPayment(context.Context, uuid.UUID, domain.PaymentStatus, *domain.PaymentMethod) error
	SetItemStatus(ctx context.Context, orderID, itemID uuid.UUID, from, to domain.OrderItemStatus) error
	UpdateAggregate(context.Context, uuid.UUID, domain.OrderStatus) error
}

type TxRunner func(context.Context, func(OrderTx) error) error
