package domain

import (
	"github.com/google/uuid"
	"time"
)

type Order struct {
	ID                uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	TableID           *uuid.UUID     `gorm:"type:uuid;index" json:"table_id,omitempty"`
	Table             *Table         `gorm:"foreignKey:TableID" json:"table,omitempty"`
	CreatedBy         *uuid.UUID     `gorm:"type:uuid;index" json:"created_by,omitempty"`
	CreatedByUser     *User          `gorm:"foreignKey:CreatedBy" json:"-"`
	OrderType         OrderType      `gorm:"type:order_type;not null" json:"order_type"`
	TrackingTokenHash *string        `gorm:"uniqueIndex" json:"-"`
	Status            OrderStatus    `gorm:"type:order_status;not null" json:"status"`
	SubtotalAmount    int64          `gorm:"not null" json:"subtotal_amount"`
	TaxPercent        float64        `gorm:"type:numeric;not null;default:0" json:"tax_percent"`
	TaxAmount         int64          `gorm:"not null;default:0" json:"tax_amount"`
	TotalAmount       int64          `gorm:"not null" json:"total_amount"`
	PaymentStatus     PaymentStatus  `gorm:"type:payment_status;not null" json:"payment_status"`
	PaymentMethod     *PaymentMethod `gorm:"type:payment_method" json:"payment_method,omitempty"`
	Items             []OrderItem    `gorm:"foreignKey:OrderID" json:"items"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}
