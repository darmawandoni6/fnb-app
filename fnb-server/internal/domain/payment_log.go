package domain

import (
	"time"

	"github.com/google/uuid"
)

func (PaymentLog) TableName() string { return "payment_log" }

type PaymentLog struct {
	ID            uuid.UUID        `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	OrderID       uuid.UUID        `gorm:"type:uuid;not null;index" json:"order_id"`
	Method        PaymentMethod    `gorm:"type:payment_method;not null" json:"method"`
	Gateway       *PaymentGateway  `gorm:"type:payment_gateway" json:"gateway,omitempty"`
	Amount        int64            `gorm:"not null" json:"amount"`
	Status        PaymentLogStatus `gorm:"type:payment_log_status;not null" json:"status"`
	GatewayRef    *string          `gorm:"type:text;unique" json:"gateway_ref,omitempty"`
	GatewayStatus *string          `gorm:"type:text" json:"gateway_status,omitempty"`
	CreatedAt     time.Time        `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
}
