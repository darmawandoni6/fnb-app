package repository

import (
	"context"

	"fnb-server/internal/domain"
	"gorm.io/gorm"
)

type AuditRepository struct {
	db *gorm.DB
}

func NewAuditRepository(db *gorm.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) Create(ctx context.Context, log *domain.AuditLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *AuditRepository) List(ctx context.Context, filter domain.AuditFilter, limit int) ([]domain.AuditLog, error) {
	var logs []domain.AuditLog
	q := r.db.WithContext(ctx).Model(&domain.AuditLog{})
	if filter.Entity != nil {
		q = q.Where("entity = ?", *filter.Entity)
	}
	if filter.EntityID != nil {
		q = q.Where("entity_id = ?", *filter.EntityID)
	}
	if filter.ActorID != nil {
		q = q.Where("actor_id = ?", *filter.ActorID)
	}
	if filter.From != nil {
		q = q.Where("created_at >= ?", *filter.From)
	}
	if filter.To != nil {
		q = q.Where("created_at <= ?", *filter.To)
	}
	err := q.Order("created_at DESC").Limit(limit).Find(&logs).Error
	return logs, err
}
