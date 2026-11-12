package dto

import "fnb-server/internal/domain"

type MenuCategoryRequest struct {
	Name      string `json:"name" validate:"required"`
	SortOrder int    `json:"sort_order"`
}
type TableRequest struct {
	TableNumber string `json:"table_number" validate:"required"`
	QRToken     string `json:"qr_token" validate:"required"`
}
type MenuRequest struct {
	CategoryID  string  `json:"category_id" form:"category_id" validate:"required"`
	Name        string  `json:"name" form:"name" validate:"required"`
	Price       int64   `json:"price" form:"price" validate:"gt=0"`
	ImageURL    *string `json:"image_url" form:"image_url"`
	IsAvailable *bool   `json:"is_available" form:"is_available"`
}

func CategoryFrom(r MenuCategoryRequest) domain.MenuCategory {
	return domain.MenuCategory{Name: r.Name, SortOrder: r.SortOrder}
}
func TableFrom(r TableRequest) domain.Table {
	return domain.Table{TableNumber: r.TableNumber, QRToken: r.QRToken}
}
