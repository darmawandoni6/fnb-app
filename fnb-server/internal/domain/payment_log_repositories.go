package domain

import (
	"context"

	"github.com/google/uuid"
)

type PaymentLogRepository interface {
	Create(ctx context.Context, log *PaymentLog) error
	GetByGatewayRef(ctx context.Context, ref string) (*PaymentLog, error)
	MarkSettled(ctx context.Context, id uuid.UUID, gatewayStatus string) error
	MarkExpired(ctx context.Context, id uuid.UUID, gatewayStatus string) error
}
