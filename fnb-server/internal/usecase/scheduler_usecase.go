package usecase

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

const (
	jobCashTimeout  = "job_cash_timeout"
	jobAutoDeliver  = "job_auto_deliver"
	jobAutoComplete = "job_auto_complete"
	jobSessionClose = "job_session_close"

	schedulerBatchLimit = 500
)

type SchedulerUsecase struct {
	orderRepo   domain.OrderQueryRepository
	orderTx     TxRunner
	sessionRepo domain.TableSessionRepository
	settingRepo domain.SettingRepository
	publisher   domain.Publisher
	clock       func() time.Time
	log         *slog.Logger
	jobErrors   map[string]int
}

func NewSchedulerUsecase(
	orderRepo domain.OrderQueryRepository,
	orderTx TxRunner,
	sessionRepo domain.TableSessionRepository,
	settingRepo domain.SettingRepository,
	publisher domain.Publisher,
	clock func() time.Time,
	log *slog.Logger,
) *SchedulerUsecase {
	if clock == nil {
		clock = func() time.Time { return time.Now().UTC() }
	}
	return &SchedulerUsecase{
		orderRepo:   orderRepo,
		orderTx:     orderTx,
		sessionRepo: sessionRepo,
		settingRepo: settingRepo,
		publisher:   publisher,
		clock:       clock,
		log:         log,
		jobErrors:   make(map[string]int),
	}
}

func (u *SchedulerUsecase) Tick(ctx context.Context) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}

	setting, err := u.settingRepo.GetFirst(ctx)
	if err != nil {
		return u.fail(jobCashTimeout, err)
	}

	var errs []error
	if err := u.cashTimeout(ctx, setting); err != nil {
		errs = append(errs, u.fail(jobCashTimeout, err))
	}
	if err := u.autoDeliver(ctx, setting); err != nil {
		errs = append(errs, u.fail(jobAutoDeliver, err))
	}
	if err := u.autoComplete(ctx, setting); err != nil {
		errs = append(errs, u.fail(jobAutoComplete, err))
	}
	if err := u.closeSessions(ctx); err != nil {
		errs = append(errs, u.fail(jobSessionClose, err))
	}
	return errors.Join(errs...)
}

func (u *SchedulerUsecase) fail(job string, err error) error {
	u.jobErrors[job]++
	if u.log != nil {
		level := slog.LevelWarn
		if u.jobErrors[job] >= 2 {
			level = slog.LevelError
		}
		u.log.Log(context.Background(), level, "scheduler job failed", "job", job, "consecutive_failures", u.jobErrors[job], "error", err)
	}
	return errors.Join(errors.New(job), err)
}

func (u *SchedulerUsecase) succeeded(job string) {
	u.jobErrors[job] = 0
}

func (u *SchedulerUsecase) cashTimeout(ctx context.Context, s *domain.Setting) error {
	minutes := 15
	if s != nil && s.CashTimeoutMinutes > 0 {
		minutes = s.CashTimeoutMinutes
	}
	cutoff := u.clock().Add(-time.Duration(minutes) * time.Minute)

	ids, err := u.orderRepo.ListCashTimeoutIDs(ctx, domain.CashTimeoutQuery{Cutoff: cutoff, Limit: schedulerBatchLimit})
	if err != nil {
		return err
	}

	reason := "cash timeout"
	for _, id := range ids {
		order, err := u.orderRepo.GetByID(ctx, id)
		if err != nil {
			return err
		}
		if order == nil || order.PaymentStatus != domain.PaymentStatusUnpaid || order.CanceledAt != nil {
			continue
		}
		if order.PaymentMethod == nil || *order.PaymentMethod != domain.PaymentMethodCash {
			continue
		}
		if _, err := cancelOrderHelper(ctx, u.orderRepo, u.orderTx, u.publisher, id, reason, nil, nil); err != nil {
			var appErr *domain.AppError
			if errors.As(err, &appErr) && appErr.Code == domain.CodeInvalidTransition {
				continue
			}
			return err
		}
	}
	u.succeeded(jobCashTimeout)
	return nil
}

func (u *SchedulerUsecase) autoDeliver(ctx context.Context, s *domain.Setting) error {
	if s == nil || s.ReadyAutoDeliverMinutes <= 0 {
		return nil
	}
	cutoff := u.clock().Add(-time.Duration(s.ReadyAutoDeliverMinutes) * time.Minute)
	moves, err := u.orderRepo.ListItemMoves(ctx, domain.ItemMoveQuery{
		From:  domain.OrderItemStatusReady,
		Since: &cutoff,
		Limit: schedulerBatchLimit,
	})
	if err != nil {
		return err
	}
	if err := u.applyItemMoves(ctx, moves, domain.OrderItemStatusDelivered, "auto_deliver"); err != nil {
		return err
	}
	u.succeeded(jobAutoDeliver)
	return nil
}

func (u *SchedulerUsecase) autoComplete(ctx context.Context, s *domain.Setting) error {
	if s == nil || s.DeliveredAutoCompleteMinutes <= 0 {
		return nil
	}
	cutoff := u.clock().Add(-time.Duration(s.DeliveredAutoCompleteMinutes) * time.Minute)
	moves, err := u.orderRepo.ListItemMoves(ctx, domain.ItemMoveQuery{
		From:  domain.OrderItemStatusDelivered,
		Until: &cutoff,
		Limit: schedulerBatchLimit,
	})
	if err != nil {
		return err
	}
	if err := u.applyItemMoves(ctx, moves, domain.OrderItemStatusCompleted, "auto_complete"); err != nil {
		return err
	}
	u.succeeded(jobAutoComplete)
	return nil
}

func (u *SchedulerUsecase) applyItemMoves(ctx context.Context, moves []domain.ItemMove, to domain.OrderItemStatus, action string) error {
	orders := make(map[uuid.UUID]*domain.Order)
	for _, mv := range moves {
		order, ok := orders[mv.OrderID]
		if !ok {
			var err error
			order, err = u.orderRepo.GetByID(ctx, mv.OrderID)
			if err != nil {
				return err
			}
			if order == nil {
				continue
			}
			orders[mv.OrderID] = order
		}

		snapshot := order
		err := u.orderTx(ctx, func(tx OrderTx) error {
			if err := tx.SetItemStatus(ctx, mv.OrderID, mv.ItemID, mv.From, to, nil); err != nil {
				return err
			}

			items := make([]domain.OrderItem, len(snapshot.Items))
			copy(items, snapshot.Items)
			for i := range items {
				if items[i].ID == mv.ItemID {
					items[i].Status = to
				}
			}

			if newStatus := domain.AggregateOrderStatus(items, snapshot.PaymentStatus, snapshot.CanceledAt != nil); newStatus != snapshot.Status {
				if err := tx.UpdateAggregate(ctx, snapshot.ID, newStatus); err != nil {
					return err
				}
			}

			fromStr, toStr := string(mv.From), string(to)
			return tx.Audit(ctx, &domain.AuditLog{
				Entity:    "order_item",
				EntityID:  mv.ItemID,
				Action:    action,
				FromValue: &fromStr,
				ToValue:   &toStr,
			})
		})
		if err != nil {
			return err
		}

		updated := *snapshot
		updated.Items = make([]domain.OrderItem, len(snapshot.Items))
		copy(updated.Items, snapshot.Items)
		updated.Status = domain.AggregateOrderStatus(updated.Items, snapshot.PaymentStatus, snapshot.CanceledAt != nil)
		now := u.clock()
		for i := range updated.Items {
			if updated.Items[i].ID == mv.ItemID {
				updated.Items[i].Status = to
				if to == domain.OrderItemStatusDelivered {
					updated.Items[i].DeliveredAt = &now
				}
				if to == domain.OrderItemStatusCompleted {
					updated.Items[i].CompletedAt = &now
				}
			}
		}
		u.publishOrder(ctx, &updated, "item.updated")
	}
	return nil
}

func (u *SchedulerUsecase) closeSessions(ctx context.Context) error {
	sessions, err := u.sessionRepo.ListIdleOpen(ctx, domain.IdleSessionQuery{
		ExcludeStatuses: []domain.OrderStatus{domain.OrderStatusWaiting, domain.OrderStatusProcessing},
		Limit:           schedulerBatchLimit,
	})
	if err != nil {
		return err
	}
	for _, session := range sessions {
		closedBy := (*uuid.UUID)(nil)
		if err := u.sessionRepo.Close(ctx, session.ID, closedBy); err != nil {
			return err
		}
		fromStr, toStr := string(session.Status), string(domain.TableSessionStatusClosed)
		if err := u.orderTx(ctx, func(tx OrderTx) error {
			return tx.Audit(ctx, &domain.AuditLog{
				Entity:    "table_session",
				EntityID:  session.ID,
				Action:    "session_closed",
				FromValue: &fromStr,
				ToValue:   &toStr,
			})
		}); err != nil {
			return err
		}
		if u.publisher != nil {
			u.publisher.PublishSession(ctx, session.SessionToken, domain.OrderEvent{Event: "session.closed", Order: &domain.Order{ID: session.ID, OrderNumber: session.SessionToken}})
		}
	}
	u.succeeded(jobSessionClose)
	return nil
}

func (u *SchedulerUsecase) publishOrder(ctx context.Context, order *domain.Order, event string) {
	if u.publisher == nil {
		return
	}
	u.publisher.PublishOrder(ctx, domain.OrderEvent{Event: event, Order: order})
	if order.TableSession != nil && order.TableSession.SessionToken != "" {
		u.publisher.PublishSession(ctx, order.TableSession.SessionToken, domain.OrderEvent{Event: event, Order: order})
	}
}
