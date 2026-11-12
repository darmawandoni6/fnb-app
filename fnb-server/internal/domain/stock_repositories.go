package domain

import (
	"context"

	"github.com/google/uuid"
)

type IngredientRepository interface {
	List(ctx context.Context) ([]Ingredient, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Ingredient, error)
	Create(ctx context.Context, ingredient *Ingredient) error
	Update(ctx context.Context, ingredient *Ingredient) error
}

type RecipeItemRepository interface {
	List(ctx context.Context) ([]RecipeItem, error)
	GetByID(ctx context.Context, id uuid.UUID) (*RecipeItem, error)
	Create(ctx context.Context, item *RecipeItem) error
	Update(ctx context.Context, item *RecipeItem) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type MenuLookupRepository interface {
	GetByID(ctx context.Context, id uuid.UUID) (*Menu, error)
}
