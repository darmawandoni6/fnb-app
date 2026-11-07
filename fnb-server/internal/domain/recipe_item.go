package domain

import "github.com/google/uuid"

type RecipeItem struct {
	ID           uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	MenuID       uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex:idx_recipe_menu_ingredient" json:"menu_id"`
	IngredientID uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex:idx_recipe_menu_ingredient" json:"ingredient_id"`
	QtyUsed      float64    `gorm:"type:numeric;not null" json:"qty_used"`
	Menu         Menu       `gorm:"foreignKey:MenuID" json:"menu,omitempty"`
	Ingredient   Ingredient `gorm:"foreignKey:IngredientID" json:"ingredient,omitempty"`
}
