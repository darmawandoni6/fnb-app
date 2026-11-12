package domain

import (
	"context"

	"github.com/google/uuid"
)

type AdminMenuRepository interface {
	List(ctx context.Context) ([]Menu, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Menu, error)
	Create(ctx context.Context, menu *Menu) error
	Update(ctx context.Context, menu *Menu) error
	Delete(ctx context.Context, id uuid.UUID) error
	CountByCategory(ctx context.Context, categoryID uuid.UUID) (int64, error)
}

type AdminTableRepository interface {
	List(ctx context.Context) ([]Table, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Table, error)
	Create(ctx context.Context, table *Table) error
	Update(ctx context.Context, table *Table) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type MenuCategoryRepository interface {
	List(ctx context.Context) ([]MenuCategory, error)
	GetByID(ctx context.Context, id uuid.UUID) (*MenuCategory, error)
	Create(ctx context.Context, category *MenuCategory) error
	Update(ctx context.Context, category *MenuCategory) error
	Delete(ctx context.Context, id uuid.UUID) error
	CountMenus(ctx context.Context, categoryID uuid.UUID) (int64, error)
}
