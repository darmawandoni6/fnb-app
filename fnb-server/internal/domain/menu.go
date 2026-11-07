package domain

import (
	"github.com/google/uuid"
	"time"
)

type Menu struct {
	ID          uuid.UUID    `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CategoryID  uuid.UUID    `gorm:"type:uuid;not null;index" json:"category_id"`
	Category    MenuCategory `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Name        string       `gorm:"not null" json:"name"`
	Price       int64        `gorm:"not null" json:"price"`
	ImageURL    *string      `json:"image_url,omitempty"`
	IsAvailable bool         `gorm:"not null;default:true" json:"is_available"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}
