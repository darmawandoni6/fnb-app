package domain

import (
	"time"

	"github.com/google/uuid"
)

type Setting struct {
	ID                             uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	CafeName                       string    `gorm:"not null" json:"cafe_name"`
	TaxRate                        float64   `gorm:"type:numeric;not null;default:0" json:"tax_rate"`
	ServiceRate                    float64   `gorm:"type:numeric;not null;default:5" json:"service_rate"`
	CashTimeoutMinutes             int       `gorm:"not null;default:15" json:"cash_timeout_minutes"`
	DeliveredAutoCompleteMinutes   int       `gorm:"not null;default:5" json:"delivered_auto_complete_minutes"`
	ReadyAutoDeliverMinutes        int       `gorm:"not null;default:10" json:"ready_auto_deliver_minutes"`
	ReadyAutoDeliverWarningMinutes int       `gorm:"not null;default:2" json:"ready_auto_deliver_warning_minutes"`
	IsOpen                         bool      `gorm:"not null;default:true" json:"is_open"`
	CreatedAt                      time.Time `json:"created_at"`
	UpdatedAt                      time.Time `json:"updated_at"`
}
