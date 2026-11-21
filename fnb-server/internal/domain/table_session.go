package domain

import (
	"time"

	"github.com/google/uuid"
)

type TableSession struct {
	ID           uuid.UUID          `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TableID      uuid.UUID          `gorm:"type:uuid;not null;index" json:"table_id"`
	Table        Table              `gorm:"foreignKey:TableID" json:"table,omitempty"`
	SessionToken string             `gorm:"type:text;not null;uniqueIndex" json:"session_token"`
	Status       TableSessionStatus `gorm:"type:table_session_status;not null;default:'OPEN'" json:"status"`
	StartedAt    time.Time          `gorm:"type:timestamptz;not null;default:now()" json:"started_at"`
	EndedAt      *time.Time         `gorm:"type:timestamptz" json:"ended_at,omitempty"`
	ClosedBy     *uuid.UUID         `gorm:"type:uuid" json:"closed_by,omitempty"`
	CreatedAt    time.Time          `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	UpdatedAt    time.Time          `gorm:"type:timestamptz;not null;default:now()" json:"updated_at"`
}
