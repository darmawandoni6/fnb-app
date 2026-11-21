package http

import (
	"fnb-server/internal/delivery/http/dto"
	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"net/http"
)

type UsersSettingsHandler struct {
	users    *usecase.UserAdminUsecase
	settings *usecase.SettingsUsecase
}

func NewUsersSettingsHandler(u *usecase.UserAdminUsecase, s *usecase.SettingsUsecase) *UsersSettingsHandler {
	return &UsersSettingsHandler{users: u, settings: s}
}
func (h *UsersSettingsHandler) ListUsers(c echo.Context) error {
	v, e := h.users.List(c.Request().Context())
	if e != nil {
		return e
	}
	return Success(c, 200, v)
}
func (h *UsersSettingsHandler) CreateUser(c echo.Context) error {
	var r dto.CreateUserRequest
	if e := c.Bind(&r); e != nil {
		return e
	}
	if e := h.users.Create(c.Request().Context(), r.Name, r.Email, r.Password, domain.UserRole(r.Role)); e != nil {
		return e
	}
	return Success(c, 201, map[string]string{"email": r.Email, "role": r.Role})
}
func (h *UsersSettingsHandler) UpdateUser(c echo.Context) error {
	id, e := uuid.Parse(c.Param("id"))
	if e != nil {
		return domain.NewError(domain.CodeValidationError, "invalid user id", 400, e)
	}
	var r dto.UpdateUserRequest
	if e = c.Bind(&r); e != nil {
		return e
	}
	var role *domain.UserRole
	if r.Role != nil {
		v := domain.UserRole(*r.Role)
		role = &v
	}
	v, e := h.users.Update(c.Request().Context(), id, r.Name, role, r.Password, r.IsActive)
	if e != nil {
		return e
	}
	return Success(c, 200, v)
}
func (h *UsersSettingsHandler) GetSettings(c echo.Context) error {
	v, e := h.settings.Get(c.Request().Context())
	if e != nil {
		return e
	}
	return Success(c, 200, v)
}
func (h *UsersSettingsHandler) UpdateSettings(c echo.Context) error {
	var r dto.UpdateSettingsRequest
	if e := c.Bind(&r); e != nil {
		return e
	}
	old, e := h.settings.Get(c.Request().Context())
	if e != nil {
		return e
	}
	if r.CafeName != nil {
		old.CafeName = *r.CafeName
	}
	if r.ServiceRate != nil {
		old.ServiceRate = *r.ServiceRate
	}
	if r.TaxRate != nil {
		old.TaxRate = *r.TaxRate
	}
	if r.IsOpen != nil {
		old.IsOpen = *r.IsOpen
	}
	if r.CashTimeoutMinutes != nil {
		old.CashTimeoutMinutes = *r.CashTimeoutMinutes
	}
	if r.DeliveredAutoCompleteMinutes != nil {
		old.DeliveredAutoCompleteMinutes = *r.DeliveredAutoCompleteMinutes
	}
	if r.ReadyAutoDeliverMinutes != nil {
		old.ReadyAutoDeliverMinutes = *r.ReadyAutoDeliverMinutes
	}
	if r.ReadyAutoDeliverWarningMinutes != nil {
		old.ReadyAutoDeliverWarningMinutes = *r.ReadyAutoDeliverWarningMinutes
	}
	v, e := h.settings.Update(c.Request().Context(), old)
	if e != nil {
		return e
	}
	return Success(c, http.StatusOK, v)
}
