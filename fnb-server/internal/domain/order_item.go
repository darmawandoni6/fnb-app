package domain

import (
	"github.com/google/uuid"
	"time"
)

type OrderItem struct {
	ID          uuid.UUID       `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrderID     uuid.UUID       `gorm:"type:uuid;not null;index" json:"order_id"`
	MenuID      uuid.UUID       `gorm:"type:uuid;not null;index" json:"menu_id"`
	Qty         int             `gorm:"not null" json:"qty"`
	Note        *string         `json:"note,omitempty"`
	Price       int64           `gorm:"not null" json:"price"`
	Status      OrderItemStatus `gorm:"type:order_item_status;not null" json:"status"`
	CancelledAt *time.Time      `json:"cancelled_at,omitempty"`
	Order       Order           `gorm:"foreignKey:OrderID" json:"-"`
	Menu        Menu            `gorm:"foreignKey:MenuID" json:"menu,omitempty"`
}
