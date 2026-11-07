package domain

import (
	"github.com/google/uuid"
	"time"
)

type Setting struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CafeName   string    `gorm:"not null" json:"cafe_name"`
	TaxPercent float64   `gorm:"type:numeric;not null;default:0" json:"tax_percent"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}
