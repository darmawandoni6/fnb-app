package repository

import (
	"context"

	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type IngredientRepository struct{ db *gorm.DB }

func NewIngredientRepository(db *gorm.DB) *IngredientRepository { return &IngredientRepository{db: db} }
func (r *IngredientRepository) List(ctx context.Context) ([]domain.Ingredient, error) {
	var ingredients []domain.Ingredient
	err := r.db.WithContext(ctx).Order("name").Find(&ingredients).Error
	return ingredients, err
}
func (r *IngredientRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Ingredient, error) {
	var ingredient domain.Ingredient
	err := r.db.WithContext(ctx).First(&ingredient, "id = ?", id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &ingredient, err
}
func (r *IngredientRepository) Create(ctx context.Context, ingredient *domain.Ingredient) error {
	return r.db.WithContext(ctx).Create(ingredient).Error
}
func (r *IngredientRepository) Update(ctx context.Context, ingredient *domain.Ingredient) error {
	return r.db.WithContext(ctx).Save(ingredient).Error
}

type StockMovementRepository struct{ db *gorm.DB }

func NewStockMovementRepository(db *gorm.DB) *StockMovementRepository {
	return &StockMovementRepository{db: db}
}
func (r *StockMovementRepository) List(ctx context.Context, filter domain.StockMovementFilter, limit int) ([]domain.StockMovement, error) {
	var movements []domain.StockMovement
	q := r.db.WithContext(ctx).Model(&domain.StockMovement{})
	if filter.IngredientID != nil {
		q = q.Where("ingredient_id = ?", *filter.IngredientID)
	}
	if filter.Type != nil {
		q = q.Where("type = ?", *filter.Type)
	}
	if filter.From != nil {
		q = q.Where("created_at >= ?", *filter.From)
	}
	if filter.To != nil {
		q = q.Where("created_at <= ?", *filter.To)
	}
	err := q.Order("created_at DESC").Limit(limit).Find(&movements).Error
	return movements, err
}

type RecipeItemRepository struct{ db *gorm.DB }

func NewRecipeItemRepository(db *gorm.DB) *RecipeItemRepository { return &RecipeItemRepository{db: db} }
func (r *RecipeItemRepository) List(ctx context.Context) ([]domain.RecipeItem, error) {
	var items []domain.RecipeItem
	err := r.db.WithContext(ctx).Preload("Menu").Preload("Ingredient").Find(&items).Error
	return items, err
}
func (r *RecipeItemRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.RecipeItem, error) {
	var item domain.RecipeItem
	err := r.db.WithContext(ctx).Preload("Menu").Preload("Ingredient").First(&item, "id = ?", id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &item, err
}
func (r *RecipeItemRepository) Create(ctx context.Context, item *domain.RecipeItem) error {
	return r.db.WithContext(ctx).Create(item).Error
}
func (r *RecipeItemRepository) Update(ctx context.Context, item *domain.RecipeItem) error {
	return r.db.WithContext(ctx).Save(item).Error
}
func (r *RecipeItemRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&domain.RecipeItem{}, "id = ?", id).Error
}

type stockTx struct{ db *gorm.DB }

func (t *stockTx) UpdateStock(ctx context.Context, id uuid.UUID, delta float64) error {
	return t.db.WithContext(ctx).Model(&domain.Ingredient{}).Where("id = ?", id).UpdateColumn("stock_qty", gorm.Expr("stock_qty + ?", delta)).Error
}
func (t *stockTx) CreateMovement(ctx context.Context, movement *domain.StockMovement) error {
	return t.db.WithContext(ctx).Create(movement).Error
}
func (t *stockTx) CountStock(ctx context.Context, ingredientID uuid.UUID) (float64, error) {
	var qty float64
	err := t.db.WithContext(ctx).Model(&domain.Ingredient{}).Where("id = ?", ingredientID).Select("stock_qty").Scan(&qty).Error
	return qty, err
}
func (t *stockTx) SetStock(ctx context.Context, ingredientID uuid.UUID, qty float64) error {
	return t.db.WithContext(ctx).Model(&domain.Ingredient{}).Where("id = ?", ingredientID).UpdateColumn("stock_qty", qty).Error
}

func NewStockTx(db *gorm.DB) usecase.StockTxRunner {
	return func(ctx context.Context, fn func(usecase.StockTx) error) error {
		return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error { return fn(&stockTx{db: tx}) })
	}
}
