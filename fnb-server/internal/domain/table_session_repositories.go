package domain

import (
	"context"

	"github.com/google/uuid"
)

type TableSessionRepository interface {
	GetOpenByTableID(ctx context.Context, tableID uuid.UUID) (*TableSession, error)
	GetBySessionToken(ctx context.Context, token string) (*TableSession, error)
	Create(ctx context.Context, session *TableSession) error
	Close(ctx context.Context, id uuid.UUID, closedBy *uuid.UUID) error
	ListIdleOpen(ctx context.Context, q IdleSessionQuery) ([]TableSession, error)
}
