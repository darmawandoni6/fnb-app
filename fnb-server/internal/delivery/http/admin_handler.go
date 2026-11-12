package http

import (
	"fnb-server/internal/delivery/http/dto"
	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"net/http"
)

type AdminHandler struct {
	categories *usecase.MenuCategoryUsecase
	menus      *usecase.MenuUsecase
	tables     *usecase.TableUsecase
}

func NewAdminHandler(c *usecase.MenuCategoryUsecase, m *usecase.MenuUsecase, t *usecase.TableUsecase) *AdminHandler {
	return &AdminHandler{c, m, t}
}
func id(c echo.Context, name string) (uuid.UUID, error) {
	v, e := uuid.Parse(c.Param("id"))
	if e != nil {
		return uuid.Nil, domain.NewError(domain.CodeValidationError, "invalid "+name+" id", 400, e)
	}
	return v, nil
}
func (h *AdminHandler) Categories(c echo.Context) error {
	v, e := h.categories.List(c.Request().Context())
	if e != nil {
		return e
	}
	return Success(c, 200, v)
}
func (h *AdminHandler) CreateCategory(c echo.Context) error {
	var r dto.MenuCategoryRequest
	if e := c.Bind(&r); e != nil {
		return e
	}
	v := dto.CategoryFrom(r)
	if e := h.categories.Create(c.Request().Context(), &v); e != nil {
		return e
	}
	return Success(c, 201, v)
}
func (h *AdminHandler) UpdateCategory(c echo.Context) error {
	id, e := id(c, "category")
	if e != nil {
		return e
	}
	var r dto.MenuCategoryRequest
	if e = c.Bind(&r); e != nil {
		return e
	}
	v := dto.CategoryFrom(r)
	v.ID = id
	if e = h.categories.Update(c.Request().Context(), &v); e != nil {
		return e
	}
	return Success(c, 200, v)
}
func (h *AdminHandler) DeleteCategory(c echo.Context) error {
	id, e := id(c, "category")
	if e != nil {
		return e
	}
	if e = h.categories.Delete(c.Request().Context(), id); e != nil {
		return e
	}
	return c.NoContent(http.StatusNoContent)
}
func (h *AdminHandler) Menus(c echo.Context) error {
	v, e := h.menus.List(c.Request().Context())
	if e != nil {
		return e
	}
	return Success(c, 200, v)
}
func (h *AdminHandler) CreateMenu(c echo.Context) error {
	var r dto.MenuRequest
	if e := c.Bind(&r); e != nil {
		return e
	}
	cat, e := uuid.Parse(r.CategoryID)
	if e != nil {
		return domain.NewError(domain.CodeValidationError, "invalid category_id", 400, e)
	}
	v := domain.Menu{CategoryID: cat, Name: r.Name, Price: r.Price, ImageURL: r.ImageURL, IsAvailable: true}
	if r.IsAvailable != nil {
		v.IsAvailable = *r.IsAvailable
	}
	if e = h.menus.Create(c.Request().Context(), &v); e != nil {
		return e
	}
	return Success(c, 201, v)
}
func (h *AdminHandler) UpdateMenu(c echo.Context) error {
	id, e := id(c, "menu")
	if e != nil {
		return e
	}
	var r dto.MenuRequest
	if e = c.Bind(&r); e != nil {
		return e
	}
	cat, e := uuid.Parse(r.CategoryID)
	if e != nil {
		return domain.NewError(domain.CodeValidationError, "invalid category_id", 400, e)
	}
	v := domain.Menu{ID: id, CategoryID: cat, Name: r.Name, Price: r.Price, ImageURL: r.ImageURL, IsAvailable: true}
	if r.IsAvailable != nil {
		v.IsAvailable = *r.IsAvailable
	}
	if e = h.menus.Update(c.Request().Context(), &v); e != nil {
		return e
	}
	return Success(c, 200, v)
}
func (h *AdminHandler) DeleteMenu(c echo.Context) error {
	id, e := id(c, "menu")
	if e != nil {
		return e
	}
	if e = h.menus.Delete(c.Request().Context(), id); e != nil {
		return e
	}
	return c.NoContent(204)
}
func (h *AdminHandler) Tables(c echo.Context) error {
	v, e := h.tables.List(c.Request().Context())
	if e != nil {
		return e
	}
	return Success(c, 200, v)
}
func (h *AdminHandler) CreateTable(c echo.Context) error {
	var r dto.TableRequest
	if e := c.Bind(&r); e != nil {
		return e
	}
	v := dto.TableFrom(r)
	if e := h.tables.Create(c.Request().Context(), &v); e != nil {
		return e
	}
	return Success(c, 201, v)
}
func (h *AdminHandler) UpdateTable(c echo.Context) error {
	id, e := id(c, "table")
	if e != nil {
		return e
	}
	var r dto.TableRequest
	if e = c.Bind(&r); e != nil {
		return e
	}
	v := dto.TableFrom(r)
	v.ID = id
	if e = h.tables.Update(c.Request().Context(), &v); e != nil {
		return e
	}
	return Success(c, 200, v)
}
func (h *AdminHandler) DeleteTable(c echo.Context) error {
	id, e := id(c, "table")
	if e != nil {
		return e
	}
	if e = h.tables.Delete(c.Request().Context(), id); e != nil {
		return e
	}
	return c.NoContent(204)
}
