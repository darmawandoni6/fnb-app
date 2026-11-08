package usecase

import (
	"context"
	"net/http"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

type OrderUsecase struct {
	orderRepo   domain.OrderQueryRepository
	menuRepo    domain.MenuRepository
	settingRepo domain.SettingRepository
	withTx      TxRunner
}

func NewOrderUsecase(
	orderRepo domain.OrderQueryRepository,
	menuRepo domain.MenuRepository,
	settingRepo domain.SettingRepository,
	withTx TxRunner,
) *OrderUsecase {
	return &OrderUsecase{
		orderRepo:   orderRepo,
		menuRepo:    menuRepo,
		settingRepo: settingRepo,
		withTx:      withTx,
	}
}

func (u *OrderUsecase) List(ctx context.Context, filter domain.OrderFilter, role domain.UserRole) ([]domain.Order, error) {
	if role == domain.UserRoleKitchen {
		filter.PaidOnly = true
	}
	return u.orderRepo.List(ctx, filter)
}

func (u *OrderUsecase) Get(ctx context.Context, id uuid.UUID, role domain.UserRole) (*domain.Order, error) {
	order, err := u.orderRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, domain.NewError(domain.CodeNotFound, "order not found", http.StatusNotFound, nil)
	}
	if role == domain.UserRoleKitchen && order.PaymentStatus != domain.PaymentStatusPaid {
		return nil, domain.NewError(domain.CodeNotFound, "order not found", http.StatusNotFound, nil)
	}
	return order, nil
}

func (u *OrderUsecase) CreateManual(ctx context.Context, actorID uuid.UUID, items []CreateOrderItem) (*domain.Order, error) {
	order, orderItems, err := buildOrder(ctx, u.menuRepo, u.settingRepo, items, domain.OrderTypeManual, nil, &actorID)
	if err != nil {
		return nil, err
	}

	err = u.withTx(ctx, func(tx OrderTx) error {
		if err := tx.CreateOrder(ctx, order); err != nil {
			return err
		}
		for i := range orderItems {
			orderItems[i].OrderID = order.ID
		}
		if err := tx.CreateItems(ctx, orderItems); err != nil {
			return err
		}
		return tx.ConsumeStock(ctx, orderItems)
	})
	if err != nil {
		return nil, err
	}
	order.Items = orderItems
	return order, nil
}

func (u *OrderUsecase) UpdatePayment(ctx context.Context, id uuid.UUID, status domain.PaymentStatus, method *domain.PaymentMethod) (*domain.Order, error) {
	if status != domain.PaymentStatusPaid {
		return nil, domain.NewError(domain.CodeInvalidTransition, "only payment status LUNAS is supported", http.StatusConflict, nil)
	}
	if method == nil || (*method != domain.PaymentMethodCash && *method != domain.PaymentMethodNonCash) {
		return nil, domain.NewError(domain.CodeValidationError, "valid payment method is required (CASH or NON_CASH)", http.StatusBadRequest, nil)
	}

	order, err := u.orderRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, domain.NewError(domain.CodeNotFound, "order not found", http.StatusNotFound, nil)
	}
	if order.PaymentStatus == domain.PaymentStatusPaid {
		return nil, domain.NewError(domain.CodeInvalidTransition, "order is already paid", http.StatusConflict, nil)
	}

	err = u.withTx(ctx, func(tx OrderTx) error {
		if err := tx.SetPayment(ctx, order.ID, status, method); err != nil {
			return err
		}
		newStatus := domain.AggregateOrderStatus(order.Items, status)
		if newStatus != order.Status {
			if err := tx.UpdateAggregate(ctx, order.ID, newStatus); err != nil {
				return err
			}
			order.Status = newStatus
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	order.PaymentStatus = status
	order.PaymentMethod = method
	return order, nil
}

func (u *OrderUsecase) UpdateItemStatus(ctx context.Context, orderID, itemID uuid.UUID, target domain.OrderItemStatus, role domain.UserRole) (*domain.Order, error) {
	switch target {
	case domain.OrderItemStatusCooking, domain.OrderItemStatusReady:
		if role != domain.UserRoleKitchen && role != domain.UserRoleOwner {
			return nil, domain.NewError(domain.CodeForbidden, "insufficient permissions for item status", http.StatusForbidden, nil)
		}
	case domain.OrderItemStatusDelivered:
		if role != domain.UserRoleCashier && role != domain.UserRoleOwner {
			return nil, domain.NewError(domain.CodeForbidden, "insufficient permissions for item status", http.StatusForbidden, nil)
		}
	default:
		return nil, domain.NewError(domain.CodeInvalidTransition, "unsupported target item status", http.StatusConflict, nil)
	}

	order, err := u.orderRepo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, domain.NewError(domain.CodeNotFound, "order not found", http.StatusNotFound, nil)
	}

	var targetItem *domain.OrderItem
	for i := range order.Items {
		if order.Items[i].ID == itemID {
			targetItem = &order.Items[i]
			break
		}
	}
	if targetItem == nil {
		return nil, domain.NewError(domain.CodeNotFound, "order item not found", http.StatusNotFound, nil)
	}

	if err := domain.ValidateItemTransition(targetItem.Status, target); err != nil {
		return nil, err
	}

	if target == domain.OrderItemStatusCooking && order.PaymentStatus != domain.PaymentStatusPaid {
		return nil, domain.NewError(domain.CodePaymentRequired, "cannot cook unpaid order", http.StatusConflict, nil)
	}

	fromStatus := targetItem.Status
	err = u.withTx(ctx, func(tx OrderTx) error {
		if err := tx.SetItemStatus(ctx, orderID, itemID, fromStatus, target); err != nil {
			return err
		}
		targetItem.Status = target
		newStatus := domain.AggregateOrderStatus(order.Items, order.PaymentStatus)
		if newStatus != order.Status {
			if err := tx.UpdateAggregate(ctx, order.ID, newStatus); err != nil {
				return err
			}
			order.Status = newStatus
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return order, nil
}

func (u *OrderUsecase) CancelItem(ctx context.Context, orderID, itemID, actorID uuid.UUID) (*domain.Order, error) {
	order, err := u.orderRepo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, domain.NewError(domain.CodeNotFound, "order not found", http.StatusNotFound, nil)
	}

	return cancelOrderItem(ctx, order, itemID, &actorID, "staff cancelled item", u.withTx)
}
