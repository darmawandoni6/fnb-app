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
	DeliveredAt *string `json:"delivered_at,omitempty"`
	CompletedAt *string `json:"completed_at,omitempty"`
	CancelledAt *string `json:"cancelled_at,omitempty"`
}

type OrderResponse struct {
	ID             string              `json:"id"`
	OrderNumber    string              `json:"order_number"`
	OrderType      string              `json:"order_type"`
	TableID        *string             `json:"table_id,omitempty"`
	TableNumber    *string             `json:"table_number,omitempty"`
	CreatedBy      *string             `json:"created_by,omitempty"`
	CustomerName   string              `json:"customer_name"`
	CustomerPhone  *string             `json:"customer_phone,omitempty"`
	Status         string              `json:"status"`
	PaymentStatus  string              `json:"payment_status"`
	PaymentMethod  *string             `json:"payment_method,omitempty"`
	SubtotalAmount int64               `json:"subtotal_amount"`
	ServiceAmount  int64               `json:"service_amount"`
	TaxAmount      int64               `json:"tax_amount"`
	TotalAmount    int64               `json:"total_amount"`
	CancelReason   *string             `json:"cancel_reason,omitempty"`
	CanceledAt     *string             `json:"canceled_at,omitempty"`
	CreatedAt      string              `json:"created_at"`
	UpdatedAt      string              `json:"updated_at"`
	Items          []OrderItemResponse `json:"items"`
}

type CreateOrderItemRequest struct {
	MenuID string  `json:"menu_id" validate:"required,uuid"`
	Qty    int     `json:"qty" validate:"required,min=1,max=100"`
	Note   *string `json:"note" validate:"omitempty,max=255"`
}

type CreateOrderRequest struct {
	CustomerName  string                   `json:"customer_name" validate:"required,max=100"`
	CustomerPhone *string                  `json:"customer_phone" validate:"omitempty,max=20"`
	PaymentMethod string                   `json:"payment_method" validate:"required,oneof=CASH NON_CASH"`
	Items         []CreateOrderItemRequest `json:"items" validate:"required,min=1,max=50,dive"`
}

type ManualOrderRequest = CreateOrderRequest

type CancelOrderRequest struct {
	Reason string `json:"reason" validate:"required,max=255"`
}

type UpdateItemStatusRequest struct {
	Status string `json:"status" validate:"required,oneof=COOKING READY DELIVERED COMPLETED"`
}

type UpdatePaymentRequest struct {
	PaymentStatus string  `json:"payment_status" validate:"required,oneof=LUNAS"`
	PaymentMethod *string `json:"payment_method" validate:"omitempty,oneof=CASH NON_CASH"`
}

func OrderResponseFrom(o *domain.Order) OrderResponse {
	var tableID, tableNumber, createdBy, paymentMethod, cancelReason, canceledAt *string
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
	if o.CancelReason != nil {
		cancelReason = o.CancelReason
	}
	if o.CanceledAt != nil {
		s := o.CanceledAt.UTC().Format(time.RFC3339)
		canceledAt = &s
	}

	items := make([]OrderItemResponse, 0, len(o.Items))
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
		items = append(items, OrderItemResponse{
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

	return OrderResponse{
		ID:             o.ID.String(),
		OrderNumber:    o.OrderNumber,
		OrderType:      string(o.OrderType),
		TableID:        tableID,
		TableNumber:    tableNumber,
		CreatedBy:      createdBy,
		CustomerName:   o.CustomerName,
		CustomerPhone:  o.CustomerPhone,
		Status:         string(o.Status),
		PaymentStatus:  string(o.PaymentStatus),
		PaymentMethod:  paymentMethod,
		SubtotalAmount: o.SubtotalAmount,
		ServiceAmount:  o.ServiceAmount,
		TaxAmount:      o.TaxAmount,
		TotalAmount:    o.TotalAmount,
		CancelReason:   cancelReason,
		CanceledAt:     canceledAt,
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
