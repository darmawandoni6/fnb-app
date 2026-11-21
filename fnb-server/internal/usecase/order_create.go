package usecase

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

type CreateOrderItem struct {
	MenuID uuid.UUID
	Qty    int
	Note   *string
}

type OrderInput struct {
	CustomerName  string
	CustomerPhone *string
	PaymentMethod domain.PaymentMethod
	Items         []CreateOrderItem
}

func buildOrder(
	ctx context.Context,
	menuRepo domain.MenuRepository,
	settingRepo domain.SettingRepository,
	in OrderInput,
	orderType domain.OrderType,
	tableID, sessionID, createdBy *uuid.UUID,
) (*domain.Order, []domain.OrderItem, error) {
	s, err := settingRepo.GetFirst(ctx)
	if err != nil {
		return nil, nil, err
	}
	if s != nil && !s.IsOpen {
		return nil, nil, domain.NewError(domain.CodeStoreClosed, "store is currently closed", http.StatusConflict, nil)
	}

	trimmedName := strings.TrimSpace(in.CustomerName)
	if trimmedName == "" {
		return nil, nil, domain.NewError(domain.CodeValidationError, "customer_name is required", http.StatusBadRequest, nil)
	}
	if len(trimmedName) > 100 {
		return nil, nil, domain.NewError(domain.CodeValidationError, "customer_name maximum 100 characters", http.StatusBadRequest, nil)
	}

	var trimmedPhone *string
	if in.CustomerPhone != nil {
		tp := strings.TrimSpace(*in.CustomerPhone)
		if tp != "" {
			if len(tp) > 20 {
				return nil, nil, domain.NewError(domain.CodeValidationError, "customer_phone maximum 20 characters", http.StatusBadRequest, nil)
			}
			trimmedPhone = &tp
		}
	}

	if in.PaymentMethod != domain.PaymentMethodCash && in.PaymentMethod != domain.PaymentMethodNonCash {
		return nil, nil, domain.NewError(domain.CodeValidationError, "payment_method must be CASH or NON_CASH", http.StatusBadRequest, nil)
	}

	if len(in.Items) == 0 {
		return nil, nil, domain.NewError(domain.CodeValidationError, "items is required", http.StatusBadRequest, nil)
	}

	ids := make([]uuid.UUID, len(in.Items))
	for i, item := range in.Items {
		if item.Qty <= 0 {
			return nil, nil, domain.NewError(domain.CodeValidationError, "qty must be greater than 0", http.StatusBadRequest, nil)
		}
		ids[i] = item.MenuID
	}

	menus, err := menuRepo.ListAvailableByIDs(ctx, ids)
	if err != nil {
		return nil, nil, err
	}
	byID := make(map[uuid.UUID]domain.Menu, len(menus))
	for _, m := range menus {
		byID[m.ID] = m
	}

	for _, item := range in.Items {
		if _, ok := byID[item.MenuID]; !ok {
			return nil, nil, domain.NewError(domain.CodeNotFound, fmt.Sprintf("menu %s not found or unavailable", item.MenuID), http.StatusNotFound, nil)
		}
	}

	var subtotal int64
	items := make([]domain.OrderItem, len(in.Items))
	for i, v := range in.Items {
		m := byID[v.MenuID]
		subtotal += m.Price * int64(v.Qty)
		items[i] = domain.OrderItem{
			MenuID:           v.MenuID,
			MenuNameSnapshot: m.Name,
			Qty:              v.Qty,
			Note:             v.Note,
			Price:            m.Price,
			Status:           domain.OrderItemStatusPending,
			Menu:             m,
		}
	}

	serviceRate := float64(0)
	taxRate := float64(0)
	if s != nil {
		serviceRate = s.ServiceRate
		taxRate = s.TaxRate
	}
	totals := domain.CalcTotals(subtotal, serviceRate, taxRate)

	order := &domain.Order{
		OrderType:           orderType,
		TableID:             tableID,
		TableSessionID:      sessionID,
		CreatedBy:           createdBy,
		CustomerName:        trimmedName,
		CustomerPhone:       trimmedPhone,
		Status:              domain.OrderStatusWaiting,
		PaymentStatus:       domain.PaymentStatusUnpaid,
		PaymentMethod:       &in.PaymentMethod,
		SubtotalAmount:      totals.Subtotal,
		ServiceRateSnapshot: serviceRate,
		ServiceAmount:       totals.Service,
		TaxRateSnapshot:     taxRate,
		TaxAmount:           totals.Tax,
		TotalAmount:         totals.Total,
	}

	return order, items, nil
}
