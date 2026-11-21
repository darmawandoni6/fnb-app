package usecase

import (
	"context"
	"testing"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

type adjustIngredientRepo struct{ ingredient *domain.Ingredient }

func (r *adjustIngredientRepo) List(context.Context) ([]domain.Ingredient, error) { return nil, nil }
func (r *adjustIngredientRepo) GetByID(context.Context, uuid.UUID) (*domain.Ingredient, error) {
	return r.ingredient, nil
}
func (r *adjustIngredientRepo) Create(context.Context, *domain.Ingredient) error { return nil }
func (r *adjustIngredientRepo) Update(context.Context, *domain.Ingredient) error { return nil }

type adjustStockTx struct {
	current  float64
	set      *float64
	movement *domain.StockMovement
}

func (t *adjustStockTx) UpdateStock(context.Context, uuid.UUID, float64) error { return nil }
func (t *adjustStockTx) CreateMovement(_ context.Context, m *domain.StockMovement) error {
	t.movement = m
	return nil
}
func (t *adjustStockTx) CountStock(context.Context, uuid.UUID) (float64, error) {
	return t.current, nil
}
func (t *adjustStockTx) SetStock(_ context.Context, _ uuid.UUID, qty float64) error {
	t.set = &qty
	return nil
}

func runAdjust(t *testing.T, current, counted float64) (*adjustStockTx, float64, error) {
	t.Helper()
	ingredient := &domain.Ingredient{ID: uuid.New(), Name: "Biji Kopi", Unit: "g", StockQty: current}
	tx := &adjustStockTx{current: current}
	uc := NewIngredientUsecase(&adjustIngredientRepo{ingredient: ingredient}, func(ctx context.Context, fn func(StockTx) error) error {
		return fn(tx)
	}, nil)
	delta, err := uc.Adjust(context.Background(), ingredient.ID, counted, nil)
	return tx, delta, err
}

func TestIngredientAdjust_ReplacesStockWithSignedDelta(t *testing.T) {
	tx, delta, err := runAdjust(t, 100, 60)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if delta != -40 {
		t.Errorf("expected delta -40, got %v", delta)
	}
	if tx.set == nil || *tx.set != 60 {
		t.Errorf("expected stock replaced with 60, got %v", tx.set)
	}
	if tx.movement.Type != domain.StockMovementAdjustment || tx.movement.Qty != -40 {
		t.Errorf("expected negative ADJUSTMENT movement, got %+v", tx.movement)
	}

	tx, delta, err = runAdjust(t, 10, 25)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if delta != 15 || tx.movement.Qty != 15 {
		t.Errorf("expected +15 adjustment, got delta %v movement %v", delta, tx.movement.Qty)
	}
}

func TestIngredientAdjust_RejectsUnchangedCount(t *testing.T) {
	tx, _, err := runAdjust(t, 42, 42)
	if err == nil {
		t.Fatal("expected an error when counted stock equals current stock")
	}
	if tx.movement != nil {
		t.Error("no movement must be written for an unchanged count")
	}
}

type recipeSettingsRepo struct{ setting *domain.Setting }

func (r recipeSettingsRepo) GetFirst(context.Context) (*domain.Setting, error) { return r.setting, nil }

type emptyRecipeRepo struct{}

func (emptyRecipeRepo) List(context.Context) ([]domain.RecipeItem, error) { return nil, nil }
func (emptyRecipeRepo) GetByID(context.Context, uuid.UUID) (*domain.RecipeItem, error) {
	return nil, nil
}
func (emptyRecipeRepo) Create(context.Context, *domain.RecipeItem) error { return nil }
func (emptyRecipeRepo) Update(context.Context, *domain.RecipeItem) error { return nil }
func (emptyRecipeRepo) Delete(context.Context, uuid.UUID) error          { return nil }

func TestRecipeMutations_BlockedWhileStoreOpen(t *testing.T) {
	open := NewRecipeItemUsecase(emptyRecipeRepo{}, nil, nil, recipeSettingsRepo{&domain.Setting{IsOpen: true}})
	if err := open.Delete(context.Background(), uuid.New()); err == nil {
		t.Fatal("expected STORE_CLOSED while the store is open")
	}

	closed := NewRecipeItemUsecase(emptyRecipeRepo{}, nil, nil, recipeSettingsRepo{&domain.Setting{IsOpen: false}})
	err := closed.Delete(context.Background(), uuid.New())
	if err == nil || err.Error() != "recipe item not found" {
		t.Fatalf("expected the gate to pass and the lookup to fail, got %v", err)
	}
}

type settingsRepo struct{ setting *domain.Setting }

func (r *settingsRepo) GetFirst(context.Context) (*domain.Setting, error) { return r.setting, nil }
func (r *settingsRepo) Update(_ context.Context, s *domain.Setting) error {
	r.setting = s
	return nil
}

func validSetting() *domain.Setting {
	return &domain.Setting{
		CafeName:                       "Demo",
		ServiceRate:                    5,
		TaxRate:                        10,
		IsOpen:                         true,
		CashTimeoutMinutes:             15,
		DeliveredAutoCompleteMinutes:   5,
		ReadyAutoDeliverMinutes:        10,
		ReadyAutoDeliverWarningMinutes: 2,
	}
}

func TestSettingsUpdate_ValidatesAcrossFields(t *testing.T) {
	repo := &settingsRepo{setting: validSetting()}
	uc := NewSettingsUsecase(repo)

	in := validSetting()
	in.CafeName = "Renamed"
	in.CashTimeoutMinutes = 20
	if _, err := uc.Update(context.Background(), in); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.setting.CafeName != "Renamed" || repo.setting.CashTimeoutMinutes != 20 {
		t.Errorf("update not persisted: %+v", repo.setting)
	}

	warn := validSetting()
	warn.ReadyAutoDeliverWarningMinutes = warn.ReadyAutoDeliverMinutes
	if _, err := uc.Update(context.Background(), warn); err == nil {
		t.Error("expected warning >= deliver to be rejected")
	}

	rate := validSetting()
	rate.TaxRate = 150
	if _, err := uc.Update(context.Background(), rate); err == nil {
		t.Error("expected tax rate above 100 to be rejected")
	}
}
