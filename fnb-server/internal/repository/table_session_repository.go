package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
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
	err := r.db.WithContext(ctx).Create(session).Error
	if err != nil {
		if isUniqueViolation(err) {
			return domain.ErrSessionAlreadyOpen
		}
		return err
	}
	return nil
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

func (r *TableSessionRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.TableSession, error) {
	var session domain.TableSession
	if err := r.db.WithContext(ctx).Preload("Table").First(&session, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get table session: %w", err)
	}
	return &session, nil
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate key") || strings.Contains(msg, "unique constraint")
}

func (r *TableSessionRepository) ListIdleOpen(ctx context.Context, q domain.IdleSessionQuery) ([]domain.TableSession, error) {
	busy := r.db.Model(&domain.Order{}).
		Select("table_session_id").
		Where("table_session_id IS NOT NULL").
		Where("status IN ?", q.ExcludeStatuses)

	var sessions []domain.TableSession
	err := r.db.WithContext(ctx).
		Where("status = ?", domain.TableSessionStatusOpen).
		Where("id NOT IN (?)", busy).
		Order("started_at").
		Limit(q.Limit).
		Find(&sessions).Error
	if err != nil {
		return nil, fmt.Errorf("list idle table sessions: %w", err)
	}
	return sessions, nil
}
