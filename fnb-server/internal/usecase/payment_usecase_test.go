package usecase

import (
	"context"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"net/http"
	"testing"
	"time"

	"fnb-server/internal/domain"
	"github.com/google/uuid"
)

func newPaymentTestOrder(total int64) (*domain.Order, *mockOrderQueryRepo) {
	order := &domain.Order{
		ID:            uuid.New(),
		OrderNumber:   "DI-20261121-001",
		PaymentStatus: domain.PaymentStatusUnpaid,
		Status:        domain.OrderStatusWaiting,
		TotalAmount:   total,
		Items: []domain.OrderItem{
			{ID: uuid.New(), Status: domain.OrderItemStatusPending, Price: total},
		},
	}
	repo := &mockOrderQueryRepo{
		orders: []domain.Order{*order},
		byID:   map[uuid.UUID]*domain.Order{order.ID: order},
	}
	return order, repo
}

func TestConfirmPayment_CashOnceThenIdempotent(t *testing.T) {
	order, repo := newPaymentTestOrder(57750)
	tx := &mockTx{}
	u := NewOrderUsecase(repo, nil, nil, newTestTxRunner(tx), nil, nil, nil, nil)

	received := int64(100000)
	res, err := u.ConfirmPayment(context.Background(), order.ID,
		ConfirmPaymentInput{Method: domain.PaymentMethodCash, AmountReceived: &received},
		uuid.New(), domain.UserRoleCashier)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.PaymentStatus != domain.PaymentStatusPaid {
		t.Errorf("expected LUNAS, got %s", res.PaymentStatus)
	}
	if res.PaidAt == nil {
		t.Error("expected paid_at set")
	}
	if len(tx.paymentLogs) != 1 {
		t.Fatalf("expected exactly one payment_log, got %d", len(tx.paymentLogs))
	}
	if tx.paymentLogs[0].Status != domain.PaymentLogStatusSettled {
		t.Errorf("expected SETTLED log, got %s", tx.paymentLogs[0].Status)
	}
	if tx.paymentLogs[0].Gateway != nil {
		t.Error("cash log must have no gateway")
	}
	if tx.updatedStatus != domain.OrderStatusProcessing {
		t.Errorf("expected aggregate DIPROSES, got %s", tx.updatedStatus)
	}

	paidAt := *res.PaidAt
	res2, err := u.ConfirmPayment(context.Background(), order.ID,
		ConfirmPaymentInput{Method: domain.PaymentMethodCash, AmountReceived: &received},
		uuid.New(), domain.UserRoleCashier)
	if err != nil {
		t.Fatalf("unexpected error on replay: %v", err)
	}
	if len(tx.paymentLogs) != 1 {
		t.Errorf("replay must not add a payment_log, got %d", len(tx.paymentLogs))
	}
	if res2.PaidAt == nil || !res2.PaidAt.Equal(paidAt) {
		t.Errorf("paid_at changed on replay: %v vs %v", res2.PaidAt, paidAt)
	}
}

func TestConfirmPayment_CashMath(t *testing.T) {
	order, repo := newPaymentTestOrder(57750)
	u := NewOrderUsecase(repo, nil, nil, newTestTxRunner(&mockTx{}), nil, nil, nil, nil)

	short := int64(50000)
	_, err := u.ConfirmPayment(context.Background(), order.ID,
		ConfirmPaymentInput{Method: domain.PaymentMethodCash, AmountReceived: &short},
		uuid.New(), domain.UserRoleCashier)
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeValidationError {
		t.Fatalf("expected VALIDATION_ERROR for underpayment, got %v", err)
	}

	received := int64(100000)
	wrongChange := int64(1)
	_, err = u.ConfirmPayment(context.Background(), order.ID,
		ConfirmPaymentInput{Method: domain.PaymentMethodCash, AmountReceived: &received, ChangeAmount: &wrongChange},
		uuid.New(), domain.UserRoleCashier)
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeValidationError {
		t.Fatalf("expected VALIDATION_ERROR for change mismatch, got %v", err)
	}

	goodChange := int64(42250)
	_, err = u.ConfirmPayment(context.Background(), order.ID,
		ConfirmPaymentInput{Method: domain.PaymentMethodCash, AmountReceived: &received, ChangeAmount: &goodChange},
		uuid.New(), domain.UserRoleCashier)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if order.AmountReceived == nil || *order.AmountReceived != 100000 {
		t.Errorf("expected amount_received stored, got %v", order.AmountReceived)
	}
	if order.ChangeAmount == nil || *order.ChangeAmount != 42250 {
		t.Errorf("expected change_amount 42250, got %v", order.ChangeAmount)
	}
}

func TestConfirmPayment_NonCashManualHasNoRef(t *testing.T) {
	order, repo := newPaymentTestOrder(57750)
	tx := &mockTx{}
	u := NewOrderUsecase(repo, nil, nil, newTestTxRunner(tx), nil, nil, nil, nil)

	received := int64(100000)
	res, err := u.ConfirmPayment(context.Background(), order.ID,
		ConfirmPaymentInput{Method: domain.PaymentMethodNonCash, AmountReceived: &received},
		uuid.New(), domain.UserRoleCashier)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.PaymentRef != nil {
		t.Errorf("manual NON_CASH must have no payment_ref, got %v", *res.PaymentRef)
	}
	if res.AmountReceived != nil || res.ChangeAmount != nil {
		t.Error("NON_CASH must ignore cash figures")
	}

	order2, repo2 := newPaymentTestOrder(10000)
	pending := &domain.PaymentLog{
		ID:      uuid.New(),
		OrderID: order2.ID,
		Method:  domain.PaymentMethodNonCash,
		Amount:  10000,
		Status:  domain.PaymentLogStatusPending,
	}
	tx2 := &mockTx{paymentLogs: []domain.PaymentLog{*pending}}
	u2 := NewOrderUsecase(repo2, nil, nil, newTestTxRunner(tx2), nil, nil, nil, nil)

	_, err = u2.ConfirmPayment(context.Background(), order2.ID,
		ConfirmPaymentInput{Method: domain.PaymentMethodNonCash},
		uuid.New(), domain.UserRoleCashier)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(tx2.paymentLogs) != 1 || tx2.paymentLogs[0].Status != domain.PaymentLogStatusSettled {
		t.Fatalf("expected pending log settled in place, got %+v", tx2.paymentLogs)
	}
}

func TestConfirmPayment_PaidOrderCancelRejected(t *testing.T) {
	order, repo := newPaymentTestOrder(10000)
	received := int64(20000)
	u := NewOrderUsecase(repo, nil, nil, newTestTxRunner(&mockTx{}), nil, nil, nil, nil)
	if _, err := u.ConfirmPayment(context.Background(), order.ID,
		ConfirmPaymentInput{Method: domain.PaymentMethodCash, AmountReceived: &received},
		uuid.New(), domain.UserRoleCashier); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	_, err := u.CancelOrder(context.Background(), order.ID, "too late", nil, nil)
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeInvalidTransition {
		t.Fatalf("expected INVALID_TRANSITION, got %v", err)
	}

	now := time.Now().UTC()
	order.CanceledAt = &now
	order.PaymentStatus = domain.PaymentStatusUnpaid
	_, err = u.ConfirmPayment(context.Background(), order.ID,
		ConfirmPaymentInput{Method: domain.PaymentMethodCash, AmountReceived: &received},
		uuid.New(), domain.UserRoleCashier)
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeInvalidTransition {
		t.Fatalf("expected INVALID_TRANSITION for cancelled order, got %v", err)
	}
}

func signMidtrans(orderID, statusCode, gross, key string) string {
	sum := sha512.Sum512([]byte(orderID + statusCode + gross + key))
	return hex.EncodeToString(sum[:])
}

func newPaymentUsecase(repo *mockOrderQueryRepo, tx *mockTx, key string) *PaymentUsecase {
	return NewPaymentUsecase(repo, newTestTxRunner(tx), key, nil, nil)
}

func TestMidtransCallback_SignatureMismatchWritesNothing(t *testing.T) {
	order, repo := newPaymentTestOrder(57750)
	tx := &mockTx{}
	u := newPaymentUsecase(repo, tx, "server-key")

	err := u.HandleMidtransCallback(context.Background(), CallbackInput{
		OrderID:           order.OrderNumber,
		StatusCode:        "200",
		GrossAmount:       "57750.00",
		SignatureKey:      "deadbeef",
		TransactionStatus: "settlement",
		TransactionID:     "trx-1",
	})
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.CodeUnauthorized {
		t.Fatalf("expected UNAUTHORIZED, got %v", err)
	}
	if tx.paymentLogUpdates != 0 || len(tx.paymentLogs) != 0 || tx.paidMethod != "" {
		t.Errorf("signature failure must write nothing, got %+v", tx)
	}
}

func TestMidtransCallback_SettlementThenReplay(t *testing.T) {
	order, repo := newPaymentTestOrder(57750)
	pending := domain.PaymentLog{
		ID:      uuid.New(),
		OrderID: order.ID,
		Method:  domain.PaymentMethodNonCash,
		Amount:  57750,
		Status:  domain.PaymentLogStatusPending,
	}
	tx := &mockTx{paymentLogs: []domain.PaymentLog{pending}}
	u := newPaymentUsecase(repo, tx, "server-key")

	in := CallbackInput{
		OrderID:           order.OrderNumber,
		StatusCode:        "200",
		GrossAmount:       "57750.00",
		SignatureKey:      signMidtrans(order.OrderNumber, "200", "57750.00", "server-key"),
		TransactionStatus: "settlement",
		TransactionID:     "trx-1",
	}
	if err := u.HandleMidtransCallback(context.Background(), in); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(tx.paymentLogs) != 1 || tx.paymentLogs[0].Status != domain.PaymentLogStatusSettled {
		t.Fatalf("expected pending log SETTLED, got %+v", tx.paymentLogs)
	}
	if tx.paymentLogs[0].GatewayRef == nil || *tx.paymentLogs[0].GatewayRef != "trx-1" {
		t.Fatalf("expected gateway_ref set, got %v", tx.paymentLogs[0].GatewayRef)
	}
	if tx.paidMethod != domain.PaymentMethodNonCash {
		t.Errorf("expected order marked NON_CASH paid, got %s", tx.paidMethod)
	}
	if tx.updatedStatus != domain.OrderStatusProcessing {
		t.Errorf("expected DIPROSES, got %s", tx.updatedStatus)
	}
	paidAt := *order.PaidAt

	updatesAfterFirst := tx.paymentLogUpdates
	if err := u.HandleMidtransCallback(context.Background(), in); err != nil {
		t.Fatalf("unexpected error on replay: %v", err)
	}
	if tx.paymentLogUpdates != updatesAfterFirst {
		t.Errorf("replay must not update payment_log, got %d", tx.paymentLogUpdates)
	}
	if len(tx.paymentLogs) != 1 {
		t.Errorf("replay must not add a log, got %d", len(tx.paymentLogs))
	}
	if order.PaidAt == nil || !order.PaidAt.Equal(paidAt) {
		t.Errorf("paid_at changed on replay: %v vs %v", order.PaidAt, paidAt)
	}
}

func TestMidtransCallback_ExpireCancelsOnce(t *testing.T) {
	order, repo := newPaymentTestOrder(57750)
	pending := domain.PaymentLog{
		ID:      uuid.New(),
		OrderID: order.ID,
		Method:  domain.PaymentMethodNonCash,
		Amount:  57750,
		Status:  domain.PaymentLogStatusPending,
	}
	tx := &mockTx{paymentLogs: []domain.PaymentLog{pending}}
	u := newPaymentUsecase(repo, tx, "server-key")

	in := CallbackInput{
		OrderID:           order.OrderNumber,
		StatusCode:        "407",
		GrossAmount:       "57750.00",
		SignatureKey:      signMidtrans(order.OrderNumber, "407", "57750.00", "server-key"),
		TransactionStatus: "expire",
		TransactionID:     "trx-1",
	}
	if err := u.HandleMidtransCallback(context.Background(), in); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tx.paymentLogs[0].Status != domain.PaymentLogStatusExpired {
		t.Errorf("expected EXPIRED log, got %s", tx.paymentLogs[0].Status)
	}
	if tx.cancelledOrder != order.ID || tx.cancelReason != "midtrans expire" {
		t.Errorf("expected order cancel, got %v %q", tx.cancelledOrder, tx.cancelReason)
	}
	if tx.restoreCount != 1 {
		t.Errorf("expected one stock restore, got %d", tx.restoreCount)
	}

	if err := u.HandleMidtransCallback(context.Background(), in); err != nil {
		t.Fatalf("unexpected error on replay: %v", err)
	}
	if tx.restoreCount != 1 {
		t.Errorf("replay must not restore stock again, got %d", tx.restoreCount)
	}
}

func TestMidtransCallback_UnknownStatusNoWrites(t *testing.T) {
	order, repo := newPaymentTestOrder(57750)
	tx := &mockTx{}
	u := newPaymentUsecase(repo, tx, "server-key")

	in := CallbackInput{
		OrderID:           order.OrderNumber,
		StatusCode:        "201",
		GrossAmount:       "57750.00",
		SignatureKey:      signMidtrans(order.OrderNumber, "201", "57750.00", "server-key"),
		TransactionStatus: "pending",
		TransactionID:     "trx-1",
	}
	if err := u.HandleMidtransCallback(context.Background(), in); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(tx.paymentLogs) != 0 || tx.paymentLogUpdates != 0 || tx.restoreCount != 0 {
		t.Errorf("unknown status must not write, got %+v", tx)
	}
}

func TestMidtransCallback_NotFound(t *testing.T) {
	_, repo := newPaymentTestOrder(1000)
	u := newPaymentUsecase(repo, &mockTx{}, "server-key")

	in := CallbackInput{
		OrderID:           "DI-20260101-999",
		StatusCode:        "200",
		GrossAmount:       "1000.00",
		SignatureKey:      signMidtrans("DI-20260101-999", "200", "1000.00", "server-key"),
		TransactionStatus: "settlement",
	}
	err := u.HandleMidtransCallback(context.Background(), in)
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.HTTPStatus != http.StatusNotFound {
		t.Fatalf("expected 404, got %v", err)
	}
}

func TestBuildSnapRequest_SumMatchesTotal(t *testing.T) {
	cases := []struct {
		subtotal int64
		service  float64
		tax      float64
	}{
		{50000, 5, 10},
		{33333, 5, 10},
		{1, 5, 10},
		{99999, 7.5, 11},
	}
	for _, c := range cases {
		totals := domain.CalcTotals(c.subtotal, c.service, c.tax)
		order := &domain.Order{
			ID:             uuid.New(),
			OrderNumber:    "DI-20261121-001",
			TotalAmount:    totals.Total,
			SubtotalAmount: totals.Subtotal,
			ServiceAmount:  totals.Service,
			TaxAmount:      totals.Tax,
		}
		items := []domain.OrderItem{{
			MenuID:           uuid.New(),
			MenuNameSnapshot: "Latte",
			Qty:              1,
			Price:            totals.Subtotal,
		}}

		req := domain.BuildSnapRequest(order, items)
		if req.GrossAmount != totals.Total {
			t.Errorf("gross_amount %d != total %d", req.GrossAmount, totals.Total)
		}
		var sum int64
		for _, it := range req.Items {
			sum += it.Price * int64(it.Quantity)
		}
		if sum != totals.Total {
			t.Errorf("item_details sum %d != gross %d for %+v", sum, totals.Total, c)
		}
		if req.OrderNumber != order.OrderNumber || req.OrderID != order.ID {
			t.Error("expected order number and id carried into Snap request")
		}
	}
}

func TestMidtransCallback_ExpireAfterSettlementIgnored(t *testing.T) {
	order, repo := newPaymentTestOrder(57750)
	tx := &mockTx{}
	u := newPaymentUsecase(repo, tx, "server-key")

	settle := CallbackInput{
		OrderID:           order.OrderNumber,
		StatusCode:        "200",
		GrossAmount:       "57750.00",
		SignatureKey:      signMidtrans(order.OrderNumber, "200", "57750.00", "server-key"),
		TransactionStatus: "settlement",
		TransactionID:     "trx-1",
	}
	if err := u.HandleMidtransCallback(context.Background(), settle); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expire := CallbackInput{
		OrderID:           order.OrderNumber,
		StatusCode:        "407",
		GrossAmount:       "57750.00",
		SignatureKey:      signMidtrans(order.OrderNumber, "407", "57750.00", "server-key"),
		TransactionStatus: "expire",
		TransactionID:     "trx-1",
	}
	if err := u.HandleMidtransCallback(context.Background(), expire); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tx.restoreCount != 0 || tx.cancelledOrder != uuid.Nil {
		t.Errorf("expire after settlement must not cancel or restore stock, got %+v", tx)
	}
	if tx.paymentLogs[0].Status != domain.PaymentLogStatusSettled {
		t.Errorf("settled log must stay SETTLED, got %s", tx.paymentLogs[0].Status)
	}
}

func TestMidtransCallback_GrossAmountMismatchIgnored(t *testing.T) {
	order, repo := newPaymentTestOrder(57750)
	tx := &mockTx{}
	u := newPaymentUsecase(repo, tx, "server-key")

	in := CallbackInput{
		OrderID:           order.OrderNumber,
		StatusCode:        "200",
		GrossAmount:       "1.00",
		SignatureKey:      signMidtrans(order.OrderNumber, "200", "1.00", "server-key"),
		TransactionStatus: "settlement",
		TransactionID:     "trx-1",
	}
	if err := u.HandleMidtransCallback(context.Background(), in); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(tx.paymentLogs) != 0 || tx.paidMethod != "" {
		t.Errorf("amount mismatch must not settle the order, got %+v", tx)
	}
}

func TestSameAmount(t *testing.T) {
	if !sameAmount("57750.00", 57750) {
		t.Error("expected 57750.00 == 57750")
	}
	if !sameAmount("57750", 57750) {
		t.Error("expected 57750 == 57750")
	}
	if sameAmount("57750.01", 57750) {
		t.Error("fractional amount must not match")
	}
	if sameAmount("57751.00", 57750) {
		t.Error("different whole amount must not match")
	}
}
