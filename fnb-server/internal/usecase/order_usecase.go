package usecase

import (
	"context"
	"net/http"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

type OrderUsecase struct {
	orderRepo   domain.OrderQueryRepository
	menuRepo    domain.MenuRepository
	settingRepo domain.SettingRepository
	withTx      TxRunner
	publisher   domain.Publisher
	loc         *time.Location
}

func NewOrderUsecase(
	orderRepo domain.OrderQueryRepository,
	menuRepo domain.MenuRepository,
	settingRepo domain.SettingRepository,
	withTx TxRunner,
	publisher domain.Publisher,
	loc *time.Location,
) *OrderUsecase {
	if loc == nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	return &OrderUsecase{
		orderRepo:   orderRepo,
		menuRepo:    menuRepo,
		settingRepo: settingRepo,
		withTx:      withTx,
		publisher:   publisher,
		loc:         loc,
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

func (u *OrderUsecase) CreateManual(ctx context.Context, actorID uuid.UUID, in OrderInput) (*domain.Order, error) {
	order, items, err := buildOrder(ctx, u.menuRepo, u.settingRepo, in, domain.OrderTypeTakeAway, nil, nil, &actorID)
	if err != nil {
		return nil, err
	}

	day := time.Now().In(u.loc)
	actorRole := domain.UserRoleCashier
	statusStr := string(order.Status)

	err = u.withTx(ctx, func(tx OrderTx) error {
		num, err := tx.NextOrderNumber(ctx, order.OrderType, day)
		if err != nil {
			return err
		}
		order.OrderNumber = num

		if err := tx.CreateOrder(ctx, order); err != nil {
			return err
		}
		for i := range items {
			items[i].OrderID = order.ID
		}
		if err := tx.CreateItems(ctx, items); err != nil {
			return err
		}
		if err := tx.ConsumeStock(ctx, order, items); err != nil {
			return err
		}
		if err := tx.UpdateAggregate(ctx, order.ID, domain.OrderStatusWaiting); err != nil {
			return err
		}
		audit := &domain.AuditLog{
			Entity:    "order",
			EntityID:  order.ID,
			Action:    "order_created",
			ToValue:   &statusStr,
			ActorID:   &actorID,
			ActorRole: &actorRole,
		}
		return tx.Audit(ctx, audit)
	})
	if err != nil {
		return nil, err
	}

	order.Items = items
	if u.publisher != nil {
		u.publisher.PublishOrder(ctx, domain.OrderEvent{Event: "order.created", Order: order})
	}

	return order, nil
}

func (u *OrderUsecase) UpdateItemStatus(
	ctx context.Context,
	orderID, itemID uuid.UUID,
	target domain.OrderItemStatus,
	actorID uuid.UUID,
	role domain.UserRole,
) (*domain.Order, error) {
	order, err := u.orderRepo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, domain.NewError(domain.CodeNotFound, "order not found", http.StatusNotFound, nil)
	}
	if role == domain.UserRoleKitchen && order.PaymentStatus != domain.PaymentStatusPaid {
		return nil, domain.NewError(domain.CodeNotFound, "order not found", http.StatusNotFound, nil)
	}

	switch target {
	case domain.OrderItemStatusCooking, domain.OrderItemStatusReady:
		if role != domain.UserRoleKitchen && role != domain.UserRoleOwner {
			return nil, domain.NewError(domain.CodeForbidden, "insufficient permissions for item transition", http.StatusForbidden, nil)
		}
	case domain.OrderItemStatusDelivered, domain.OrderItemStatusCompleted:
		allowed := role == domain.UserRoleKitchen || role == domain.UserRoleOwner ||
			(role == domain.UserRoleCashier && order.OrderType == domain.OrderTypeTakeAway)
		if !allowed {
			return nil, domain.NewError(domain.CodeForbidden, "insufficient permissions for item transition", http.StatusForbidden, nil)
		}
	default:
		return nil, domain.NewError(domain.CodeInvalidTransition, "unsupported target item status", http.StatusConflict, nil)
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

	if targetItem.Status == target {
		return order, nil
	}

	if err := domain.ValidateItemTransition(targetItem.Status, target); err != nil {
		return nil, err
	}

	if target == domain.OrderItemStatusCooking && order.PaymentStatus != domain.PaymentStatusPaid {
		return nil, domain.NewError(domain.CodePaymentRequired, "cannot cook unpaid order", http.StatusConflict, nil)
	}

	fromStatus := targetItem.Status
	fromStr := string(fromStatus)
	toStr := string(target)
	now := time.Now().UTC()
	aggregateChanged := false

	err = u.withTx(ctx, func(tx OrderTx) error {
		if err := tx.SetItemStatus(ctx, orderID, itemID, fromStatus, target, &actorID); err != nil {
			return err
		}
		targetItem.Status = target
		targetItem.UpdatedBy = &actorID
		if target == domain.OrderItemStatusDelivered {
			targetItem.DeliveredAt = &now
		}
		if target == domain.OrderItemStatusCompleted {
			targetItem.CompletedAt = &now
		}

		newStatus := domain.AggregateOrderStatus(order.Items, order.PaymentStatus, order.CanceledAt != nil)
		if newStatus != order.Status {
			if err := tx.UpdateAggregate(ctx, order.ID, newStatus); err != nil {
				return err
			}
			order.Status = newStatus
			aggregateChanged = true
		}

		audit := &domain.AuditLog{
			Entity:    "order_item",
			EntityID:  itemID,
			Action:    "status_changed",
			FromValue: &fromStr,
			ToValue:   &toStr,
			ActorID:   &actorID,
			ActorRole: &role,
		}
		return tx.Audit(ctx, audit)
	})
	if err != nil {
		return nil, err
	}

	if u.publisher != nil {
		u.publisher.PublishOrder(ctx, domain.OrderEvent{Event: "item.updated", Order: order})
		if aggregateChanged {
			u.publisher.PublishOrder(ctx, domain.OrderEvent{Event: "order.updated", Order: order})
		}
		if order.TableSession != nil && order.TableSession.SessionToken != "" {
			u.publisher.PublishSession(ctx, order.TableSession.SessionToken, domain.OrderEvent{Event: "item.updated", Order: order})
			if aggregateChanged {
				u.publisher.PublishSession(ctx, order.TableSession.SessionToken, domain.OrderEvent{Event: "order.updated", Order: order})
			}
		}
	}

	return order, nil
}

func (u *OrderUsecase) CancelOrder(ctx context.Context, orderID uuid.UUID, reason string, actorID *uuid.UUID, actorRole *domain.UserRole) (*domain.Order, error) {
	return cancelOrderHelper(ctx, u.orderRepo, u.withTx, u.publisher, orderID, reason, actorID, actorRole)
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

	now := time.Now().UTC()
	err = u.withTx(ctx, func(tx OrderTx) error {
		newStatus := domain.AggregateOrderStatus(order.Items, status, order.CanceledAt != nil)
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
	order.PaidAt = &now
	return order, nil
}
