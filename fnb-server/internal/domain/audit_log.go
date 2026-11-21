package domain

import (
	"time"

	"github.com/google/uuid"
)

func (AuditLog) TableName() string { return "audit_log" }

type AuditLog struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Entity    string     `gorm:"type:text;not null" json:"entity"`
	EntityID  uuid.UUID  `gorm:"type:uuid;not null" json:"entity_id"`
	Action    string     `gorm:"type:text;not null" json:"action"`
	FromValue *string    `gorm:"type:text" json:"from_value,omitempty"`
	ToValue   *string    `gorm:"type:text" json:"to_value,omitempty"`
	ActorID   *uuid.UUID `gorm:"type:uuid" json:"actor_id,omitempty"`
	ActorRole *UserRole  `gorm:"type:user_role" json:"actor_role,omitempty"`
	CreatedAt time.Time  `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
}
