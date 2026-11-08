package domain

import (
	"context"

	"github.com/google/uuid"
)

type MenuRepository interface {
	ListAvailableGroupedByCategory(ctx context.Context) ([]MenuCategory, error)
	ListAvailableByIDs(ctx context.Context, ids []uuid.UUID) ([]Menu, error)
}

type TableRepository interface {
	GetByQRToken(ctx context.Context, qrToken string) (*Table, error)
}

type SettingRepository interface {
	GetFirst(ctx context.Context) (*Setting, error)
}

type OrderRepository interface {
	GetByTrackingTokenHash(ctx context.Context, hash string) (*Order, error)
}
