package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type adminMenuRepo struct {
	menus     map[uuid.UUID]*domain.Menu
	updatedID uuid.UUID
	available *bool
}

func (r *adminMenuRepo) List(context.Context) ([]domain.Menu, error) { return nil, nil }
func (r *adminMenuRepo) GetByID(_ context.Context, id uuid.UUID) (*domain.Menu, error) {
	return r.menus[id], nil
}
func (r *adminMenuRepo) Create(context.Context, *domain.Menu) error { return nil }
func (r *adminMenuRepo) Update(_ context.Context, m *domain.Menu) error {
	r.updatedID = m.ID
	return nil
}
func (r *adminMenuRepo) Delete(context.Context, uuid.UUID) error { return nil }
func (r *adminMenuRepo) SetAvailability(_ context.Context, id uuid.UUID, available bool) error {
	r.updatedID = id
	r.available = &available
	return nil
}
func (r *adminMenuRepo) CountByCategory(context.Context, uuid.UUID) (int64, error) { return 0, nil }

type adminCategoryRepo struct{ menus int64 }

func (r *adminCategoryRepo) List(context.Context) ([]domain.MenuCategory, error) { return nil, nil }
func (r *adminCategoryRepo) GetByID(_ context.Context, id uuid.UUID) (*domain.MenuCategory, error) {
	return &domain.MenuCategory{ID: id, Name: "cat"}, nil
}
func (r *adminCategoryRepo) Create(context.Context, *domain.MenuCategory) error { return nil }
func (r *adminCategoryRepo) Update(context.Context, *domain.MenuCategory) error { return nil }
func (r *adminCategoryRepo) Delete(context.Context, uuid.UUID) error            { return nil }
func (r *adminCategoryRepo) CountMenus(context.Context, uuid.UUID) (int64, error) {
	return r.menus, nil
}

func newAdminTestContext(t *testing.T, role domain.UserRole, body string) (*echo.Echo, echo.Context, *httptest.ResponseRecorder) {
	t.Helper()
	e := echo.New()
	e.Binder = NewBinder()
	e.HTTPErrorHandler = ErrorHandler(false, nil)
	req := httptest.NewRequest(http.MethodPatch, "/menus/"+uuid.NewString(), strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set(ContextRoleKey, role)
	c.SetParamNames("id")
	c.SetParamValues(uuid.NewString())
	return e, c, rec
}

func TestUpdateMenu_CashierTogglesAvailabilityOnly(t *testing.T) {
	menuID := uuid.New()
	repo := &adminMenuRepo{menus: map[uuid.UUID]*domain.Menu{menuID: {ID: menuID, Name: "Kopi", Price: 10000}}}
	h := NewAdminHandler(nil, usecase.NewMenuUsecase(repo, &adminCategoryRepo{}), nil, nil, nil, t.TempDir())

	e, c, rec := newAdminTestContext(t, domain.UserRoleCashier, `{"is_available": false, "price": 1}`)
	c.SetParamValues(menuID.String())
	if err := h.UpdateMenu(c); err != nil {
		e.HTTPErrorHandler(err, c)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if repo.available == nil || *repo.available {
		t.Fatalf("expected availability set to false, got %v", repo.available)
	}
	if repo.updatedID != menuID {
		t.Fatalf("expected menu %s updated, got %s", menuID, repo.updatedID)
	}
}

func TestDeleteCategory_WithMenusConflicts(t *testing.T) {
	repo := &adminCategoryRepo{menus: 2}
	uc := usecase.NewMenuCategoryUsecase(repo)
	err := uc.Delete(context.Background(), uuid.New())
	appErr, ok := err.(*domain.AppError)
	if !ok || appErr.Code != domain.CodeInvalidTransition {
		t.Fatalf("expected INVALID_TRANSITION, got %v", err)
	}
}
