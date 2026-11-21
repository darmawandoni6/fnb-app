package domain

import "context"

type OrderEvent struct {
	Event string // order.created order.updated item.updated
	Order *Order
}

type Publisher interface {
	PublishOrder(ctx context.Context, ev OrderEvent)
	PublishSession(ctx context.Context, sessionToken string, ev OrderEvent)
}
