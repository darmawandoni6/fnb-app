package domain

import (
	"time"

	"github.com/google/uuid"
)

type Order struct {
	ID                  uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	OrderNumber         string         `gorm:"type:text;not null;uniqueIndex" json:"order_number"`
	TableID             *uuid.UUID     `gorm:"type:uuid;index" json:"table_id,omitempty"`
	Table               *Table         `gorm:"foreignKey:TableID" json:"table,omitempty"`
	TableSessionID      *uuid.UUID     `gorm:"type:uuid;index" json:"table_session_id,omitempty"`
	TableSession        *TableSession  `gorm:"foreignKey:TableSessionID" json:"table_session,omitempty"`
	CustomerName        string         `gorm:"type:text;not null" json:"customer_name"`
	CustomerPhone       *string        `gorm:"type:text" json:"customer_phone,omitempty"`
	CreatedBy           *uuid.UUID     `gorm:"type:uuid;index" json:"created_by,omitempty"`
	CreatedByUser       *User          `gorm:"foreignKey:CreatedBy" json:"-"`
	OrderType           OrderType      `gorm:"type:order_type;not null" json:"order_type"`
	Status              OrderStatus    `gorm:"type:order_status;not null" json:"status"`
	SubtotalAmount      int64          `gorm:"not null" json:"subtotal_amount"`
	ServiceRateSnapshot float64        `gorm:"type:numeric;not null;default:0" json:"service_rate_snapshot"`
	ServiceAmount       int64          `gorm:"not null;default:0" json:"service_amount"`
	TaxRateSnapshot     float64        `gorm:"type:numeric;not null;default:0" json:"tax_rate_snapshot"`
	TaxAmount           int64          `gorm:"not null;default:0" json:"tax_amount"`
	TotalAmount         int64          `gorm:"not null" json:"total_amount"`
	PaymentStatus       PaymentStatus  `gorm:"type:payment_status;not null" json:"payment_status"`
	PaymentMethod       *PaymentMethod `gorm:"type:payment_method" json:"payment_method,omitempty"`
	PaymentRef          *string        `gorm:"type:text" json:"payment_ref,omitempty"`
	PaidAt              *time.Time     `gorm:"type:timestamptz" json:"paid_at,omitempty"`
	AmountReceived      *int64         `json:"amount_received,omitempty"`
	ChangeAmount        *int64         `json:"change_amount,omitempty"`
	CancelReason        *string        `gorm:"type:text" json:"cancel_reason,omitempty"`
	CanceledAt          *time.Time     `gorm:"type:timestamptz" json:"canceled_at,omitempty"`
	PaymentURL          *string        `gorm:"-" json:"payment_url,omitempty"`
	SnapToken           *string        `gorm:"-" json:"snap_token,omitempty"`
	Items               []OrderItem    `gorm:"foreignKey:OrderID" json:"items"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
}
