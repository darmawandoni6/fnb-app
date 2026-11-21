package domain

import (
	"time"

	"github.com/google/uuid"
)

func (OrderSequence) TableName() string { return "order_sequence" }

type OrderSequence struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	OrderType OrderType `gorm:"type:order_type;not null" json:"order_type"`
	Date      time.Time `gorm:"type:date;not null" json:"date"`
	LastSeq   int       `gorm:"not null" json:"last_seq"`
}
