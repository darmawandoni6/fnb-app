package usecase

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

type mockOrderQueryRepo struct {
	orders []domain.Order
	byID   map[uuid.UUID]*domain.Order
}

func (m *mockOrderQueryRepo) List(ctx context.Context, filter domain.OrderFilter) ([]domain.Order, error) {
	var result []domain.Order
	for _, o := range m.orders {
		if filter.PaidOnly && o.PaymentStatus != domain.PaymentStatusPaid {
			continue
		}
		if filter.Status != nil && o.Status != *filter.Status {
			continue
		}
		if filter.TableID != nil && (o.TableID == nil || *o.TableID != *filter.TableID) {
			continue
		}
		result = append(result, o)
	}
	return result, nil
}

func (m *mockOrderQueryRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Order, error) {
	if o, ok := m.byID[id]; ok {
		return o, nil
	}
	return nil, nil
}

type mockMenuRepo struct {
	menus map[uuid.UUID]domain.Menu
}

func (m *mockMenuRepo) ListAvailableGroupedByCategory(ctx context.Context) ([]domain.MenuCategory, error) {
	return nil, nil
}

func (m *mockMenuRepo) ListAvailableByIDs(ctx context.Context, ids []uuid.UUID) ([]domain.Menu, error) {
	var res []domain.Menu
	for _, id := range ids {
		if menu, ok := m.menus[id]; ok {
			res = append(res, menu)
		}
	}
	return res, nil
}

type mockSettingRepo struct {
	setting *domain.Setting
}

func (m *mockSettingRepo) GetFirst(ctx context.Context) (*domain.Setting, error) {
	return m.setting, nil
}

type mockTx struct {
	createdOrder     *domain.Order
	createdItems     []domain.OrderItem
	persistedRefund  *domain.Refund
	updatedPayment   domain.PaymentStatus
	updatedMethod    *domain.PaymentMethod
	updatedStatus    domain.OrderStatus
	updatedItemOrder uuid.UUID
	updatedItemID    uuid.UUID
	updatedItemFrom  domain.OrderItemStatus
	updatedItemTo    domain.OrderItemStatus
}

func (t *mockTx) CreateOrder(ctx context.Context, o *domain.Order) error {
	t.createdOrder = o
	return nil
}
func (t *mockTx) CreateItems(ctx context.Context, items []domain.OrderItem) error {
	t.createdItems = items
	return nil
}
func (t *mockTx) ConsumeStock(ctx context.Context, items []domain.OrderItem) error {
	return nil
}
func (t *mockTx) PersistCancel(ctx context.Context, o *domain.Order, itemID uuid.UUID, r *domain.Refund) error {
	t.persistedRefund = r
	return nil
}
func (t *mockTx) SetPayment(ctx context.Context, id uuid.UUID, s domain.PaymentStatus, m *domain.PaymentMethod) error {
	t.updatedPayment = s
	t.updatedMethod = m
	return nil
}
func (t *mockTx) SetItemStatus(ctx context.Context, orderID, itemID uuid.UUID, from, to domain.OrderItemStatus) error {
	t.updatedItemOrder = orderID
	t.updatedItemID = itemID
	t.updatedItemFrom = from
	t.updatedItemTo = to
	return nil
}
func (t *mockTx) UpdateAggregate(ctx context.Context, id uuid.UUID, s domain.OrderStatus) error {
	t.updatedStatus = s
	return nil
}

func newTestTxRunner(tx *mockTx) TxRunner {
	return func(ctx context.Context, fn func(OrderTx) error) error {
		return fn(tx)
	}
}

func TestOrderUsecase_List_ForcesPaidOnlyForKitchen(t *testing.T) {
	unpaid := domain.Order{ID: uuid.New(), PaymentStatus: domain.PaymentStatusUnpaid}
	paid := domain.Order{ID: uuid.New(), PaymentStatus: domain.PaymentStatusPaid}

	repo := &mockOrderQueryRepo{
		orders: []domain.Order{unpaid, paid},
	}
	u := NewOrderUsecase(repo, nil, nil, nil)

	// Kitchen role
	res, err := u.List(context.Background(), domain.OrderFilter{}, domain.UserRoleKitchen)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res) != 1 || res[0].ID != paid.ID {
		t.Errorf("kitchen should only see paid orders, got %d orders", len(res))
	}

	// Owner role sees all
	res, err = u.List(context.Background(), domain.OrderFilter{}, domain.UserRoleOwner)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res) != 2 {
		t.Errorf("owner should see 2 orders, got %d", len(res))
	}
}

func TestOrderUsecase_Get_KitchenUnpaidReturnsNotFound(t *testing.T) {
	unpaidID := uuid.New()
	paidID := uuid.New()
	repo := &mockOrderQueryRepo{
		byID: map[uuid.UUID]*domain.Order{
			unpaidID: {ID: unpaidID, PaymentStatus: domain.PaymentStatusUnpaid},
			paidID:   {ID: paidID, PaymentStatus: domain.PaymentStatusPaid},
		},
	}
	u := NewOrderUsecase(repo, nil, nil, nil)

	_, err := u.Get(context.Background(), unpaidID, domain.UserRoleKitchen)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeNotFound || appErr.HTTPStatus != http.StatusNotFound {
		t.Fatalf("expected 404 NOT_FOUND, got %v", err)
	}

	o, err := u.Get(context.Background(), paidID, domain.UserRoleKitchen)
	if err != nil || o.ID != paidID {
		t.Fatalf("expected paid order returned to kitchen, got %v, err: %v", o, err)
	}
}

func TestOrderUsecase_CreateManual_StoreClosed(t *testing.T) {
	settingRepo := &mockSettingRepo{setting: &domain.Setting{IsOpen: false}}
	u := NewOrderUsecase(nil, nil, settingRepo, nil)

	_, err := u.CreateManual(context.Background(), uuid.New(), []CreateOrderItem{{MenuID: uuid.New(), Qty: 1}})
	if err == nil {
		t.Fatal("expected STORE_CLOSED error, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeStoreClosed {
		t.Fatalf("expected STORE_CLOSED, got %v", err)
	}
}

func TestOrderUsecase_CreateManual_Success(t *testing.T) {
	menuID := uuid.New()
	menuRepo := &mockMenuRepo{
		menus: map[uuid.UUID]domain.Menu{
			menuID: {ID: menuID, Name: "Kopi", Price: 20000},
		},
	}
	settingRepo := &mockSettingRepo{setting: &domain.Setting{IsOpen: true, TaxPercent: 10}}
	tx := &mockTx{}
	u := NewOrderUsecase(nil, menuRepo, settingRepo, newTestTxRunner(tx))

	actorID := uuid.New()
	order, err := u.CreateManual(context.Background(), actorID, []CreateOrderItem{{MenuID: menuID, Qty: 2}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if order.OrderType != domain.OrderTypeManual {
		t.Errorf("expected MANUAL order type, got %s", order.OrderType)
	}
	if order.CreatedBy == nil || *order.CreatedBy != actorID {
		t.Errorf("expected created_by = %v, got %v", actorID, order.CreatedBy)
	}
	if order.TableID != nil {
		t.Errorf("expected nil table_id, got %v", order.TableID)
	}
	if order.TrackingTokenHash != nil {
		t.Errorf("expected nil tracking_token_hash, got %v", order.TrackingTokenHash)
	}
	if order.SubtotalAmount != 40000 || order.TaxAmount != 4000 || order.TotalAmount != 44000 {
		t.Errorf("incorrect totals: subtotal=%d, tax=%d, total=%d", order.SubtotalAmount, order.TaxAmount, order.TotalAmount)
	}
}

func TestOrderUsecase_UpdatePayment_ValidationAndInvalidTransition(t *testing.T) {
	orderID := uuid.New()
	methodCash := domain.PaymentMethodCash
	paidOrder := &domain.Order{ID: orderID, PaymentStatus: domain.PaymentStatusPaid}

	repo := &mockOrderQueryRepo{byID: map[uuid.UUID]*domain.Order{orderID: paidOrder}}
	u := NewOrderUsecase(repo, nil, nil, nil)

	// Non-LUNAS status rejected
	_, err := u.UpdatePayment(context.Background(), orderID, domain.PaymentStatusUnpaid, &methodCash)
	if err == nil {
		t.Fatal("expected error on non-LUNAS payment update")
	}

	// Missing method rejected
	_, err = u.UpdatePayment(context.Background(), orderID, domain.PaymentStatusPaid, nil)
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeValidationError {
		t.Fatalf("expected VALIDATION_ERROR on missing payment method, got %v", err)
	}

	// Order already paid rejected
	_, err = u.UpdatePayment(context.Background(), orderID, domain.PaymentStatusPaid, &methodCash)
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeInvalidTransition {
		t.Fatalf("expected INVALID_TRANSITION on already paid order, got %v", err)
	}
}

func TestOrderUsecase_UpdatePayment_RecomputesSelesaiWhenAllDelivered(t *testing.T) {
	orderID := uuid.New()
	order := &domain.Order{
		ID:            orderID,
		Status:        domain.OrderStatusDelivering,
		PaymentStatus: domain.PaymentStatusUnpaid,
		Items: []domain.OrderItem{
			{Status: domain.OrderItemStatusDelivered},
			{Status: domain.OrderItemStatusDelivered},
		},
	}
	repo := &mockOrderQueryRepo{byID: map[uuid.UUID]*domain.Order{orderID: order}}
	tx := &mockTx{}
	u := NewOrderUsecase(repo, nil, nil, newTestTxRunner(tx))

	method := domain.PaymentMethodCash
	res, err := u.UpdatePayment(context.Background(), orderID, domain.PaymentStatusPaid, &method)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Status != domain.OrderStatusCompleted {
		t.Errorf("expected order status SELESAI, got %s", res.Status)
	}
	if tx.updatedStatus != domain.OrderStatusCompleted {
		t.Errorf("expected aggregate updated in tx to SELESAI, got %s", tx.updatedStatus)
	}
}

func TestOrderUsecase_UpdateItemStatus_RoleAndTransitions(t *testing.T) {
	orderID := uuid.New()
	itemID := uuid.New()
	order := &domain.Order{
		ID:            orderID,
		PaymentStatus: domain.PaymentStatusUnpaid,
		Items: []domain.OrderItem{
			{ID: itemID, Status: domain.OrderItemStatusPending},
		},
	}
	repo := &mockOrderQueryRepo{byID: map[uuid.UUID]*domain.Order{orderID: order}}
	tx := &mockTx{}
	u := NewOrderUsecase(repo, nil, nil, newTestTxRunner(tx))

	// Kitchen user cannot set DELIVERED
	_, err := u.UpdateItemStatus(context.Background(), orderID, itemID, domain.OrderItemStatusDelivered, domain.UserRoleKitchen)
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeForbidden {
		t.Fatalf("expected FORBIDDEN, got %v", err)
	}

	// Transition to COOKING on unpaid order rejected with PAYMENT_REQUIRED
	_, err = u.UpdateItemStatus(context.Background(), orderID, itemID, domain.OrderItemStatusCooking, domain.UserRoleKitchen)
	if !errors.As(err, &appErr) || appErr.Code != domain.CodePaymentRequired {
		t.Fatalf("expected PAYMENT_REQUIRED, got %v", err)
	}

	// Backward transition rejected
	order.PaymentStatus = domain.PaymentStatusPaid
	order.Items[0].Status = domain.OrderItemStatusReady
	_, err = u.UpdateItemStatus(context.Background(), orderID, itemID, domain.OrderItemStatusCooking, domain.UserRoleKitchen)
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeInvalidTransition {
		t.Fatalf("expected INVALID_TRANSITION on backward transition, got %v", err)
	}
}

func TestOrderUsecase_CancelItem_RefundAndTotals(t *testing.T) {
	orderID := uuid.New()
	item1ID := uuid.New()
	item2ID := uuid.New()
	actorID := uuid.New()
	method := domain.PaymentMethodCash

	// Paid order with 2 items
	order := &domain.Order{
		ID:             orderID,
		PaymentStatus:  domain.PaymentStatusPaid,
		PaymentMethod:  &method,
		Status:         domain.OrderStatusWaiting,
		TaxPercent:     10,
		SubtotalAmount: 50000,
		TaxAmount:      5000,
		TotalAmount:    55000,
		Items: []domain.OrderItem{
			{ID: item1ID, Price: 25000, Qty: 1, Status: domain.OrderItemStatusPending},
			{ID: item2ID, Price: 25000, Qty: 1, Status: domain.OrderItemStatusPending},
		},
	}
	repo := &mockOrderQueryRepo{byID: map[uuid.UUID]*domain.Order{orderID: order}}
	tx := &mockTx{}
	u := NewOrderUsecase(repo, nil, nil, newTestTxRunner(tx))

	// Cancel item 1
	updated, err := u.CancelItem(context.Background(), orderID, item1ID, actorID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if tx.persistedRefund == nil {
		t.Fatal("expected refund persisted, got nil")
	}
	if tx.persistedRefund.ActorID == nil || *tx.persistedRefund.ActorID != actorID {
		t.Errorf("expected refund actor_id = %v, got %v", actorID, tx.persistedRefund.ActorID)
	}
	if tx.persistedRefund.Reason != "staff cancelled item" {
		t.Errorf("expected reason 'staff cancelled item', got %s", tx.persistedRefund.Reason)
	}
	if updated.SubtotalAmount != 25000 || updated.TaxAmount != 2500 || updated.TotalAmount != 27500 {
		t.Errorf("expected decreased totals, got subtotal=%d, tax=%d, total=%d", updated.SubtotalAmount, updated.TaxAmount, updated.TotalAmount)
	}

	// Cancel last active item -> totals 0 and DIBATALKAN
	updated, err = u.CancelItem(context.Background(), orderID, item2ID, actorID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Status != domain.OrderStatusCancelled {
		t.Errorf("expected DIBATALKAN status, got %s", updated.Status)
	}
	if updated.SubtotalAmount != 0 || updated.TaxAmount != 0 || updated.TotalAmount != 0 {
		t.Errorf("expected 0 totals, got sub=%d, tax=%d, total=%d", updated.SubtotalAmount, updated.TaxAmount, updated.TotalAmount)
	}
}

func TestOrderUsecase_CancelItem_UnpaidDoesNotRefund(t *testing.T) {
	orderID := uuid.New()
	itemID := uuid.New()
	order := &domain.Order{
		ID:             orderID,
		PaymentStatus:  domain.PaymentStatusUnpaid,
		Status:         domain.OrderStatusWaiting,
		SubtotalAmount: 50000,
		TaxAmount:      5000,
		TotalAmount:    55000,
		Items: []domain.OrderItem{
			{ID: itemID, Price: 25000, Qty: 1, Status: domain.OrderItemStatusPending},
			{ID: uuid.New(), Price: 25000, Qty: 1, Status: domain.OrderItemStatusPending},
		},
	}
	repo := &mockOrderQueryRepo{byID: map[uuid.UUID]*domain.Order{orderID: order}}
	tx := &mockTx{}
	u := NewOrderUsecase(repo, nil, nil, newTestTxRunner(tx))

	updated, err := u.CancelItem(context.Background(), orderID, itemID, uuid.New())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tx.persistedRefund != nil {
		t.Errorf("expected nil refund on unpaid order cancel, got %+v", tx.persistedRefund)
	}
	if updated.SubtotalAmount != 50000 || updated.TotalAmount != 55000 {
		t.Errorf("expected totals unchanged on unpaid cancel, got subtotal=%d, total=%d", updated.SubtotalAmount, updated.TotalAmount)
	}
}
