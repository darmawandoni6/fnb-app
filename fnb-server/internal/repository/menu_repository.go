package repository

import (
	"context"
	"fmt"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MenuRepository struct{ db *gorm.DB }

func NewMenuRepository(db *gorm.DB) *MenuRepository { return &MenuRepository{db: db} }

func (r *MenuRepository) ListAvailableGroupedByCategory(ctx context.Context) ([]domain.MenuCategory, error) {
	var categories []domain.MenuCategory
	err := r.db.WithContext(ctx).
		Preload("Menus", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_available = ?", true).Order("name")
		}).Order("sort_order").Find(&categories).Error
	if err != nil {
		return nil, fmt.Errorf("list available menu: %w", err)
	}
	return categories, nil
}

func (r *MenuRepository) ListAvailableByIDs(ctx context.Context, ids []uuid.UUID) ([]domain.Menu, error) {
	var menus []domain.Menu
	err := r.db.WithContext(ctx).Where("id IN ? AND is_available = ?", ids, true).Find(&menus).Error
	if err != nil {
		return nil, fmt.Errorf("get available menus: %w", err)
	}
	return menus, nil
}
