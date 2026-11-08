package domain

import (
	"github.com/google/uuid"
	"time"
)

type Refund struct {
	ID             uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrderID        uuid.UUID     `gorm:"type:uuid;not null;index" json:"order_id"`
	ActorID        *uuid.UUID    `gorm:"type:uuid;index" json:"actor_id,omitempty"`
	Reason         string        `gorm:"not null" json:"reason"`
	SubtotalAmount int64         `gorm:"not null" json:"subtotal_amount"`
	TaxAmount      int64         `gorm:"not null" json:"tax_amount"`
	TotalAmount    int64         `gorm:"not null" json:"total_amount"`
	PaymentMethod  PaymentMethod `gorm:"type:payment_method;not null" json:"payment_method"`
	CreatedAt      time.Time     `json:"created_at"`
	Items          []RefundItem  `gorm:"foreignKey:RefundID" json:"items"`
}

type RefundItem struct {
	ID             uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	RefundID       uuid.UUID `gorm:"type:uuid;not null;index" json:"refund_id"`
	OrderItemID    uuid.UUID `gorm:"type:uuid;not null;index" json:"order_item_id"`
	Qty            int       `gorm:"not null" json:"qty"`
	SubtotalAmount int64     `gorm:"not null" json:"subtotal_amount"`
	TaxAmount      int64     `gorm:"not null" json:"tax_amount"`
	TotalAmount    int64     `gorm:"not null" json:"total_amount"`
}
