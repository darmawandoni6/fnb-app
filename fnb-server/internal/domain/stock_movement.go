package domain

import (
	"github.com/google/uuid"
	"time"
)

type StockMovement struct {
	ID           uuid.UUID         `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	IngredientID uuid.UUID         `gorm:"type:uuid;not null;index" json:"ingredient_id"`
	OrderID      *uuid.UUID        `gorm:"type:uuid;index" json:"order_id,omitempty"`
	OrderItemID  *uuid.UUID        `gorm:"type:uuid;index" json:"order_item_id,omitempty"`
	Qty          float64           `gorm:"type:numeric;not null" json:"qty"`
	Type         StockMovementType `gorm:"type:stock_movement_type;not null" json:"type"`
	Note         *string           `json:"note,omitempty"`
	CreatedAt    time.Time         `json:"created_at"`
}
