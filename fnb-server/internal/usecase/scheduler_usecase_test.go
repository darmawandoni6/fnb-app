package usecase

import (
	"context"
	"testing"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

type schedulerFixture struct {
	repo     *mockOrderQueryRepo
	sessions *mockTableSessionRepo
	settings *mockSettingRepo
	tx       *mockTx
	uc       *SchedulerUsecase
	now      time.Time
}

type failingSettingRepo struct{}

func (failingSettingRepo) GetFirst(context.Context) (*domain.Setting, error) {
	return nil, domain.NewError(domain.CodeInternalError, "db down", 500, nil)
}

func newSchedulerFixture(setting *domain.Setting, orders ...*domain.Order) *schedulerFixture {
	byID := make(map[uuid.UUID]*domain.Order, len(orders))
	list := make([]domain.Order, 0, len(orders))
	for _, o := range orders {
		byID[o.ID] = o
		list = append(list, *o)
	}
	repo := &mockOrderQueryRepo{orders: list, byID: byID}
	sessions := newMockTableSessionRepo()
	settings := &mockSettingRepo{setting: setting}
	tx := &mockTx{}
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)
	uc := NewSchedulerUsecase(repo, newTestTxRunner(tx), sessions, settings, nil, func() time.Time { return now }, nil)
	return &schedulerFixture{repo: repo, sessions: sessions, settings: settings, tx: tx, uc: uc, now: now}
}

func cashOrder(minutesAgo int, now time.Time) *domain.Order {
	method := domain.PaymentMethodCash
	return &domain.Order{
		ID:            uuid.New(),
		OrderNumber:   "TA-20261121-001",
		Status:        domain.OrderStatusWaiting,
		PaymentStatus: domain.PaymentStatusUnpaid,
		PaymentMethod: &method,
		CreatedAt:     now.Add(-time.Duration(minutesAgo) * time.Minute),
		Items:         []domain.OrderItem{{ID: uuid.New(), Status: domain.OrderItemStatusPending}},
	}
}

func TestScheduler_CashTimeoutCancelsOnlyUnpaidCash(t *testing.T) {
	setting := &domain.Setting{CashTimeoutMinutes: 15}
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)

	old := cashOrder(16, now)
	young := cashOrder(5, now)

	paid := cashOrder(30, now)
	paid.PaymentStatus = domain.PaymentStatusPaid

	nonCashMethod := domain.PaymentMethodNonCash
	nonCash := cashOrder(30, now)
	nonCash.PaymentMethod = &nonCashMethod

	f := newSchedulerFixture(setting, old, young, paid, nonCash)

	if err := f.uc.cashTimeout(context.Background(), setting); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if f.tx.cancelledOrder != old.ID {
		t.Errorf("expected only the old cash order cancelled, got %v", f.tx.cancelledOrder)
	}
	if f.tx.cancelReason != "cash timeout" {
		t.Errorf("expected reason %q, got %q", "cash timeout", f.tx.cancelReason)
	}
	if f.tx.restoreCount != 1 {
		t.Errorf("expected one stock restore, got %d", f.tx.restoreCount)
	}

	f.tx.cancelledOrder = uuid.Nil
	f.tx.restoreCount = 0
	if err := f.uc.cashTimeout(context.Background(), setting); err != nil {
		t.Fatalf("unexpected error on second tick: %v", err)
	}
	if f.tx.cancelledOrder != uuid.Nil || f.tx.restoreCount != 0 {
		t.Error("second tick must not cancel anything again")
	}
}

func readyOrder(minutesAgo int, now time.Time) *domain.Order {
	return &domain.Order{
		ID:            uuid.New(),
		OrderNumber:   "DI-20261121-002",
		Status:        domain.OrderStatusProcessing,
		PaymentStatus: domain.PaymentStatusPaid,
		Items:         []domain.OrderItem{{ID: uuid.New(), Status: domain.OrderItemStatusReady, UpdatedBy: nil, DeliveredAt: ptrTime(now.Add(-time.Duration(minutesAgo) * time.Minute))}},
	}
}

func ptrTime(t time.Time) *time.Time { return &t }

func TestScheduler_AutoDeliverRespectsSetting(t *testing.T) {
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)
	setting := &domain.Setting{ReadyAutoDeliverMinutes: 10}

	old := cashOrder(0, now)
	old.Items = []domain.OrderItem{{ID: uuid.New(), Status: domain.OrderItemStatusReady}}
	young := cashOrder(0, now)
	young.Items = []domain.OrderItem{{ID: uuid.New(), Status: domain.OrderItemStatusReady}}

	f := newSchedulerFixture(setting, old, young)

	moves, _ := f.repo.ListItemMoves(context.Background(), domain.ItemMoveQuery{From: domain.OrderItemStatusReady})
	if len(moves) != 2 {
		t.Fatalf("expected 2 ready items, got %d", len(moves))
	}

	if err := f.uc.applyItemMoves(context.Background(), []domain.ItemMove{moves[0]}, domain.OrderItemStatusDelivered, "auto_deliver"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.tx.updatedItemTo != domain.OrderItemStatusDelivered {
		t.Errorf("expected DELIVERED, got %s", f.tx.updatedItemTo)
	}
	if len(f.tx.auditActions) != 1 || f.tx.auditActions[0] != "auto_deliver" {
		t.Errorf("expected auto_deliver audit, got %v", f.tx.auditActions)
	}
}

func TestScheduler_AutoCompleteMovesDelivered(t *testing.T) {
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)
	setting := &domain.Setting{DeliveredAutoCompleteMinutes: 5}

	delivered := cashOrder(0, now)
	delivered.Status = domain.OrderStatusProcessing
	delivered.PaymentStatus = domain.PaymentStatusPaid
	delivered.Items = []domain.OrderItem{{ID: uuid.New(), Status: domain.OrderItemStatusDelivered, DeliveredAt: ptrTime(now.Add(-6 * time.Minute))}}
	done := cashOrder(0, now)
	done.PaymentStatus = domain.PaymentStatusPaid
	done.Items = []domain.OrderItem{{ID: uuid.New(), Status: domain.OrderItemStatusCompleted}}

	f := newSchedulerFixture(setting, delivered, done)
	f.repo.byID[delivered.ID].Items[0].Status = domain.OrderItemStatusDelivered

	if err := f.uc.autoComplete(context.Background(), setting); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.tx.updatedItemTo != domain.OrderItemStatusCompleted {
		t.Errorf("expected COMPLETED, got %s", f.tx.updatedItemTo)
	}
	if f.tx.updatedStatus != domain.OrderStatusCompleted {
		t.Errorf("expected aggregate SELESAI, got %s", f.tx.updatedStatus)
	}
}

func TestScheduler_CloseIdleSessions(t *testing.T) {
	setting := &domain.Setting{}
	f := newSchedulerFixture(setting)

	idle := &domain.TableSession{ID: uuid.New(), TableID: uuid.New(), SessionToken: "idle", Status: domain.TableSessionStatusOpen}
	f.sessions.sessions["idle"] = idle

	if err := f.uc.closeSessions(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.tx.auditActions[0] != "session_closed" {
		t.Errorf("expected session_closed audit, got %v", f.tx.auditActions)
	}
	if idle.Status != domain.TableSessionStatusClosed {
		t.Errorf("expected session CLOSED, got %s", idle.Status)
	}
}

func TestScheduler_FailureIsolation(t *testing.T) {
	f := newSchedulerFixture(&domain.Setting{})
	uc := NewSchedulerUsecase(f.repo, newTestTxRunner(f.tx), f.sessions, failingSettingRepo{}, nil, func() time.Time { return f.now }, nil)

	if err := uc.Tick(context.Background()); err == nil {
		t.Fatal("expected the settings failure to surface")
	}
}
