package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SessionRepository struct {
	db *gorm.DB
}

func NewSessionRepository(db *gorm.DB) *SessionRepository {
	return &SessionRepository{db: db}
}

func (r *SessionRepository) Create(ctx context.Context, session *domain.Session) error {
	if err := r.db.WithContext(ctx).Create(session).Error; err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}

func (r *SessionRepository) GetByTokenHash(ctx context.Context, tokenHash string) (*domain.Session, error) {
	var session domain.Session
	err := r.db.WithContext(ctx).Preload("User").First(&session, "token_hash = ?", tokenHash).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get session by token hash: %w", err)
	}
	return &session, nil
}

func (r *SessionRepository) Revoke(ctx context.Context, id uuid.UUID) error {
	now := time.Now().UTC()
	err := r.db.WithContext(ctx).
		Model(&domain.Session{}).
		Where("id = ? AND revoked_at IS NULL", id).
		Update("revoked_at", now).Error
	if err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}
	return nil
}

func (r *SessionRepository) RevokeByUserID(ctx context.Context, userID uuid.UUID) error {
	now := time.Now().UTC()
	err := r.db.WithContext(ctx).
		Model(&domain.Session{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Update("revoked_at", now).Error
	if err != nil {
		return fmt.Errorf("revoke sessions by user id: %w", err)
	}
	return nil
}
