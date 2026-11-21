package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type AuditFilter struct {
	Entity   *string
	EntityID *uuid.UUID
	ActorID  *uuid.UUID
	From     *time.Time
	To       *time.Time
}

type AuditRepository interface {
	Create(ctx context.Context, log *AuditLog) error
	List(ctx context.Context, filter AuditFilter, limit int) ([]AuditLog, error)
}
