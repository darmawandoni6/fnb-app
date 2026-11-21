package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type OrderEvent struct {
	Event string
	Order *Order
}

type Publisher interface {
	PublishOrder(ctx context.Context, ev OrderEvent)
	PublishSession(ctx context.Context, sessionToken string, ev OrderEvent)
}

type Event struct {
	Topic string
	Name  string
	Data  any
}

type ItemMove struct {
	OrderID uuid.UUID
	ItemID  uuid.UUID
	From    OrderItemStatus
	To      OrderItemStatus
}

type CashTimeoutQuery struct {
	Cutoff time.Time
	Limit  int
}

type ItemMoveQuery struct {
	From  OrderItemStatus
	To    OrderItemStatus
	Since *time.Time
	Until *time.Time
	Limit int
}

type IdleSessionQuery struct {
	ExcludeStatuses []OrderStatus
	Limit           int
}

type OrderEventData struct {
	ID            string               `json:"id"`
	OrderNumber   string               `json:"order_number"`
	Status        string               `json:"status"`
	PaymentStatus string               `json:"payment_status"`
	Items         []OrderEventItemData `json:"items"`
}

type OrderEventItemData struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

func OrderEventDataFrom(o *Order) OrderEventData {
	data := OrderEventData{
		ID:            o.ID.String(),
		OrderNumber:   o.OrderNumber,
		Status:        string(o.Status),
		PaymentStatus: string(o.PaymentStatus),
		Items:         make([]OrderEventItemData, 0, len(o.Items)),
	}
	for _, it := range o.Items {
		data.Items = append(data.Items, OrderEventItemData{ID: it.ID.String(), Status: string(it.Status)})
	}
	return data
}
