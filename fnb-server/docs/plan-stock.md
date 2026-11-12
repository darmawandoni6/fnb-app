# Plan: Internal — Stock

Source: `../../docs/api.md` (Internal — stock), `../../docs/PRD.md` §4/§9, `../../docs/flow.md`.

## Scope

Implement 8 OWNER/CASHIER stock endpoints:

| Method | Path | Role |
|---|---|---|
| `GET` | `/ingredients` | `CASHIER`, `OWNER` |
| `POST` | `/ingredients` | `OWNER` |
| `PATCH` | `/ingredients/:id` | `OWNER` |
| `POST` | `/ingredients/:id/restock` | `OWNER` |
| `GET` | `/recipe-items` | `CASHIER`, `OWNER` |
| `POST` | `/recipe-items` | `OWNER` |
| `PATCH` | `/recipe-items/:id` | `OWNER` |
| `DELETE` | `/recipe-items/:id` | `OWNER` |

Existing domain structs: `Ingredient`, `RecipeItem`, `StockMovement`. Existing migration tables support required data.

## Decisions

- Restock writes positive `qty` and movement type `IN`.
- Restock stock update and movement insert run in one transaction.
- Recipe edits remain ungated by `settings.is_open` in this pass. PRD mentions closed-store recipe editing, but API draft does not define this behavior; add gate when confirmed.
- Recipe item delete is hard delete. No historical table references recipe rows.
- Ingredient update changes `name`, `unit`, and `min_stock`; `stock_qty` changes only through restock.
- Duplicate `(menu_id, ingredient_id)` uses database unique constraint and returns `409 VALIDATION_ERROR`.
- Stock quantities use existing `float64` domain fields and PostgreSQL `numeric` columns.
- Ingredient deletion is out of scope.

## Concurrency

Use explicit concurrency only where independent I/O exists:

- Recipe create validates menu and ingredient existence concurrently with `errgroup.WithContext`.
- Validation reads use the base repository connection before any transaction.
- Restock remains sequential inside one transaction.
- CRUD remains sequential.
- Never share a transaction `*gorm.DB` across goroutines.

Promote existing `golang.org/x/sync` dependency to direct use if needed by implementation.

## Domain

Add `internal/domain/stock_repositories.go`:

```go
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
```

Add transaction-scoped interface in the usecase layer:

```go
type StockTx interface {
    UpdateStock(ctx context.Context, ingredientID uuid.UUID, delta float64) error
    CreateMovement(ctx context.Context, movement *domain.StockMovement) error
}
```

Reuse existing `TxRunner` and `database.WithTx` pattern.

## Repository

Add `internal/repository/stock_repository.go`:

- Ingredient CRUD; list ordered by name.
- Recipe item CRUD; list with `Preload("Menu", "Ingredient")`.
- Stock transaction implementation:
  - Update `stock_qty` with `gorm.Expr("stock_qty + ?", delta)`.
  - Insert `StockMovement`.
- Keep business validation in usecases.

Extend the menu repository interface/implementation with `GetByID` for recipe validation if no suitable existing menu lookup exists.

## Usecases

Add `internal/usecase/stock_usecase.go`.

### Ingredient usecase

- List ingredients.
- Create with non-empty `name`, non-empty `unit`, `min_stock >= 0`.
- Update with same validation; return `NOT_FOUND` when missing.
- Restock with `qty > 0`; return `NOT_FOUND` when ingredient is missing.
- Transaction sequence: update stock, then create `IN` movement with positive quantity and optional note.

### Recipe item usecase

- List recipe items.
- Create with `qty_used > 0`.
- Verify menu and ingredient exist.
- Run independent menu and ingredient existence checks concurrently with `errgroup.WithContext`.
- Return `NOT_FOUND` for missing menu or ingredient.
- Map duplicate pair constraint to `409 VALIDATION_ERROR`.
- Update quantity with `qty_used > 0`; return `NOT_FOUND` when missing.
- Delete existing recipe item.

## Delivery

Add:

- `internal/delivery/http/dto/stock.go`
- `internal/delivery/http/stock_handler.go`

DTOs:

```go
type IngredientRequest struct {
    Name     string  `json:"name" validate:"required"`
    Unit     string  `json:"unit" validate:"required"`
    MinStock float64 `json:"min_stock" validate:"gte=0"`
}

type RestockRequest struct {
    Qty  float64 `json:"qty" validate:"gt=0"`
    Note *string  `json:"note"`
}

type RecipeItemRequest struct {
    MenuID       string  `json:"menu_id" validate:"required"`
    IngredientID string  `json:"ingredient_id" validate:"required"`
    QtyUsed      float64 `json:"qty_used" validate:"gt=0"`
}
```

Handlers must parse UUID path parameters, bind through the standard binder, call usecases, and respond through `httpDelivery.Success`.

Register JWT-protected routes with per-route roles:

```text
GET    /ingredients             CASHIER, OWNER
POST   /ingredients             OWNER
PATCH  /ingredients/:id         OWNER
POST   /ingredients/:id/restock OWNER
GET    /recipe-items            CASHIER, OWNER
POST   /recipe-items            OWNER
PATCH  /recipe-items/:id        OWNER
DELETE /recipe-items/:id        OWNER
```

## Wiring

Add `Stock *StockHandler` to HTTP handlers. Construct stock repositories, usecases, and transaction runner in `cmd/api/wiring.go`. Keep repository and usecase construction outside delivery.

## Tests

Add focused usecase tests for:

- Ingredient name/unit validation.
- Negative `min_stock` rejection.
- Restock quantity validation.
- Missing ingredient returns `NOT_FOUND`.
- Restock writes positive `IN` movement.
- Missing menu or ingredient during recipe creation.
- Invalid `qty_used`.
- Duplicate recipe pair returns `VALIDATION_ERROR` with HTTP 409.
- Missing recipe item on update/delete.
- Concurrent recipe validation invokes both independent repository checks.

## Verification

```bash
go test -race ./...
go build ./...
```

## Sequence

1. Add concurrency rules documentation.
2. Add domain repository interfaces.
3. Implement repositories and stock transaction.
4. Implement usecases and focused tests.
5. Add DTOs and handlers.
6. Wire routes and dependencies.
7. Run race-enabled tests and build.
