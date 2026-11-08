package repository

import (
	"context"
	"fmt"

	"fnb-server/internal/domain"
	"gorm.io/gorm"
)

type TableRepository struct{ db *gorm.DB }

func NewTableRepository(db *gorm.DB) *TableRepository { return &TableRepository{db: db} }

func (r *TableRepository) GetByQRToken(ctx context.Context, token string) (*domain.Table, error) {
	var table domain.Table
	if err := r.db.WithContext(ctx).Where("qr_token = ?", token).First(&table).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("get table by QR token: %w", err)
	}
	return &table, nil
}
