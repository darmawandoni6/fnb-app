package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type OrderFilter struct {
	Status   *OrderStatus
	TableID  *uuid.UUID
	Date     *time.Time
	PaidOnly bool
}

type OrderQueryRepository interface {
	List(ctx context.Context, filter OrderFilter) ([]Order, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Order, error)
}
