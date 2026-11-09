package usecase

import (
	"context"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

func buildOrder(
	ctx context.Context,
	menuRepo domain.MenuRepository,
	settingRepo domain.SettingRepository,
	lines []CreateOrderItem,
	orderType domain.OrderType,
	tableID, createdBy *uuid.UUID,
) (*domain.Order, []domain.OrderItem, error) {
	s, err := settingRepo.GetFirst(ctx)
	if err != nil {
		return nil, nil, err
	}
	if s != nil && !s.IsOpen {
		return nil, nil, domain.NewError(domain.CodeStoreClosed, "store is currently closed", 409, nil)
	}
	if len(lines) == 0 {
		return nil, nil, domain.NewError(domain.CodeValidationError, "items is required", 400, nil)
	}

	ids := make([]uuid.UUID, len(lines))
	for i := range lines {
		ids[i] = lines[i].MenuID
	}
	menus, err := menuRepo.ListAvailableByIDs(ctx, ids)
	if err != nil {
		return nil, nil, err
	}
	byID := make(map[uuid.UUID]domain.Menu, len(menus))
	for _, m := range menus {
		byID[m.ID] = m
	}

	var sub int64
	items := make([]domain.OrderItem, len(lines))
	for i, v := range lines {
		m, ok := byID[v.MenuID]
		if !ok {
			return nil, nil, domain.NewError(domain.CodeNotFound, "menu not found or unavailable", 404, nil)
		}
		sub += m.Price * int64(v.Qty)
		items[i] = domain.OrderItem{
			MenuID: v.MenuID,
			Qty:    v.Qty,
			Note:   v.Note,
			Price:  m.Price,
			Status: domain.OrderItemStatusPending,
			Menu:   m,
		}
	}

	tax := float64(0)
	if s != nil {
		tax = s.TaxPercent
	}
	taxAmt := domain.CalcTax(sub, tax)

	order := &domain.Order{
		OrderType:      orderType,
		TableID:        tableID,
		CreatedBy:      createdBy,
		Status:         domain.OrderStatusWaiting,
		SubtotalAmount: sub,
		TaxPercent:     tax,
		TaxAmount:      taxAmt,
		TotalAmount:    sub + taxAmt,
		PaymentStatus:  domain.PaymentStatusUnpaid,
	}

	return order, items, nil
}
