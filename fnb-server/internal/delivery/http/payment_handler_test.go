package http

import (
	"context"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type callbackOrderRepo struct{ orders []domain.Order }

func (r *callbackOrderRepo) List(ctx context.Context, f domain.OrderFilter) ([]domain.Order, error) {
	return r.orders, nil
}
func (r *callbackOrderRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Order, error) {
	return nil, nil
}
func (r *callbackOrderRepo) GetByOrderNumber(ctx context.Context, n string) (*domain.Order, error) {
	for i := range r.orders {
		if r.orders[i].OrderNumber == n {
			return &r.orders[i], nil
		}
	}
	return nil, nil
}

func sign(orderID, statusCode, gross, key string) string {
	sum := sha512.Sum512([]byte(orderID + statusCode + gross + key))
	return hex.EncodeToString(sum[:])
}

func newCallbackApp(t *testing.T) (*echo.Echo, *domain.Order) {
	t.Helper()
	order := &domain.Order{
		ID:            uuid.New(),
		OrderNumber:   "DI-20261121-007",
		PaymentStatus: domain.PaymentStatusUnpaid,
		Status:        domain.OrderStatusWaiting,
		TotalAmount:   10000,
		Items:         []domain.OrderItem{{ID: uuid.New(), Status: domain.OrderItemStatusPending}},
	}
	repo := &callbackOrderRepo{orders: []domain.Order{*order}}
	noopTx := usecase.TxRunner(func(ctx context.Context, fn func(usecase.OrderTx) error) error {
		return fn(noopOrderTx{})
	})
	paymentUsecase := usecase.NewPaymentUsecase(repo, noopTx, "server-key", nil, nil)

	handlers := Handlers{
		Public:  &PublicHandler{},
		Payment: NewPaymentHandler(paymentUsecase),
	}
	return NewRouter(handlers, nil, nil, false, nil), order
}

type noopOrderTx struct{}

func (noopOrderTx) NextOrderNumber(context.Context, domain.OrderType, time.Time) (string, error) {
	return "", nil
}
func (noopOrderTx) CreateOrder(context.Context, *domain.Order) error      { return nil }
func (noopOrderTx) CreateItems(context.Context, []domain.OrderItem) error { return nil }
func (noopOrderTx) ConsumeStock(context.Context, *domain.Order, []domain.OrderItem) error {
	return nil
}
func (noopOrderTx) RestoreStock(context.Context, *domain.Order, []domain.OrderItem) error { return nil }
func (noopOrderTx) SetItemStatus(context.Context, uuid.UUID, uuid.UUID, domain.OrderItemStatus, domain.OrderItemStatus, *uuid.UUID) error {
	return nil
}
func (noopOrderTx) CancelOrder(context.Context, uuid.UUID, string, *uuid.UUID) error { return nil }
func (noopOrderTx) UpdateAggregate(context.Context, uuid.UUID, domain.OrderStatus) error {
	return nil
}
func (noopOrderTx) Audit(context.Context, *domain.AuditLog) error { return nil }
func (noopOrderTx) SetPaid(context.Context, uuid.UUID, domain.PaymentMethod, *string, time.Time, *int64, *int64) error {
	return nil
}
func (noopOrderTx) CreatePaymentLog(context.Context, *domain.PaymentLog) error { return nil }
func (noopOrderTx) GetPendingPaymentLog(context.Context, uuid.UUID) (*domain.PaymentLog, error) {
	return nil, nil
}
func (noopOrderTx) GetPaymentLogByGatewayRef(context.Context, string) (*domain.PaymentLog, error) {
	return nil, nil
}
func (noopOrderTx) UpdatePaymentLogStatus(context.Context, uuid.UUID, domain.PaymentLogStatus, *string, *string) error {
	return nil
}

func TestMidtransCallbackHandler_FormAndJSON(t *testing.T) {
	e, order := newCallbackApp(t)
	sig := sign(order.OrderNumber, "200", "10000.00", "server-key")

	form := "order_id=" + order.OrderNumber +
		"&status_code=200&gross_amount=10000.00" +
		"&signature_key=" + sig +
		"&transaction_status=settlement&transaction_id=trx-9&fraud_status=accept"
	req := httptest.NewRequest(http.MethodPost, "/public/payments/midtrans/callback", strings.NewReader(form))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationForm)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body %s", rec.Code, rec.Body.String())
	}

	body, _ := json.Marshal(map[string]string{
		"order_id":           order.OrderNumber,
		"status_code":        "200",
		"gross_amount":       "10000.00",
		"signature_key":      sig,
		"transaction_status": "settlement",
		"transaction_id":     "trx-9",
	})
	req = httptest.NewRequest(http.MethodPost, "/public/payments/midtrans/callback", strings.NewReader(string(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for JSON payload, got %d body %s", rec.Code, rec.Body.String())
	}
}

func TestMidtransCallbackHandler_BadSignatureIs401(t *testing.T) {
	e, order := newCallbackApp(t)

	form := "order_id=" + order.OrderNumber +
		"&status_code=200&gross_amount=10000.00" +
		"&signature_key=nope" +
		"&transaction_status=settlement&transaction_id=trx-9"
	req := httptest.NewRequest(http.MethodPost, "/public/payments/midtrans/callback", strings.NewReader(form))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationForm)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d body %s", rec.Code, rec.Body.String())
	}
}
