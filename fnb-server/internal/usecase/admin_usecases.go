package usecase

import (
	"context"
	"net/http"
	"strings"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

func validation(message string) error {
	return domain.NewError(domain.CodeValidationError, message, http.StatusBadRequest, nil)
}
func notFound(name string) error {
	return domain.NewError(domain.CodeNotFound, name+" not found", http.StatusNotFound, nil)
}
func isUnique(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "duplicate key") || strings.Contains(strings.ToLower(err.Error()), "unique constraint")
}

type MenuCategoryUsecase struct{ repo domain.MenuCategoryRepository }

func NewMenuCategoryUsecase(repo domain.MenuCategoryRepository) *MenuCategoryUsecase {
	return &MenuCategoryUsecase{repo}
}
func (u *MenuCategoryUsecase) List(ctx context.Context) ([]domain.MenuCategory, error) {
	return u.repo.List(ctx)
}
func (u *MenuCategoryUsecase) Create(ctx context.Context, c *domain.MenuCategory) error {
	if strings.TrimSpace(c.Name) == "" {
		return validation("category name is required")
	}
	if err := u.repo.Create(ctx, c); err != nil {
		return err
	}
	return nil
}
func (u *MenuCategoryUsecase) Update(ctx context.Context, c *domain.MenuCategory) error {
	if strings.TrimSpace(c.Name) == "" {
		return validation("category name is required")
	}
	if _, err := u.repo.GetByID(ctx, c.ID); err != nil {
		return err
	}
	return u.repo.Update(ctx, c)
}
func (u *MenuCategoryUsecase) Delete(ctx context.Context, id uuid.UUID) error {
	c, err := u.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if c == nil {
		return notFound("menu category")
	}
	n, err := u.repo.CountMenus(ctx, id)
	if err != nil {
		return err
	}
	if n > 0 {
		return domain.NewError(domain.CodeInvalidTransition, "menu category has menus", http.StatusConflict, nil)
	}
	return u.repo.Delete(ctx, id)
}

type MenuUsecase struct {
	repo       domain.AdminMenuRepository
	categories domain.MenuCategoryRepository
}

func NewMenuUsecase(repo domain.AdminMenuRepository, categories domain.MenuCategoryRepository) *MenuUsecase {
	return &MenuUsecase{repo, categories}
}
func (u *MenuUsecase) List(ctx context.Context) ([]domain.Menu, error) { return u.repo.List(ctx) }
func (u *MenuUsecase) validate(ctx context.Context, m *domain.Menu) error {
	if strings.TrimSpace(m.Name) == "" {
		return validation("menu name is required")
	}
	if m.Price <= 0 {
		return validation("menu price must be greater than zero")
	}
	c, err := u.categories.GetByID(ctx, m.CategoryID)
	if err != nil {
		return err
	}
	if c == nil {
		return notFound("menu category")
	}
	return nil
}
func (u *MenuUsecase) Create(ctx context.Context, m *domain.Menu) error {
	if err := u.validate(ctx, m); err != nil {
		return err
	}
	return u.repo.Create(ctx, m)
}
func (u *MenuUsecase) Update(ctx context.Context, m *domain.Menu) error {
	if err := u.validate(ctx, m); err != nil {
		return err
	}
	old, err := u.repo.GetByID(ctx, m.ID)
	if err != nil {
		return err
	}
	if old == nil {
		return notFound("menu")
	}
	return u.repo.Update(ctx, m)
}
func (u *MenuUsecase) Delete(ctx context.Context, id uuid.UUID) error {
	m, err := u.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if m == nil {
		return notFound("menu")
	}
	return u.repo.Delete(ctx, id)
}

type TableUsecase struct{ repo domain.AdminTableRepository }

func NewTableUsecase(repo domain.AdminTableRepository) *TableUsecase     { return &TableUsecase{repo} }
func (u *TableUsecase) List(ctx context.Context) ([]domain.Table, error) { return u.repo.List(ctx) }
func validateTable(t *domain.Table) error {
	if strings.TrimSpace(t.TableNumber) == "" {
		return validation("table number is required")
	}
	if strings.TrimSpace(t.QRToken) == "" {
		return validation("qr token is required")
	}
	return nil
}
func (u *TableUsecase) Create(ctx context.Context, t *domain.Table) error {
	if err := validateTable(t); err != nil {
		return err
	}
	if err := u.repo.Create(ctx, t); err != nil {
		if isUnique(err) {
			return domain.NewError(domain.CodeValidationError, "table number or qr token already exists", http.StatusConflict, err)
		}
		return err
	}
	return nil
}
func (u *TableUsecase) Update(ctx context.Context, t *domain.Table) error {
	if err := validateTable(t); err != nil {
		return err
	}
	old, err := u.repo.GetByID(ctx, t.ID)
	if err != nil {
		return err
	}
	if old == nil {
		return notFound("table")
	}
	if err = u.repo.Update(ctx, t); err != nil {
		if isUnique(err) {
			return domain.NewError(domain.CodeValidationError, "table number or qr token already exists", http.StatusConflict, err)
		}
		return err
	}
	return nil
}
func (u *TableUsecase) Delete(ctx context.Context, id uuid.UUID) error {
	t, err := u.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if t == nil {
		return notFound("table")
	}
	return u.repo.Delete(ctx, id)
}
