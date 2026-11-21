package dto

import "fnb-server/internal/usecase"

type MenuItemResponse struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Price    int64   `json:"price"`
	ImageURL *string `json:"image_url"`
}

type MenuCategoryResponse struct {
	ID    string             `json:"id"`
	Name  string             `json:"name"`
	Menus []MenuItemResponse `json:"menus"`
}

type OpenSessionResponse struct {
	SessionToken string `json:"session_token"`
	TableNumber  string `json:"table_number"`
	Status       string `json:"status"`
}

type MenuResponse struct {
	CafeName    string                 `json:"cafe_name"`
	ServiceRate float64                `json:"service_rate"`
	TaxRate     float64                `json:"tax_rate"`
	IsOpen      bool                   `json:"is_open"`
	Categories  []MenuCategoryResponse `json:"categories"`
}

func MenuResponseFrom(r *usecase.MenuResult) MenuResponse {
	out := MenuResponse{
		CafeName:    r.CafeName,
		ServiceRate: r.ServiceRate,
		TaxRate:     r.TaxRate,
		IsOpen:      r.IsOpen,
	}
	for _, c := range r.Categories {
		x := MenuCategoryResponse{ID: c.ID.String(), Name: c.Name}
		for _, m := range c.Menus {
			x.Menus = append(x.Menus, MenuItemResponse{m.ID.String(), m.Name, m.Price, m.ImageURL})
		}
		out.Categories = append(out.Categories, x)
	}
	return out
}
