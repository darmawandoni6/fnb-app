package domain

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var ErrGatewayUnavailable = errors.New("payment gateway unavailable")

type SnapRequest struct {
	OrderNumber string
	OrderID     uuid.UUID
	GrossAmount int64
	Customer    struct{ Name, Phone string }
	Items       []SnapItem
}

type SnapItem struct {
	ID       string
	Name     string
	Price    int64
	Quantity int
}

type SnapResponse struct {
	Token       string
	RedirectURL string
}

type SnapGateway interface {
	CreateSnap(ctx context.Context, req SnapRequest) (*SnapResponse, error)
}

func BuildSnapRequest(o *Order, items []OrderItem) SnapRequest {
	customerName := o.CustomerName
	if customerName == "" {
		customerName = "Take Away"
	}
	var phone string
	if o.CustomerPhone != nil {
		phone = *o.CustomerPhone
	}

	lines := make([]SnapItem, 0, len(items)+2)
	for _, it := range items {
		lines = append(lines, SnapItem{
			ID:       it.MenuID.String(),
			Name:     it.MenuNameSnapshot,
			Price:    it.Price,
			Quantity: it.Qty,
		})
	}
	if o.ServiceAmount > 0 {
		lines = append(lines, SnapItem{ID: "service", Name: "Service", Price: o.ServiceAmount, Quantity: 1})
	}
	if o.TaxAmount > 0 {
		lines = append(lines, SnapItem{ID: "tax", Name: "Tax", Price: o.TaxAmount, Quantity: 1})
	}

	return SnapRequest{
		OrderNumber: o.OrderNumber,
		OrderID:     o.ID,
		GrossAmount: o.TotalAmount,
		Customer:    struct{ Name, Phone string }{Name: customerName, Phone: phone},
		Items:       lines,
	}
}
