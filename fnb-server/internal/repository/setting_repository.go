package repository

import (
	"context"
	"fmt"

	"fnb-server/internal/domain"
	"gorm.io/gorm"
)

type SettingRepository struct{ db *gorm.DB }

func NewSettingRepository(db *gorm.DB) *SettingRepository { return &SettingRepository{db: db} }

func (r *SettingRepository) Update(ctx context.Context, setting *domain.Setting) error {
	if err := r.db.WithContext(ctx).Save(setting).Error; err != nil {
		return fmt.Errorf("update settings: %w", err)
	}
	return nil
}

func (r *SettingRepository) GetFirst(ctx context.Context) (*domain.Setting, error) {
	var setting domain.Setting
	if err := r.db.WithContext(ctx).Order("created_at").First(&setting).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("get settings: %w", err)
	}
	return &setting, nil
}
