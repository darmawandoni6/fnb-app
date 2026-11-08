package dto

import (
	"time"

	"fnb-server/internal/domain"
)

type OrderItemResponse struct {
	ID          string  `json:"id"`
	MenuID      string  `json:"menu_id"`
	MenuName    string  `json:"menu_name"`
	Qty         int     `json:"qty"`
	Price       int64   `json:"price"`
	Note        *string `json:"note"`
	Status      string  `json:"status"`
	CancelledAt *string `json:"cancelled_at,omitempty"`
}

type OrderResponse struct {
	ID             string              `json:"id"`
	OrderType      string              `json:"order_type"`
	TableID        *string             `json:"table_id,omitempty"`
	TableNumber    *string             `json:"table_number,omitempty"`
	CreatedBy      *string             `json:"created_by,omitempty"`
	Status         string              `json:"status"`
	PaymentStatus  string              `json:"payment_status"`
	PaymentMethod  *string             `json:"payment_method,omitempty"`
	SubtotalAmount int64               `json:"subtotal_amount"`
	TaxPercent     float64             `json:"tax_percent"`
	TaxAmount      int64               `json:"tax_amount"`
	TotalAmount    int64               `json:"total_amount"`
	CreatedAt      string              `json:"created_at"`
	UpdatedAt      string              `json:"updated_at"`
	Items          []OrderItemResponse `json:"items"`
}

type ManualOrderRequest struct {
	Items []CreateOrderItemRequest `json:"items" validate:"required,min=1,max=50,dive"`
}

type UpdatePaymentRequest struct {
	PaymentStatus string  `json:"payment_status" validate:"required,oneof=LUNAS"`
	PaymentMethod *string `json:"payment_method" validate:"omitempty,oneof=CASH NON_CASH"`
}

type UpdateItemStatusRequest struct {
	Status string `json:"status" validate:"required,oneof=COOKING READY DELIVERED"`
}

func OrderResponseFrom(o *domain.Order) OrderResponse {
	var tableID, tableNumber, createdBy, paymentMethod *string
	if o.TableID != nil {
		s := o.TableID.String()
		tableID = &s
	}
	if o.Table != nil {
		tableNumber = &o.Table.TableNumber
	}
	if o.CreatedBy != nil {
		s := o.CreatedBy.String()
		createdBy = &s
	}
	if o.PaymentMethod != nil {
		s := string(*o.PaymentMethod)
		paymentMethod = &s
	}

	items := make([]OrderItemResponse, 0, len(o.Items))
	for _, it := range o.Items {
		var cancelledAt *string
		if it.CancelledAt != nil {
			s := it.CancelledAt.UTC().Format(time.RFC3339)
			cancelledAt = &s
		}
		menuName := it.Menu.Name
		items = append(items, OrderItemResponse{
			ID:          it.ID.String(),
			MenuID:      it.MenuID.String(),
			MenuName:    menuName,
			Qty:         it.Qty,
			Price:       it.Price,
			Note:        it.Note,
			Status:      string(it.Status),
			CancelledAt: cancelledAt,
		})
	}

	return OrderResponse{
		ID:             o.ID.String(),
		OrderType:      string(o.OrderType),
		TableID:        tableID,
		TableNumber:    tableNumber,
		CreatedBy:      createdBy,
		Status:         string(o.Status),
		PaymentStatus:  string(o.PaymentStatus),
		PaymentMethod:  paymentMethod,
		SubtotalAmount: o.SubtotalAmount,
		TaxPercent:     o.TaxPercent,
		TaxAmount:      o.TaxAmount,
		TotalAmount:    o.TotalAmount,
		CreatedAt:      o.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:      o.UpdatedAt.UTC().Format(time.RFC3339),
		Items:          items,
	}
}

func OrderListResponseFrom(orders []domain.Order) []OrderResponse {
	out := make([]OrderResponse, 0, len(orders))
	for i := range orders {
		out = append(out, OrderResponseFrom(&orders[i]))
	}
	return out
}
