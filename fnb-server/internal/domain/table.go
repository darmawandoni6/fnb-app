package domain

import (
	"github.com/google/uuid"
	"time"
)

type Table struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TableNumber string    `gorm:"not null;uniqueIndex" json:"table_number"`
	QRToken     string    `gorm:"not null;uniqueIndex" json:"qr_token"`
	IsActive    bool      `gorm:"not null;default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
