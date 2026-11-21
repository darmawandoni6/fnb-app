package usecase

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

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
		if filter.SessionID != nil && (o.TableSessionID == nil || *o.TableSessionID != *filter.SessionID) {
			continue
		}
		if filter.OrderType != nil && o.OrderType != *filter.OrderType {
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

func (m *mockOrderQueryRepo) GetByOrderNumber(ctx context.Context, orderNumber string) (*domain.Order, error) {
	for _, o := range m.byID {
		if o.OrderNumber == orderNumber {
			return o, nil
		}
	}
	for i := range m.orders {
		if m.orders[i].OrderNumber == orderNumber {
			return &m.orders[i], nil
		}
	}
	return nil, nil
}

func (m *mockOrderQueryRepo) ListCashTimeoutIDs(ctx context.Context, q domain.CashTimeoutQuery) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	for _, o := range m.byID {
		if o.PaymentStatus != domain.PaymentStatusUnpaid || o.CanceledAt != nil {
			continue
		}
		if o.PaymentMethod == nil || *o.PaymentMethod != domain.PaymentMethodCash {
			continue
		}
		if o.CreatedAt.Before(q.Cutoff) {
			ids = append(ids, o.ID)
		}
	}
	return ids, nil
}

func (m *mockOrderQueryRepo) ListItemMoves(ctx context.Context, q domain.ItemMoveQuery) ([]domain.ItemMove, error) {
	var moves []domain.ItemMove
	for _, o := range m.byID {
		for _, it := range o.Items {
			if it.Status != q.From {
				continue
			}
			moves = append(moves, domain.ItemMove{OrderID: o.ID, ItemID: it.ID, From: it.Status})
		}
	}
	return moves, nil
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
	createdOrder         *domain.Order
	createdItems         []domain.OrderItem
	stockConsumed        bool
	stockRestored        bool
	cancelledOrder       uuid.UUID
	cancelReason         string
	updatedStatus        domain.OrderStatus
	updatedItemOrder     uuid.UUID
	updatedItemID        uuid.UUID
	updatedItemFrom      domain.OrderItemStatus
	updatedItemTo        domain.OrderItemStatus
	lastSeq              int
	failStock            bool
	paidMethod           domain.PaymentMethod
	paidRef              *string
	paidAt               time.Time
	paidAmountReceived   *int64
	paidChangeAmount     *int64
	paymentLogs          []domain.PaymentLog
	pendingLog           *domain.PaymentLog
	updatedLogStatus     domain.PaymentLogStatus
	updatedLogGatewayRef *string
	paymentLogUpdates    int
	restoreCount         int
	auditActions         []string
}

func (t *mockTx) NextOrderNumber(ctx context.Context, oType domain.OrderType, day time.Time) (string, error) {
	t.lastSeq++
	return domain.FormatOrderNumber(oType, day, t.lastSeq), nil
}

func (t *mockTx) CreateOrder(ctx context.Context, o *domain.Order) error {
	t.createdOrder = o
	return nil
}

func (t *mockTx) CreateItems(ctx context.Context, items []domain.OrderItem) error {
	t.createdItems = items
	return nil
}

func (t *mockTx) ConsumeStock(ctx context.Context, order *domain.Order, items []domain.OrderItem) error {
	if t.failStock {
		return domain.NewError(domain.CodeStockNotEnough, "insufficient stock", http.StatusConflict, nil)
	}
	t.stockConsumed = true
	return nil
}

func (t *mockTx) RestoreStock(ctx context.Context, order *domain.Order, items []domain.OrderItem) error {
	t.stockRestored = true
	t.restoreCount++
	return nil
}

func (t *mockTx) SetItemStatus(ctx context.Context, orderID, itemID uuid.UUID, from, to domain.OrderItemStatus, actor *uuid.UUID) error {
	t.updatedItemOrder = orderID
	t.updatedItemID = itemID
	t.updatedItemFrom = from
	t.updatedItemTo = to
	return nil
}

func (t *mockTx) CancelOrder(ctx context.Context, orderID uuid.UUID, reason string, actor *uuid.UUID) error {
	t.cancelledOrder = orderID
	t.cancelReason = reason
	return nil
}

func (t *mockTx) UpdateAggregate(ctx context.Context, id uuid.UUID, s domain.OrderStatus) error {
	t.updatedStatus = s
	return nil
}

func (t *mockTx) Audit(ctx context.Context, entry *domain.AuditLog) error {
	t.auditActions = append(t.auditActions, entry.Action)
	return nil
}

func (t *mockTx) SetPaid(ctx context.Context, orderID uuid.UUID, method domain.PaymentMethod, ref *string, paidAt time.Time, amountReceived, changeAmount *int64) error {
	t.paidMethod = method
	t.paidRef = ref
	t.paidAt = paidAt
	t.paidAmountReceived = amountReceived
	t.paidChangeAmount = changeAmount
	return nil
}
func (t *mockTx) CreatePaymentLog(ctx context.Context, log *domain.PaymentLog) error {
	if log.ID == uuid.Nil {
		log.ID = uuid.New()
	}
	t.paymentLogs = append(t.paymentLogs, *log)
	return nil
}
func (t *mockTx) GetPendingPaymentLog(ctx context.Context, orderID uuid.UUID) (*domain.PaymentLog, error) {
	if t.pendingLog != nil {
		return t.pendingLog, nil
	}
	for i := range t.paymentLogs {
		if t.paymentLogs[i].OrderID == orderID && t.paymentLogs[i].Status == domain.PaymentLogStatusPending {
			return &t.paymentLogs[i], nil
		}
	}
	return nil, nil
}
func (t *mockTx) GetPaymentLogByGatewayRef(ctx context.Context, ref string) (*domain.PaymentLog, error) {
	for i := range t.paymentLogs {
		if t.paymentLogs[i].GatewayRef != nil && *t.paymentLogs[i].GatewayRef == ref {
			return &t.paymentLogs[i], nil
		}
	}
	return nil, nil
}
func (t *mockTx) UpdatePaymentLogStatus(ctx context.Context, id uuid.UUID, status domain.PaymentLogStatus, gatewayStatus *string, gatewayRef *string) error {
	t.updatedLogStatus = status
	t.updatedLogGatewayRef = gatewayRef
	t.paymentLogUpdates++
	for i := range t.paymentLogs {
		if t.paymentLogs[i].ID != id {
			continue
		}
		t.paymentLogs[i].Status = status
		if gatewayStatus != nil {
			t.paymentLogs[i].GatewayStatus = gatewayStatus
		}
		if gatewayRef != nil {
			t.paymentLogs[i].GatewayRef = gatewayRef
		}
	}
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
	u := NewOrderUsecase(repo, nil, nil, nil, nil, nil, nil, nil)

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
	u := NewOrderUsecase(repo, nil, nil, nil, nil, nil, nil, nil)

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
	u := NewOrderUsecase(nil, nil, settingRepo, nil, nil, nil, nil, nil)

	in := OrderInput{
		CustomerName:  "Budi",
		PaymentMethod: domain.PaymentMethodCash,
		Items:         []CreateOrderItem{{MenuID: uuid.New(), Qty: 1}},
	}
	_, err := u.CreateManual(context.Background(), uuid.New(), in)
	if err == nil {
		t.Fatal("expected STORE_CLOSED error, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeStoreClosed {
		t.Fatalf("expected STORE_CLOSED, got %v", err)
	}
}

func TestOrderUsecase_CreateManual_ValidationRejects(t *testing.T) {
	settingRepo := &mockSettingRepo{setting: &domain.Setting{IsOpen: true}}
	u := NewOrderUsecase(nil, nil, settingRepo, nil, nil, nil, nil, nil)

	// Blank customer_name
	in := OrderInput{
		CustomerName:  "   ",
		PaymentMethod: domain.PaymentMethodCash,
		Items:         []CreateOrderItem{{MenuID: uuid.New(), Qty: 1}},
	}
	_, err := u.CreateManual(context.Background(), uuid.New(), in)
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeValidationError {
		t.Fatalf("expected VALIDATION_ERROR on blank customer_name, got %v", err)
	}

	// Empty items
	in = OrderInput{
		CustomerName:  "Budi",
		PaymentMethod: domain.PaymentMethodCash,
		Items:         []CreateOrderItem{},
	}
	_, err = u.CreateManual(context.Background(), uuid.New(), in)
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeValidationError {
		t.Fatalf("expected VALIDATION_ERROR on empty items, got %v", err)
	}

	// Qty <= 0
	in = OrderInput{
		CustomerName:  "Budi",
		PaymentMethod: domain.PaymentMethodCash,
		Items:         []CreateOrderItem{{MenuID: uuid.New(), Qty: 0}},
	}
	_, err = u.CreateManual(context.Background(), uuid.New(), in)
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeValidationError {
		t.Fatalf("expected VALIDATION_ERROR on qty=0, got %v", err)
	}
}

func TestOrderUsecase_CreateManual_UnavailableMenu(t *testing.T) {
	menuID := uuid.New()
	menuRepo := &mockMenuRepo{menus: map[uuid.UUID]domain.Menu{}}
	settingRepo := &mockSettingRepo{setting: &domain.Setting{IsOpen: true}}
	u := NewOrderUsecase(nil, menuRepo, settingRepo, nil, nil, nil, nil, nil)

	in := OrderInput{
		CustomerName:  "Budi",
		PaymentMethod: domain.PaymentMethodCash,
		Items:         []CreateOrderItem{{MenuID: menuID, Qty: 1}},
	}
	_, err := u.CreateManual(context.Background(), uuid.New(), in)
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeNotFound {
		t.Fatalf("expected NOT_FOUND on missing menu, got %v", err)
	}
}

func TestOrderUsecase_CreateManual_InsufficientStock(t *testing.T) {
	menuID := uuid.New()
	menuRepo := &mockMenuRepo{
		menus: map[uuid.UUID]domain.Menu{
			menuID: {ID: menuID, Name: "Latte", Price: 25000},
		},
	}
	settingRepo := &mockSettingRepo{setting: &domain.Setting{IsOpen: true}}
	tx := &mockTx{failStock: true}
	u := NewOrderUsecase(nil, menuRepo, settingRepo, newTestTxRunner(tx), nil, nil, nil, nil)

	in := OrderInput{
		CustomerName:  "Budi",
		PaymentMethod: domain.PaymentMethodCash,
		Items:         []CreateOrderItem{{MenuID: menuID, Qty: 5}},
	}
	_, err := u.CreateManual(context.Background(), uuid.New(), in)
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeStockNotEnough {
		t.Fatalf("expected STOCK_NOT_ENOUGH, got %v", err)
	}
}

func TestOrderUsecase_CreateManual_TotalsAndSnapshots(t *testing.T) {
	menuID := uuid.New()
	menuRepo := &mockMenuRepo{
		menus: map[uuid.UUID]domain.Menu{
			menuID: {ID: menuID, Name: "Latte", Price: 25000},
		},
	}
	setting := &domain.Setting{IsOpen: true, ServiceRate: 5, TaxRate: 10}
	settingRepo := &mockSettingRepo{setting: setting}
	tx := &mockTx{}
	u := NewOrderUsecase(nil, menuRepo, settingRepo, newTestTxRunner(tx), nil, nil, nil, nil)

	actorID := uuid.New()
	phone := "08123456789"
	in := OrderInput{
		CustomerName:  "Budi",
		CustomerPhone: &phone,
		PaymentMethod: domain.PaymentMethodCash,
		Items:         []CreateOrderItem{{MenuID: menuID, Qty: 2}},
	}

	order, err := u.CreateManual(context.Background(), actorID, in)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if order.OrderType != domain.OrderTypeTakeAway {
		t.Errorf("expected TAKE_AWAY, got %s", order.OrderType)
	}
	if order.CustomerName != "Budi" || order.CustomerPhone == nil || *order.CustomerPhone != phone {
		t.Errorf("expected customer name and phone set, got %s, %v", order.CustomerName, order.CustomerPhone)
	}
	if order.SubtotalAmount != 50000 || order.ServiceAmount != 2500 || order.TaxAmount != 5250 || order.TotalAmount != 57750 {
		t.Errorf("expected totals {50000, 2500, 5250, 57750}, got {%d, %d, %d, %d}",
			order.SubtotalAmount, order.ServiceAmount, order.TaxAmount, order.TotalAmount)
	}

	// Change setting rates, verify snapshot immutability (BR-12)
	setting.ServiceRate = 10
	setting.TaxRate = 20
	if order.ServiceRateSnapshot != 5 || order.TaxRateSnapshot != 10 {
		t.Errorf("order snapshot modified! ServiceRate=%v, TaxRate=%v", order.ServiceRateSnapshot, order.TaxRateSnapshot)
	}
}

func TestOrderUsecase_OrderNumberGeneration(t *testing.T) {
	day := time.Date(2026, 11, 21, 10, 0, 0, 0, time.UTC)
	num1 := domain.FormatOrderNumber(domain.OrderTypeDineIn, day, 1)
	if num1 != "DI-20261121-001" {
		t.Errorf("expected DI-20261121-001, got %s", num1)
	}
	num2 := domain.FormatOrderNumber(domain.OrderTypeTakeAway, day, 2)
	if num2 != "TA-20261121-002" {
		t.Errorf("expected TA-20261121-002, got %s", num2)
	}

	nextDay := day.Add(24 * time.Hour)
	numReset := domain.FormatOrderNumber(domain.OrderTypeDineIn, nextDay, 1)
	if numReset != "DI-20261122-001" {
		t.Errorf("expected DI-20261122-001, got %s", numReset)
	}
}

func TestOrderUsecase_UpdateItemStatus_Matrix(t *testing.T) {
	orderID := uuid.New()
	itemID := uuid.New()
	actorID := uuid.New()

	order := &domain.Order{
		ID:            orderID,
		OrderType:     domain.OrderTypeDineIn,
		PaymentStatus: domain.PaymentStatusUnpaid,
		Items: []domain.OrderItem{
			{ID: itemID, Status: domain.OrderItemStatusPending},
		},
	}
	repo := &mockOrderQueryRepo{byID: map[uuid.UUID]*domain.Order{orderID: order}}
	tx := &mockTx{}
	u := NewOrderUsecase(repo, nil, nil, newTestTxRunner(tx), nil, nil, nil, nil)

	// Kitchen on unpaid -> 404 NOT_FOUND (Decision 17)
	_, err := u.UpdateItemStatus(context.Background(), orderID, itemID, domain.OrderItemStatusCooking, actorID, domain.UserRoleKitchen)
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeNotFound {
		t.Fatalf("expected NOT_FOUND for kitchen on unpaid order, got %v", err)
	}

	// Owner COOKING on unpaid -> PAYMENT_REQUIRED (Decision 9)
	_, err = u.UpdateItemStatus(context.Background(), orderID, itemID, domain.OrderItemStatusCooking, actorID, domain.UserRoleOwner)
	if !errors.As(err, &appErr) || appErr.Code != domain.CodePaymentRequired {
		t.Fatalf("expected PAYMENT_REQUIRED for owner cooking unpaid, got %v", err)
	}

	// Mark paid
	order.PaymentStatus = domain.PaymentStatusPaid

	// CASHIER cannot COOKING on DINE_IN -> FORBIDDEN
	_, err = u.UpdateItemStatus(context.Background(), orderID, itemID, domain.OrderItemStatusCooking, actorID, domain.UserRoleCashier)
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeForbidden {
		t.Fatalf("expected FORBIDDEN for cashier cooking dine_in, got %v", err)
	}

	// KITCHEN can COOKING
	res, err := u.UpdateItemStatus(context.Background(), orderID, itemID, domain.OrderItemStatusCooking, actorID, domain.UserRoleKitchen)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Items[0].Status != domain.OrderItemStatusCooking {
		t.Errorf("expected item status COOKING, got %s", res.Items[0].Status)
	}

	// Idempotent no-op: target == current -> 200
	res2, err := u.UpdateItemStatus(context.Background(), orderID, itemID, domain.OrderItemStatusCooking, actorID, domain.UserRoleKitchen)
	if err != nil {
		t.Fatalf("expected no-op 200, got %v", err)
	}
	if res2 == nil {
		t.Fatal("expected order returned")
	}

	// KITCHEN can READY
	_, err = u.UpdateItemStatus(context.Background(), orderID, itemID, domain.OrderItemStatusReady, actorID, domain.UserRoleKitchen)
	if err != nil {
		t.Fatalf("unexpected error on ready: %v", err)
	}

	// CASHIER cannot DELIVER on DINE_IN -> FORBIDDEN
	_, err = u.UpdateItemStatus(context.Background(), orderID, itemID, domain.OrderItemStatusDelivered, actorID, domain.UserRoleCashier)
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeForbidden {
		t.Fatalf("expected FORBIDDEN for cashier delivering dine_in, got %v", err)
	}

	// OWNER can DELIVER
	_, err = u.UpdateItemStatus(context.Background(), orderID, itemID, domain.OrderItemStatusDelivered, actorID, domain.UserRoleOwner)
	if err != nil {
		t.Fatalf("unexpected error on deliver: %v", err)
	}

	// OWNER can COMPLETED -> order becomes SELESAI
	res, err = u.UpdateItemStatus(context.Background(), orderID, itemID, domain.OrderItemStatusCompleted, actorID, domain.UserRoleOwner)
	if err != nil {
		t.Fatalf("unexpected error on complete: %v", err)
	}
	if res.Status != domain.OrderStatusCompleted {
		t.Errorf("expected order aggregate status SELESAI, got %s", res.Status)
	}
}

func TestOrderUsecase_CancelOrder_UnpaidRestoresStock(t *testing.T) {
	orderID := uuid.New()
	actorID := uuid.New()
	role := domain.UserRoleOwner
	order := &domain.Order{
		ID:            orderID,
		OrderNumber:   "DI-20261121-001",
		PaymentStatus: domain.PaymentStatusUnpaid,
		Status:        domain.OrderStatusWaiting,
		Items: []domain.OrderItem{
			{ID: uuid.New(), Status: domain.OrderItemStatusPending},
		},
	}
	repo := &mockOrderQueryRepo{byID: map[uuid.UUID]*domain.Order{orderID: order}}
	tx := &mockTx{}
	u := NewOrderUsecase(repo, nil, nil, newTestTxRunner(tx), nil, nil, nil, nil)

	cancelled, err := u.CancelOrder(context.Background(), orderID, "Customer left", &actorID, &role)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !tx.stockRestored {
		t.Error("expected stock restored on cancel")
	}
	if tx.cancelledOrder != orderID || tx.cancelReason != "Customer left" {
		t.Errorf("expected CancelOrder called with reason, got %v, %s", tx.cancelledOrder, tx.cancelReason)
	}
	if cancelled.Status != domain.OrderStatusCancelled {
		t.Errorf("expected status DIBATALKAN, got %s", cancelled.Status)
	}
	if cancelled.CancelReason == nil || *cancelled.CancelReason != "Customer left" {
		t.Errorf("expected cancel reason set, got %v", cancelled.CancelReason)
	}

	// Cancel again -> 409 INVALID_TRANSITION
	_, err = u.CancelOrder(context.Background(), orderID, "again", &actorID, &role)
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeInvalidTransition {
		t.Fatalf("expected INVALID_TRANSITION on cancelling already cancelled order, got %v", err)
	}
}

func TestOrderUsecase_CancelOrder_PaidOrderRejected(t *testing.T) {
	orderID := uuid.New()
	order := &domain.Order{
		ID:            orderID,
		PaymentStatus: domain.PaymentStatusPaid,
		Status:        domain.OrderStatusProcessing,
	}
	repo := &mockOrderQueryRepo{byID: map[uuid.UUID]*domain.Order{orderID: order}}
	u := NewOrderUsecase(repo, nil, nil, nil, nil, nil, nil, nil)

	_, err := u.CancelOrder(context.Background(), orderID, "paid cancel", nil, nil)
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeInvalidTransition {
		t.Fatalf("expected INVALID_TRANSITION when cancelling paid order, got %v", err)
	}
}

func TestPublicUsecase_OrdersIsolation(t *testing.T) {
	sessionA := &domain.TableSession{
		ID:           uuid.New(),
		TableID:      uuid.New(),
		SessionToken: "token-a",
		Status:       domain.TableSessionStatusOpen,
	}
	sessionB := &domain.TableSession{
		ID:           uuid.New(),
		TableID:      uuid.New(),
		SessionToken: "token-b",
		Status:       domain.TableSessionStatusOpen,
	}

	orderA := domain.Order{
		ID:             uuid.New(),
		TableSessionID: &sessionA.ID,
		Status:         domain.OrderStatusWaiting,
		PaymentStatus:  domain.PaymentStatusUnpaid,
	}
	orderB := domain.Order{
		ID:             uuid.New(),
		TableSessionID: &sessionB.ID,
		Status:         domain.OrderStatusWaiting,
		PaymentStatus:  domain.PaymentStatusUnpaid,
	}

	repo := &mockOrderQueryRepo{
		orders: []domain.Order{orderA, orderB},
		byID: map[uuid.UUID]*domain.Order{
			orderA.ID: &orderA,
			orderB.ID: &orderB,
		},
	}
	pu := NewPublicUsecase(nil, nil, nil, repo, nil, nil, nil, nil, nil)

	// List orders for Session A -> only orderA
	orders, err := pu.ListOrders(context.Background(), sessionA)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(orders) != 1 || orders[0].ID != orderA.ID {
		t.Errorf("expected only session A's order, got %d orders", len(orders))
	}

	// Session A reads Session B order -> 404 NOT_FOUND
	_, err = pu.GetOrder(context.Background(), sessionA, orderB.ID)
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeNotFound {
		t.Fatalf("expected 404 NOT_FOUND when accessing order from another session, got %v", err)
	}

	// Session A cancels Session B order -> 404 NOT_FOUND
	_, err = pu.CancelOrder(context.Background(), sessionA, orderB.ID, "cancel B")
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeNotFound {
		t.Fatalf("expected 404 NOT_FOUND when cancelling order from another session, got %v", err)
	}
}
