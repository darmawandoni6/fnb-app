package usecase

import (
	"context"
	"log/slog"
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
	gateway     domain.SnapGateway
	logger      *slog.Logger
	loc         *time.Location
}

func NewOrderUsecase(
	orderRepo domain.OrderQueryRepository,
	menuRepo domain.MenuRepository,
	settingRepo domain.SettingRepository,
	withTx TxRunner,
	publisher domain.Publisher,
	gateway domain.SnapGateway,
	logger *slog.Logger,
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
		gateway:     gateway,
		logger:      logger,
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
		if err := tx.Audit(ctx, audit); err != nil {
			return err
		}
		if log := pendingPaymentLog(order); log != nil {
			return tx.CreatePaymentLog(ctx, log)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	order.Items = items
	attachSnap(ctx, u.gateway, order, items, u.logger)
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
		if target == domain.OrderItemStatusReady {
			targetItem.ReadyAt = &now
		}
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

type ConfirmPaymentInput struct {
	Method         domain.PaymentMethod
	AmountReceived *int64
	ChangeAmount   *int64
}

func (u *OrderUsecase) ConfirmPayment(ctx context.Context, orderID uuid.UUID, in ConfirmPaymentInput, actorID uuid.UUID, actorRole domain.UserRole) (*domain.Order, error) {
	order, err := u.orderRepo.GetByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order == nil {
		return nil, domain.NewError(domain.CodeNotFound, "order not found", http.StatusNotFound, nil)
	}

	if order.PaymentStatus == domain.PaymentStatusPaid {
		return order, nil
	}

	if order.CanceledAt != nil {
		return nil, domain.NewError(domain.CodeInvalidTransition, "cannot confirm payment for a cancelled order", http.StatusConflict, nil)
	}

	if !in.Method.Valid() {
		return nil, domain.NewError(domain.CodeValidationError, "valid payment method is required (CASH or NON_CASH)", http.StatusBadRequest, nil)
	}

	now := time.Now().UTC()
	var amountReceived, changeAmount *int64

	if in.Method == domain.PaymentMethodCash {
		if in.AmountReceived == nil || *in.AmountReceived < order.TotalAmount {
			return nil, domain.NewError(domain.CodeValidationError, "amount_received must be >= total_amount for CASH payment", http.StatusBadRequest, nil)
		}
		change := *in.AmountReceived - order.TotalAmount
		if in.ChangeAmount != nil && *in.ChangeAmount != change {
			return nil, domain.NewError(domain.CodeValidationError, "change_amount does not match amount_received - total_amount", http.StatusBadRequest, nil)
		}
		amountReceived = in.AmountReceived
		changeAmount = &change
	}

	err = u.withTx(ctx, func(tx OrderTx) error {
		if err := tx.SetPaid(ctx, order.ID, in.Method, nil, now, amountReceived, changeAmount); err != nil {
			return err
		}

		pending, err := tx.GetPendingPaymentLog(ctx, order.ID)
		if err != nil {
			return err
		}
		if pending != nil {
			if err := tx.UpdatePaymentLogStatus(ctx, pending.ID, domain.PaymentLogStatusSettled, nil, nil); err != nil {
				return err
			}
		} else {
			pLog := &domain.PaymentLog{
				OrderID: order.ID,
				Method:  in.Method,
				Amount:  order.TotalAmount,
				Status:  domain.PaymentLogStatusSettled,
			}
			if err := tx.CreatePaymentLog(ctx, pLog); err != nil {
				return err
			}
		}

		newStatus := domain.AggregateOrderStatus(order.Items, domain.PaymentStatusPaid, false)
		if newStatus != order.Status {
			if err := tx.UpdateAggregate(ctx, order.ID, newStatus); err != nil {
				return err
			}
			order.Status = newStatus
		}

		audit := &domain.AuditLog{
			Entity:    "order",
			EntityID:  order.ID,
			Action:    "payment_confirmed",
			ActorID:   &actorID,
			ActorRole: &actorRole,
		}
		return tx.Audit(ctx, audit)
	})
	if err != nil {
		return nil, err
	}

	order.PaymentStatus = domain.PaymentStatusPaid
	order.PaymentMethod = &in.Method
	order.PaidAt = &now
	order.AmountReceived = amountReceived
	order.ChangeAmount = changeAmount

	if u.publisher != nil {
		u.publisher.PublishOrder(ctx, domain.OrderEvent{Event: "order.updated", Order: order})
		if order.TableSession != nil && order.TableSession.SessionToken != "" {
			u.publisher.PublishSession(ctx, order.TableSession.SessionToken, domain.OrderEvent{Event: "order.updated", Order: order})
		}
	}

	return order, nil
}
