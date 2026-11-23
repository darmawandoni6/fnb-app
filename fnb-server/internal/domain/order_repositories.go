package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type OrderFilter struct {
	Status        *OrderStatus
	TableID       *uuid.UUID
	SessionID     *uuid.UUID
	OrderType     *OrderType
	PaymentMethod *PaymentMethod
	Date          *time.Time
	DateLoc       *time.Location
	From          *time.Time
	To            *time.Time
	PaidOnly      bool
}

type OrderQueryRepository interface {
	List(ctx context.Context, filter OrderFilter) ([]Order, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Order, error)
	GetByOrderNumber(ctx context.Context, orderNumber string) (*Order, error)
	ListCashTimeoutIDs(ctx context.Context, q CashTimeoutQuery) ([]uuid.UUID, error)
	ListItemMoves(ctx context.Context, q ItemMoveQuery) ([]ItemMove, error)
}
