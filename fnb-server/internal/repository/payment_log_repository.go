package repository

import (
	"context"
	"errors"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PaymentLogRepository struct {
	db *gorm.DB
}

func NewPaymentLogRepository(db *gorm.DB) *PaymentLogRepository {
	return &PaymentLogRepository{db: db}
}

func (r *PaymentLogRepository) Create(ctx context.Context, log *domain.PaymentLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *PaymentLogRepository) GetByGatewayRef(ctx context.Context, ref string) (*domain.PaymentLog, error) {
	var log domain.PaymentLog
	err := r.db.WithContext(ctx).Where("gateway_ref = ?", ref).First(&log).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &log, nil
}

func (r *PaymentLogRepository) MarkSettled(ctx context.Context, id uuid.UUID, gatewayStatus string) error {
	return r.db.WithContext(ctx).
		Model(&domain.PaymentLog{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":         domain.PaymentLogStatusSettled,
			"gateway_status": gatewayStatus,
		}).Error
}

func (r *PaymentLogRepository) MarkExpired(ctx context.Context, id uuid.UUID, gatewayStatus string) error {
	return r.db.WithContext(ctx).
		Model(&domain.PaymentLog{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":         domain.PaymentLogStatusExpired,
			"gateway_status": gatewayStatus,
		}).Error
}
