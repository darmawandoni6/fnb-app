package usecase

import (
	"context"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

type PublicUsecase struct {
	tableRepo   domain.TableRepository
	menuRepo    domain.MenuRepository
	settingRepo domain.SettingRepository
}

func NewPublicUsecase(t domain.TableRepository, m domain.MenuRepository, s domain.SettingRepository) *PublicUsecase {
	return &PublicUsecase{
		tableRepo:   t,
		menuRepo:    m,
		settingRepo: s,
	}
}

type MenuResult struct {
	CafeName    string
	ServiceRate float64
	TaxRate     float64
	IsOpen      bool
	Categories  []MenuCategoryResult
}

type MenuCategoryResult struct {
	ID    uuid.UUID
	Name  string
	Menus []MenuItemResult
}

type MenuItemResult struct {
	ID       uuid.UUID
	Name     string
	Price    int64
	ImageURL *string
}

func (u *PublicUsecase) Menu(ctx context.Context, s *domain.TableSession) (*MenuResult, error) {
	setting, err := u.settingRepo.GetFirst(ctx)
	if err != nil {
		return nil, err
	}
	r := &MenuResult{IsOpen: true, ServiceRate: 5, TaxRate: 10}
	if setting != nil {
		r.CafeName = setting.CafeName
		r.ServiceRate = setting.ServiceRate
		r.TaxRate = setting.TaxRate
		r.IsOpen = setting.IsOpen
	}
	cats, err := u.menuRepo.ListAvailableGroupedByCategory(ctx)
	if err != nil {
		return nil, err
	}
	for _, c := range cats {
		if len(c.Menus) == 0 {
			continue
		}
		catResult := MenuCategoryResult{ID: c.ID, Name: c.Name}
		for _, m := range c.Menus {
			catResult.Menus = append(catResult.Menus, MenuItemResult{m.ID, m.Name, m.Price, m.ImageURL})
		}
		r.Categories = append(r.Categories, catResult)
	}
	return r, nil
}
