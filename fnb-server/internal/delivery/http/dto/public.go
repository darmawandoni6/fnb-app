package dto

import (
	"time"

	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
)

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

type PublicOrderItemResponse struct {
	ID          string  `json:"id"`
	MenuID      string  `json:"menu_id"`
	MenuName    string  `json:"menu_name"`
	Qty         int     `json:"qty"`
	Price       int64   `json:"price"`
	Note        *string `json:"note"`
	Status      string  `json:"status"`
	DeliveredAt *string `json:"delivered_at,omitempty"`
	CompletedAt *string `json:"completed_at,omitempty"`
	CancelledAt *string `json:"cancelled_at,omitempty"`
}

type PublicOrderResponse struct {
	ID             string                    `json:"id"`
	OrderNumber    string                    `json:"order_number"`
	OrderType      string                    `json:"order_type"`
	TableNumber    *string                   `json:"table_number,omitempty"`
	CustomerName   string                    `json:"customer_name"`
	CustomerPhone  *string                   `json:"customer_phone,omitempty"`
	Status         string                    `json:"status"`
	PaymentStatus  string                    `json:"payment_status"`
	PaymentMethod  *string                   `json:"payment_method,omitempty"`
	SubtotalAmount int64                     `json:"subtotal_amount"`
	ServiceAmount  int64                     `json:"service_amount"`
	TaxAmount      int64                     `json:"tax_amount"`
	TotalAmount    int64                     `json:"total_amount"`
	PaymentURL     *string                   `json:"payment_url"`
	CancelReason   *string                   `json:"cancel_reason,omitempty"`
	CanceledAt     *string                   `json:"canceled_at,omitempty"`
	CreatedAt      string                    `json:"created_at"`
	Items          []PublicOrderItemResponse `json:"items"`
}

func PublicOrderResponseFrom(o *domain.Order) PublicOrderResponse {
	var tableNumber, paymentMethod, cancelReason, canceledAt *string
	if o.Table != nil {
		tableNumber = &o.Table.TableNumber
	}
	if o.PaymentMethod != nil {
		s := string(*o.PaymentMethod)
		paymentMethod = &s
	}
	if o.CancelReason != nil {
		cancelReason = o.CancelReason
	}
	if o.CanceledAt != nil {
		s := o.CanceledAt.UTC().Format(time.RFC3339)
		canceledAt = &s
	}

	items := make([]PublicOrderItemResponse, 0, len(o.Items))
	for _, it := range o.Items {
		var deliveredAt, completedAt, cancelledAt *string
		if it.DeliveredAt != nil {
			s := it.DeliveredAt.UTC().Format(time.RFC3339)
			deliveredAt = &s
		}
		if it.CompletedAt != nil {
			s := it.CompletedAt.UTC().Format(time.RFC3339)
			completedAt = &s
		}
		if it.CancelledAt != nil {
			s := it.CancelledAt.UTC().Format(time.RFC3339)
			cancelledAt = &s
		}
		menuName := it.MenuNameSnapshot
		if menuName == "" && it.Menu.Name != "" {
			menuName = it.Menu.Name
		}
		items = append(items, PublicOrderItemResponse{
			ID:          it.ID.String(),
			MenuID:      it.MenuID.String(),
			MenuName:    menuName,
			Qty:         it.Qty,
			Price:       it.Price,
			Note:        it.Note,
			Status:      string(it.Status),
			DeliveredAt: deliveredAt,
			CompletedAt: completedAt,
			CancelledAt: cancelledAt,
		})
	}

	return PublicOrderResponse{
		ID:             o.ID.String(),
		OrderNumber:    o.OrderNumber,
		OrderType:      string(o.OrderType),
		TableNumber:    tableNumber,
		CustomerName:   o.CustomerName,
		CustomerPhone:  o.CustomerPhone,
		Status:         string(o.Status),
		PaymentStatus:  string(o.PaymentStatus),
		PaymentMethod:  paymentMethod,
		SubtotalAmount: o.SubtotalAmount,
		ServiceAmount:  o.ServiceAmount,
		TaxAmount:      o.TaxAmount,
		TotalAmount:    o.TotalAmount,
		PaymentURL:     o.PaymentURL,
		CancelReason:   cancelReason,
		CanceledAt:     canceledAt,
		CreatedAt:      o.CreatedAt.UTC().Format(time.RFC3339),
		Items:          items,
	}
}

func PublicOrderListResponseFrom(orders []domain.Order) []PublicOrderResponse {
	out := make([]PublicOrderResponse, 0, len(orders))
	for i := range orders {
		out = append(out, PublicOrderResponseFrom(&orders[i]))
	}
	return out
}
