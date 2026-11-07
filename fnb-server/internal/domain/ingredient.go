package domain

import (
	"github.com/google/uuid"
	"time"
)

type Ingredient struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string    `gorm:"not null" json:"name"`
	Unit      string    `gorm:"not null" json:"unit"`
	StockQty  float64   `gorm:"type:numeric;not null;default:0" json:"stock_qty"`
	MinStock  float64   `gorm:"type:numeric;not null;default:0" json:"min_stock"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
