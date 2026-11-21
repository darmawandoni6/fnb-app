package domain

import (
	"time"

	"github.com/google/uuid"
)

type OrderItem struct {
	ID               uuid.UUID       `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrderID          uuid.UUID       `gorm:"type:uuid;not null;index" json:"order_id"`
	MenuID           uuid.UUID       `gorm:"type:uuid;not null;index" json:"menu_id"`
	MenuNameSnapshot string          `gorm:"type:text;not null" json:"menu_name_snapshot"`
	Qty              int             `gorm:"not null" json:"qty"`
	Note             *string         `json:"note,omitempty"`
	Price            int64           `gorm:"not null" json:"price"`
	Status           OrderItemStatus `gorm:"type:order_item_status;not null" json:"status"`
	ReadyAt          *time.Time      `gorm:"type:timestamptz" json:"ready_at,omitempty"`
	DeliveredAt      *time.Time      `gorm:"type:timestamptz" json:"delivered_at,omitempty"`
	CompletedAt      *time.Time      `gorm:"type:timestamptz" json:"completed_at,omitempty"`
	CancelledAt      *time.Time      `json:"cancelled_at,omitempty"`
	UpdatedBy        *uuid.UUID      `gorm:"type:uuid" json:"updated_by,omitempty"`
	Order            Order           `gorm:"foreignKey:OrderID" json:"-"`
	Menu             Menu            `gorm:"foreignKey:MenuID" json:"menu,omitempty"`
}
