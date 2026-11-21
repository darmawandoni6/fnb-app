package repository

import (
	"context"
	"errors"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TableSessionRepository struct {
	db *gorm.DB
}

func NewTableSessionRepository(db *gorm.DB) *TableSessionRepository {
	return &TableSessionRepository{db: db}
}

func (r *TableSessionRepository) GetOpenByTableID(ctx context.Context, tableID uuid.UUID) (*domain.TableSession, error) {
	var session domain.TableSession
	err := r.db.WithContext(ctx).
		Preload("Table").
		Where("table_id = ? AND status = ?", tableID, domain.TableSessionStatusOpen).
		First(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &session, nil
}

func (r *TableSessionRepository) GetBySessionToken(ctx context.Context, token string) (*domain.TableSession, error) {
	var session domain.TableSession
	err := r.db.WithContext(ctx).
		Preload("Table").
		Where("session_token = ?", token).
		First(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &session, nil
}

func (r *TableSessionRepository) Create(ctx context.Context, session *domain.TableSession) error {
	return r.db.WithContext(ctx).Create(session).Error
}

func (r *TableSessionRepository) Close(ctx context.Context, id uuid.UUID, closedBy *uuid.UUID) error {
	now := time.Now()
	updates := map[string]interface{}{
		"status":     domain.TableSessionStatusClosed,
		"ended_at":   now,
		"updated_at": now,
	}
	if closedBy != nil {
		updates["closed_by"] = closedBy
	}
	return r.db.WithContext(ctx).
		Model(&domain.TableSession{}).
		Where("id = ? AND status = ?", id, domain.TableSessionStatusOpen).
		Updates(updates).Error
}
