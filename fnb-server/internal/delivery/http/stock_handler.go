package http

import (
	"net/http"

	"fnb-server/internal/delivery/http/dto"
	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type StockHandler struct {
	ingredients *usecase.IngredientUsecase
	recipes     *usecase.RecipeItemUsecase
}

func NewStockHandler(i *usecase.IngredientUsecase, r *usecase.RecipeItemUsecase) *StockHandler {
	return &StockHandler{ingredients: i, recipes: r}
}
func stockID(c echo.Context, name string) (uuid.UUID, error) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return uuid.Nil, domain.NewError(domain.CodeValidationError, "invalid "+name+" id", http.StatusBadRequest, err)
	}
	return id, nil
}
func (h *StockHandler) ListIngredients(c echo.Context) error {
	v, e := h.ingredients.List(c.Request().Context())
	if e != nil {
		return e
	}
	return Success(c, 200, v)
}
func (h *StockHandler) CreateIngredient(c echo.Context) error {
	var r dto.IngredientRequest
	if e := c.Bind(&r); e != nil {
		return e
	}
	v := domain.Ingredient{Name: r.Name, Unit: r.Unit, MinStock: r.MinStock}
	if e := h.ingredients.Create(c.Request().Context(), &v); e != nil {
		return e
	}
	return Success(c, 201, v)
}
func (h *StockHandler) UpdateIngredient(c echo.Context) error {
	id, e := stockID(c, "ingredient")
	if e != nil {
		return e
	}
	var r dto.IngredientRequest
	if e = c.Bind(&r); e != nil {
		return e
	}
	v := domain.Ingredient{ID: id, Name: r.Name, Unit: r.Unit, MinStock: r.MinStock}
	if e = h.ingredients.Update(c.Request().Context(), &v); e != nil {
		return e
	}
	return Success(c, 200, v)
}
func (h *StockHandler) Restock(c echo.Context) error {
	id, e := stockID(c, "ingredient")
	if e != nil {
		return e
	}
	var r dto.RestockRequest
	if e = c.Bind(&r); e != nil {
		return e
	}
	if e = h.ingredients.Restock(c.Request().Context(), id, r.Qty, r.Note); e != nil {
		return e
	}
	return Success(c, 200, map[string]interface{}{"ingredient_id": id, "qty": r.Qty})
}
func (h *StockHandler) ListRecipes(c echo.Context) error {
	v, e := h.recipes.List(c.Request().Context())
	if e != nil {
		return e
	}
	return Success(c, 200, v)
}
func (h *StockHandler) CreateRecipe(c echo.Context) error {
	var r dto.RecipeItemRequest
	if e := c.Bind(&r); e != nil {
		return e
	}
	menu, e := uuid.Parse(r.MenuID)
	if e != nil {
		return domain.NewError(domain.CodeValidationError, "invalid menu_id", 400, e)
	}
	ingredient, e := uuid.Parse(r.IngredientID)
	if e != nil {
		return domain.NewError(domain.CodeValidationError, "invalid ingredient_id", 400, e)
	}
	v := domain.RecipeItem{MenuID: menu, IngredientID: ingredient, QtyUsed: r.QtyUsed}
	if e = h.recipes.Create(c.Request().Context(), &v); e != nil {
		return e
	}
	return Success(c, 201, v)
}
func (h *StockHandler) UpdateRecipe(c echo.Context) error {
	id, e := stockID(c, "recipe item")
	if e != nil {
		return e
	}
	var r struct {
		QtyUsed float64 `json:"qty_used" validate:"gt=0"`
	}
	if e = c.Bind(&r); e != nil {
		return e
	}
	v := domain.RecipeItem{ID: id, QtyUsed: r.QtyUsed}
	if e = h.recipes.Update(c.Request().Context(), &v); e != nil {
		return e
	}
	return Success(c, 200, v)
}
func (h *StockHandler) DeleteRecipe(c echo.Context) error {
	id, e := stockID(c, "recipe item")
	if e != nil {
		return e
	}
	if e = h.recipes.Delete(c.Request().Context(), id); e != nil {
		return e
	}
	return c.NoContent(http.StatusNoContent)
}
