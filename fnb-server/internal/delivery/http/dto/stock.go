package dto

type IngredientRequest struct {
	Name     string  `json:"name" validate:"required"`
	Unit     string  `json:"unit" validate:"required"`
	MinStock float64 `json:"min_stock" validate:"gte=0"`
}

type RestockRequest struct {
	Qty  float64 `json:"qty" validate:"gt=0"`
	Note *string `json:"note"`
}

type RecipeItemRequest struct {
	MenuID       string  `json:"menu_id" validate:"required"`
	IngredientID string  `json:"ingredient_id" validate:"required"`
	QtyUsed      float64 `json:"qty_used" validate:"gt=0"`
}

type AdjustStockRequest struct {
	StockQty *float64 `json:"stock_qty" validate:"required,gte=0"`
	Note     *string  `json:"note" validate:"omitempty,max=255"`
}
