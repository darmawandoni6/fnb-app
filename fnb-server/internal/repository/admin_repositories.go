package repository

import (
	"context"
	"fnb-server/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MenuCategoryRepository struct{ db *gorm.DB }

func NewMenuCategoryRepository(db *gorm.DB) *MenuCategoryRepository {
	return &MenuCategoryRepository{db}
}
func (r *MenuCategoryRepository) List(ctx context.Context) ([]domain.MenuCategory, error) {
	var v []domain.MenuCategory
	return v, r.db.WithContext(ctx).Order("sort_order").Find(&v).Error
}
func (r *MenuCategoryRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.MenuCategory, error) {
	var v domain.MenuCategory
	err := r.db.WithContext(ctx).First(&v, "id = ?", id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &v, err
}
func (r *MenuCategoryRepository) Create(ctx context.Context, v *domain.MenuCategory) error {
	return r.db.WithContext(ctx).Create(v).Error
}
func (r *MenuCategoryRepository) Update(ctx context.Context, v *domain.MenuCategory) error {
	return r.db.WithContext(ctx).Save(v).Error
}
func (r *MenuCategoryRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&domain.MenuCategory{}, "id = ?", id).Error
}
func (r *MenuCategoryRepository) CountMenus(ctx context.Context, id uuid.UUID) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&domain.Menu{}).Where("category_id = ?", id).Count(&n).Error
	return n, err
}

func (r *MenuRepository) List(ctx context.Context) ([]domain.Menu, error) {
	var v []domain.Menu
	err := r.db.WithContext(ctx).Where("is_available = ?", true).Preload("Category").Find(&v).Error
	return v, err
}
func (r *MenuRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Menu, error) {
	var v domain.Menu
	err := r.db.WithContext(ctx).First(&v, "id = ?", id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &v, err
}
func (r *MenuRepository) Create(ctx context.Context, v *domain.Menu) error {
	return r.db.WithContext(ctx).Create(v).Error
}
func (r *MenuRepository) Update(ctx context.Context, v *domain.Menu) error {
	return r.db.WithContext(ctx).Save(v).Error
}
func (r *MenuRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&domain.Menu{}).Where("id = ?", id).Update("is_available", false).Error
}
func (r *MenuRepository) CountByCategory(ctx context.Context, id uuid.UUID) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&domain.Menu{}).Where("category_id = ?", id).Count(&n).Error
	return n, err
}

func (r *TableRepository) List(ctx context.Context) ([]domain.Table, error) {
	var v []domain.Table
	err := r.db.WithContext(ctx).Where("is_active = ?", true).Find(&v).Error
	return v, err
}
func (r *TableRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Table, error) {
	var v domain.Table
	err := r.db.WithContext(ctx).First(&v, "id = ?", id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &v, err
}
func (r *TableRepository) Create(ctx context.Context, v *domain.Table) error {
	return r.db.WithContext(ctx).Create(v).Error
}
func (r *TableRepository) Update(ctx context.Context, v *domain.Table) error {
	return r.db.WithContext(ctx).Save(v).Error
}
func (r *TableRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&domain.Table{}).Where("id = ?", id).Update("is_active", false).Error
}
