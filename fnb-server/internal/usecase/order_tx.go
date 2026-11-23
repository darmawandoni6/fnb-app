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
	SaveSetting(ctx context.Context, setting *domain.Setting) error

	SetPaid(ctx context.Context, orderID uuid.UUID, method domain.PaymentMethod, ref *string, paidAt time.Time, amountReceived, changeAmount *int64) error
	CreatePaymentLog(ctx context.Context, log *domain.PaymentLog) error
	GetPendingPaymentLog(ctx context.Context, orderID uuid.UUID) (*domain.PaymentLog, error)
	GetPaymentLogByGatewayRef(ctx context.Context, ref string) (*domain.PaymentLog, error)
	UpdatePaymentLogStatus(ctx context.Context, id uuid.UUID, status domain.PaymentLogStatus, gatewayStatus *string, gatewayRef *string) error
}

type TxRunner func(context.Context, func(OrderTx) error) error
