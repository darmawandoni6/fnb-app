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
type MenuResponse struct {
	CafeName   string                 `json:"cafe_name"`
	TaxPercent float64                `json:"tax_percent"`
	IsOpen     bool                   `json:"is_open"`
	Categories []MenuCategoryResponse `json:"categories"`
}
type CreateOrderItemRequest struct {
	MenuID string  `json:"menu_id" validate:"required,uuid"`
	Qty    int     `json:"qty" validate:"required,min=1,max=100"`
	Note   *string `json:"note" validate:"omitempty,max=255"`
}
type CreateOrderRequest struct {
	Items []CreateOrderItemRequest `json:"items" validate:"required,min=1,max=50,dive"`
}
type PublicOrderItemResponse struct {
	ID       string  `json:"id"`
	MenuName string  `json:"menu_name"`
	Qty      int     `json:"qty"`
	Price    int64   `json:"price"`
	Status   string  `json:"status"`
	Note     *string `json:"note"`
}
type CreateOrderResponse struct {
	OrderID        string                    `json:"order_id"`
	TrackingToken  string                    `json:"tracking_token"`
	SubtotalAmount int64                     `json:"subtotal_amount"`
	TaxAmount      int64                     `json:"tax_amount"`
	TotalAmount    int64                     `json:"total_amount"`
	Status         string                    `json:"status"`
	Items          []PublicOrderItemResponse `json:"items"`
}
type OrderStatusResponse struct {
	OrderID        string                    `json:"order_id"`
	Status         string                    `json:"status"`
	PaymentStatus  string                    `json:"payment_status"`
	SubtotalAmount int64                     `json:"subtotal_amount"`
	TaxAmount      int64                     `json:"tax_amount"`
	TotalAmount    int64                     `json:"total_amount"`
	Items          []PublicOrderItemResponse `json:"items"`
}
type CancelItemRequest struct {
	ItemID string `json:"item_id" validate:"required,uuid"`
}

func MenuResponseFrom(r *usecase.MenuResult) MenuResponse {
	out := MenuResponse{CafeName: r.CafeName, TaxPercent: r.TaxPercent, IsOpen: r.IsOpen}
	for _, c := range r.Categories {
		x := MenuCategoryResponse{ID: c.ID.String(), Name: c.Name}
		for _, m := range c.Menus {
			x.Menus = append(x.Menus, MenuItemResponse{m.ID.String(), m.Name, m.Price, m.ImageURL})
		}
		out.Categories = append(out.Categories, x)
	}
	return out
}
func ItemsFrom(items []usecase.OrderItemResult) []PublicOrderItemResponse {
	out := make([]PublicOrderItemResponse, 0, len(items))
	for _, i := range items {
		out = append(out, PublicOrderItemResponse{i.ID.String(), i.MenuName, i.Qty, i.Price, string(i.Status), i.Note})
	}
	return out
}
