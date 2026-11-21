package usecase

import (
	"context"
	"net/http"
	"strings"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
	"golang.org/x/sync/errgroup"
)

type StockTx interface {
	UpdateStock(ctx context.Context, ingredientID uuid.UUID, delta float64) error
	CreateMovement(ctx context.Context, movement *domain.StockMovement) error
	CountStock(ctx context.Context, ingredientID uuid.UUID) (float64, error)
	SetStock(ctx context.Context, ingredientID uuid.UUID, qty float64) error
}

type StockTxRunner func(context.Context, func(StockTx) error) error

type IngredientUsecase struct {
	repo      domain.IngredientRepository
	txRun     StockTxRunner
	movements domain.StockMovementRepository
}

func NewIngredientUsecase(repo domain.IngredientRepository, txRun StockTxRunner, movements domain.StockMovementRepository) *IngredientUsecase {
	return &IngredientUsecase{repo: repo, txRun: txRun, movements: movements}
}

func (u *IngredientUsecase) List(ctx context.Context) ([]domain.Ingredient, error) {
	return u.repo.List(ctx)
}

func validateIngredient(i *domain.Ingredient) error {
	if strings.TrimSpace(i.Name) == "" {
		return domain.NewError(domain.CodeValidationError, "ingredient name is required", http.StatusBadRequest, nil)
	}
	if strings.TrimSpace(i.Unit) == "" {
		return domain.NewError(domain.CodeValidationError, "ingredient unit is required", http.StatusBadRequest, nil)
	}
	if i.MinStock < 0 {
		return domain.NewError(domain.CodeValidationError, "minimum stock cannot be negative", http.StatusBadRequest, nil)
	}
	return nil
}

func (u *IngredientUsecase) Create(ctx context.Context, i *domain.Ingredient) error {
	if err := validateIngredient(i); err != nil {
		return err
	}
	return u.repo.Create(ctx, i)
}

func (u *IngredientUsecase) Update(ctx context.Context, i *domain.Ingredient) error {
	if err := validateIngredient(i); err != nil {
		return err
	}
	old, err := u.repo.GetByID(ctx, i.ID)
	if err != nil {
		return err
	}
	if old == nil {
		return notFound("ingredient")
	}
	i.StockQty = old.StockQty
	return u.repo.Update(ctx, i)
}

func (u *IngredientUsecase) Restock(ctx context.Context, id uuid.UUID, qty float64, note *string) error {
	if qty <= 0 {
		return domain.NewError(domain.CodeValidationError, "restock quantity must be greater than zero", http.StatusBadRequest, nil)
	}
	i, err := u.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if i == nil {
		return notFound("ingredient")
	}
	return u.txRun(ctx, func(tx StockTx) error {
		if err := tx.UpdateStock(ctx, id, qty); err != nil {
			return err
		}
		return tx.CreateMovement(ctx, &domain.StockMovement{IngredientID: id, Qty: qty, Type: domain.StockMovementIn, Note: note})
	})
}

func (u *IngredientUsecase) Adjust(ctx context.Context, id uuid.UUID, stockQty float64, note *string) (float64, error) {
	if stockQty < 0 {
		return 0, domain.NewError(domain.CodeValidationError, "stock quantity cannot be negative", http.StatusBadRequest, nil)
	}
	i, err := u.repo.GetByID(ctx, id)
	if err != nil {
		return 0, err
	}
	if i == nil {
		return 0, notFound("ingredient")
	}
	var delta float64
	err = u.txRun(ctx, func(tx StockTx) error {
		current, err := tx.CountStock(ctx, id)
		if err != nil {
			return err
		}
		delta = stockQty - current
		if delta == 0 {
			return domain.NewError(domain.CodeValidationError, "counted stock equals current stock", http.StatusBadRequest, nil)
		}
		if err := tx.SetStock(ctx, id, stockQty); err != nil {
			return err
		}
		return tx.CreateMovement(ctx, &domain.StockMovement{IngredientID: id, Qty: delta, Type: domain.StockMovementAdjustment, Note: note})
	})
	if err != nil {
		return 0, err
	}
	return delta, nil
}

type stockSettings interface {
	GetFirst(ctx context.Context) (*domain.Setting, error)
}

func (u *IngredientUsecase) Movements(ctx context.Context, filter domain.StockMovementFilter) ([]domain.StockMovement, error) {
	return u.movements.List(ctx, filter, 200)
}

type menuLookup interface {
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Menu, error)
}

type RecipeItemUsecase struct {
	repo        domain.RecipeItemRepository
	menus       menuLookup
	ingredients domain.IngredientRepository
	settings    stockSettings
}

func NewRecipeItemUsecase(repo domain.RecipeItemRepository, menus menuLookup, ingredients domain.IngredientRepository, settings stockSettings) *RecipeItemUsecase {
	return &RecipeItemUsecase{repo: repo, menus: menus, ingredients: ingredients, settings: settings}
}

func (u *RecipeItemUsecase) requireClosed(ctx context.Context) error {
	if u.settings == nil {
		return nil
	}
	s, err := u.settings.GetFirst(ctx)
	if err != nil {
		return err
	}
	if s != nil && s.IsOpen {
		return domain.NewError(domain.CodeStoreClosed, "recipe cannot be changed while the store is open", http.StatusConflict, nil)
	}
	return nil
}

func (u *RecipeItemUsecase) List(ctx context.Context) ([]domain.RecipeItem, error) {
	return u.repo.List(ctx)
}

func (u *RecipeItemUsecase) Create(ctx context.Context, item *domain.RecipeItem) error {
	if err := u.requireClosed(ctx); err != nil {
		return err
	}
	if item.QtyUsed <= 0 {
		return domain.NewError(domain.CodeValidationError, "recipe quantity must be greater than zero", http.StatusBadRequest, nil)
	}
	g, gctx := errgroup.WithContext(ctx)
	var menu *domain.Menu
	var ingredient *domain.Ingredient
	g.Go(func() error { var err error; menu, err = u.menus.GetByID(gctx, item.MenuID); return err })
	g.Go(func() error {
		var err error
		ingredient, err = u.ingredients.GetByID(gctx, item.IngredientID)
		return err
	})
	if err := g.Wait(); err != nil {
		return err
	}
	if menu == nil {
		return notFound("menu")
	}
	if ingredient == nil {
		return notFound("ingredient")
	}
	if err := u.repo.Create(ctx, item); err != nil {
		if isUnique(err) {
			return domain.NewError(domain.CodeValidationError, "recipe item already exists", http.StatusConflict, err)
		}
		return err
	}
	return nil
}

func (u *RecipeItemUsecase) Update(ctx context.Context, item *domain.RecipeItem) error {
	if err := u.requireClosed(ctx); err != nil {
		return err
	}
	if item.QtyUsed <= 0 {
		return domain.NewError(domain.CodeValidationError, "recipe quantity must be greater than zero", http.StatusBadRequest, nil)
	}
	old, err := u.repo.GetByID(ctx, item.ID)
	if err != nil {
		return err
	}
	if old == nil {
		return notFound("recipe item")
	}
	item.MenuID = old.MenuID
	item.IngredientID = old.IngredientID
	if err := u.repo.Update(ctx, item); err != nil {
		if isUnique(err) {
			return domain.NewError(domain.CodeValidationError, "recipe item already exists", http.StatusConflict, err)
		}
		return err
	}
	return nil
}

func (u *RecipeItemUsecase) Delete(ctx context.Context, id uuid.UUID) error {
	if err := u.requireClosed(ctx); err != nil {
		return err
	}
	item, err := u.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if item == nil {
		return notFound("recipe item")
	}
	return u.repo.Delete(ctx, id)
}
