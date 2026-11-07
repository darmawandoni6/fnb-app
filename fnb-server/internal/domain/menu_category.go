package domain

import (
	"github.com/google/uuid"
	"time"
)

type MenuCategory struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name      string    `gorm:"not null" json:"name"`
	SortOrder int       `gorm:"not null;default:0" json:"sort_order"`
	Menus     []Menu    `gorm:"foreignKey:CategoryID" json:"menus,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
