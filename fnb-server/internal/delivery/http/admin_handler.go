package http

import (
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"fnb-server/internal/delivery/http/dto"
	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

const maxMenuPhotoSize int64 = 5 << 20

type AdminHandler struct {
	categories *usecase.MenuCategoryUsecase
	menus      *usecase.MenuUsecase
	tables     *usecase.TableUsecase
	uploadDir  string
}

func NewAdminHandler(c *usecase.MenuCategoryUsecase, m *usecase.MenuUsecase, t *usecase.TableUsecase, uploadDir string) *AdminHandler {
	return &AdminHandler{categories: c, menus: m, tables: t, uploadDir: uploadDir}
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

func (h *AdminHandler) menuRequest(c echo.Context) (dto.MenuRequest, *multipart.FileHeader, error) {
	if strings.HasPrefix(c.Request().Header.Get("Content-Type"), "multipart/form-data") {
		price, err := strconv.ParseInt(c.FormValue("price"), 10, 64)
		if err != nil {
			return dto.MenuRequest{}, nil, domain.NewError(domain.CodeValidationError, "price is invalid", 400, err)
		}
		request := dto.MenuRequest{CategoryID: c.FormValue("category_id"), Name: c.FormValue("name"), Price: price}
		if value := c.FormValue("is_available"); value != "" {
			parsed, err := strconv.ParseBool(value)
			if err != nil {
				return dto.MenuRequest{}, nil, domain.NewError(domain.CodeValidationError, "is_available is invalid", 400, err)
			}
			request.IsAvailable = &parsed
		}
		file, err := c.FormFile("photo")
		if err != nil && err != http.ErrMissingFile {
			return dto.MenuRequest{}, nil, domain.NewError(domain.CodeValidationError, "invalid photo", 400, err)
		}
		return request, file, nil
	}
	var request dto.MenuRequest
	if err := c.Bind(&request); err != nil {
		return request, nil, err
	}
	return request, nil, nil
}

func (h *AdminHandler) saveMenuPhoto(file *multipart.FileHeader) (*string, func(), error) {
	if file == nil {
		return nil, func() {}, nil
	}
	if file.Size > maxMenuPhotoSize {
		return nil, func() {}, domain.NewError(domain.CodeValidationError, "photo must not exceed 5 MB", 400, nil)
	}
	src, err := file.Open()
	if err != nil {
		return nil, func() {}, domain.NewError(domain.CodeValidationError, "invalid photo", 400, err)
	}
	defer src.Close()
	content := make([]byte, 512)
	n, err := io.ReadFull(src, content)
	if err != nil && err != io.ErrUnexpectedEOF {
		return nil, func() {}, domain.NewError(domain.CodeValidationError, "invalid photo", 400, err)
	}
	contentType := http.DetectContentType(content[:n])
	ext := map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[contentType]
	if ext == "" {
		return nil, func() {}, domain.NewError(domain.CodeValidationError, "photo must be JPEG, PNG, or WebP", 400, nil)
	}
	if _, err = src.Seek(0, io.SeekStart); err != nil {
		return nil, func() {}, err
	}
	if err = os.MkdirAll(h.uploadDir, 0750); err != nil {
		return nil, func() {}, err
	}
	name := uuid.NewString() + ext
	path := filepath.Join(h.uploadDir, name)
	out, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return nil, func() {}, err
	}
	if _, err = io.CopyN(out, src, maxMenuPhotoSize+1); err != nil && err != io.EOF {
		out.Close()
		os.Remove(path)
		return nil, func() {}, err
	}
	if err = out.Close(); err != nil {
		os.Remove(path)
		return nil, func() {}, err
	}
	if info, err := os.Stat(path); err != nil || info.Size() > maxMenuPhotoSize {
		os.Remove(path)
		return nil, func() {}, domain.NewError(domain.CodeValidationError, "photo must not exceed 5 MB", 400, err)
	}
	url := "/static/" + name
	return &url, func() { _ = os.Remove(path) }, nil
}

func (h *AdminHandler) CreateMenu(c echo.Context) error {
	r, file, e := h.menuRequest(c)
	if e != nil {
		return e
	}
	cat, e := uuid.Parse(r.CategoryID)
	if e != nil {
		return domain.NewError(domain.CodeValidationError, "invalid category_id", 400, e)
	}
	imageURL, cleanup, e := h.saveMenuPhoto(file)
	if e != nil {
		return e
	}
	if imageURL != nil {
		r.ImageURL = imageURL
	}
	v := domain.Menu{CategoryID: cat, Name: r.Name, Price: r.Price, ImageURL: r.ImageURL, IsAvailable: true}
	if r.IsAvailable != nil {
		v.IsAvailable = *r.IsAvailable
	}
	if e = h.menus.Create(c.Request().Context(), &v); e != nil {
		cleanup()
		return e
	}
	return Success(c, 201, v)
}
func (h *AdminHandler) UpdateMenu(c echo.Context) error {
	menuID, e := id(c, "menu")
	if e != nil {
		return e
	}
	r, file, e := h.menuRequest(c)
	if e != nil {
		return e
	}
	cat, e := uuid.Parse(r.CategoryID)
	if e != nil {
		return domain.NewError(domain.CodeValidationError, "invalid category_id", 400, e)
	}
	imageURL, cleanup, e := h.saveMenuPhoto(file)
	if e != nil {
		return e
	}
	if imageURL != nil {
		r.ImageURL = imageURL
	}
	v := domain.Menu{ID: menuID, CategoryID: cat, Name: r.Name, Price: r.Price, ImageURL: r.ImageURL, IsAvailable: true}
	if r.IsAvailable != nil {
		v.IsAvailable = *r.IsAvailable
	}
	if e = h.menus.Update(c.Request().Context(), &v); e != nil {
		cleanup()
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
	return c.NoContent(http.StatusNoContent)
}
