package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type mockOrderQueryRepo struct {
	orders []domain.Order
	byID   map[uuid.UUID]*domain.Order
}

func (m *mockOrderQueryRepo) List(ctx context.Context, filter domain.OrderFilter) ([]domain.Order, error) {
	return m.orders, nil
}
func (m *mockOrderQueryRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Order, error) {
	if o, ok := m.byID[id]; ok {
		return o, nil
	}
	return nil, nil
}

type mockOrderMenuRepo struct {
	menus map[uuid.UUID]domain.Menu
}

func (m *mockOrderMenuRepo) ListAvailableGroupedByCategory(ctx context.Context) ([]domain.MenuCategory, error) {
	return nil, nil
}
func (m *mockOrderMenuRepo) ListAvailableByIDs(ctx context.Context, ids []uuid.UUID) ([]domain.Menu, error) {
	var res []domain.Menu
	for _, id := range ids {
		if menu, ok := m.menus[id]; ok {
			res = append(res, menu)
		}
	}
	return res, nil
}

type mockOrderSettingRepo struct{}

func (m *mockOrderSettingRepo) GetFirst(ctx context.Context) (*domain.Setting, error) {
	return &domain.Setting{IsOpen: true, TaxPercent: 10}, nil
}

type mockOrderTx struct{}

func (t *mockOrderTx) CreateOrder(ctx context.Context, o *domain.Order) error { return nil }
func (t *mockOrderTx) CreateItems(ctx context.Context, items []domain.OrderItem) error {
	return nil
}
func (t *mockOrderTx) ConsumeStock(ctx context.Context, items []domain.OrderItem) error { return nil }
func (t *mockOrderTx) PersistCancel(ctx context.Context, o *domain.Order, itemID uuid.UUID, r *domain.Refund) error {
	return nil
}
func (t *mockOrderTx) SetPayment(ctx context.Context, id uuid.UUID, s domain.PaymentStatus, m *domain.PaymentMethod) error {
	return nil
}
func (t *mockOrderTx) SetItemStatus(ctx context.Context, orderID, itemID uuid.UUID, from, to domain.OrderItemStatus) error {
	return nil
}
func (t *mockOrderTx) UpdateAggregate(ctx context.Context, id uuid.UUID, s domain.OrderStatus) error {
	return nil
}

func testOrderTxRunner(ctx context.Context, fn func(usecase.OrderTx) error) error {
	return fn(&mockOrderTx{})
}

func setupTestOrderApp(t *testing.T) (*echo.Echo, string, string, string, *domain.Order, uuid.UUID) {
	hash, err := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}

	owner := &domain.User{
		ID:           uuid.New(),
		Email:        "owner@fnb.com",
		PasswordHash: string(hash),
		Role:         domain.UserRoleOwner,
		IsActive:     true,
	}
	cashier := &domain.User{
		ID:           uuid.New(),
		Email:        "cashier@fnb.com",
		PasswordHash: string(hash),
		Role:         domain.UserRoleCashier,
		IsActive:     true,
	}
	kitchen := &domain.User{
		ID:           uuid.New(),
		Email:        "kitchen@fnb.com",
		PasswordHash: string(hash),
		Role:         domain.UserRoleKitchen,
		IsActive:     true,
	}

	userRepo := &mockUserRepo{
		users: map[string]*domain.User{
			owner.Email:   owner,
			cashier.Email: cashier,
			kitchen.Email: kitchen,
		},
	}
	sessionRepo := &mockSessionRepo{sessions: make(map[string]*domain.Session)}
	authUsecase := usecase.NewAuthUsecase(userRepo, sessionRepo, "super-secret-key-for-test", 15*time.Minute, 24*time.Hour)

	ownerRes, _ := authUsecase.Login(context.Background(), owner.Email, "password123")
	cashierRes, _ := authUsecase.Login(context.Background(), cashier.Email, "password123")
	kitchenRes, _ := authUsecase.Login(context.Background(), kitchen.Email, "password123")

	menuID := uuid.New()
	orderID := uuid.New()
	itemID := uuid.New()
	order := &domain.Order{
		ID:             orderID,
		OrderType:      domain.OrderTypeManual,
		Status:         domain.OrderStatusWaiting,
		PaymentStatus:  domain.PaymentStatusUnpaid,
		SubtotalAmount: 20000,
		TaxPercent:     10,
		TaxAmount:      2000,
		TotalAmount:    22000,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
		Items: []domain.OrderItem{
			{
				ID:      itemID,
				OrderID: orderID,
				MenuID:  menuID,
				Menu:    domain.Menu{ID: menuID, Name: "Latte"},
				Qty:     1,
				Price:   20000,
				Status:  domain.OrderItemStatusPending,
			},
		},
	}

	orderRepo := &mockOrderQueryRepo{
		orders: []domain.Order{*order},
		byID:   map[uuid.UUID]*domain.Order{orderID: order},
	}
	menuRepo := &mockOrderMenuRepo{
		menus: map[uuid.UUID]domain.Menu{
			menuID: {ID: menuID, Name: "Latte", Price: 20000},
		},
	}
	settingRepo := &mockOrderSettingRepo{}
	orderUsecase := usecase.NewOrderUsecase(orderRepo, menuRepo, settingRepo, testOrderTxRunner)
	orderHandler := NewOrderHandler(orderUsecase)
	authHandler := NewAuthHandler(authUsecase, false)

	handlers := Handlers{
		Auth:   authHandler,
		Public: &PublicHandler{},
		Order:  orderHandler,
	}
	e := NewRouter(handlers, authUsecase, false, nil)

	return e, ownerRes.AccessToken, cashierRes.AccessToken, kitchenRes.AccessToken, order, menuID
}

func TestOrderHandler_List(t *testing.T) {
	e, ownerToken, _, _, _, _ := setupTestOrderApp(t)

	// Unauthenticated
	req := httptest.NewRequest(http.MethodGet, "/orders", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}

	// Authenticated
	req = httptest.NewRequest(http.MethodGet, "/orders", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+ownerToken)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}
}

func TestOrderHandler_Get(t *testing.T) {
	e, ownerToken, _, _, order, _ := setupTestOrderApp(t)

	req := httptest.NewRequest(http.MethodGet, "/orders/"+order.ID.String(), nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+ownerToken)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestOrderHandler_CreateManual_RoleGuardAndSuccess(t *testing.T) {
	e, ownerToken, _, kitchenToken, _, menuID := setupTestOrderApp(t)

	body := `{"items":[{"menu_id":"` + menuID.String() + `","qty":1}]}`

	// Kitchen cannot create manual orders (403 Forbidden)
	req := httptest.NewRequest(http.MethodPost, "/orders/manual", bytes.NewBufferString(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+kitchenToken)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for kitchen, got %d", rec.Code)
	}

	// Owner can create manual order (201 Created)
	req = httptest.NewRequest(http.MethodPost, "/orders/manual", bytes.NewBufferString(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+ownerToken)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for owner, got %d. Body: %s", rec.Code, rec.Body.String())
	}
}

func TestOrderHandler_Payment_Success(t *testing.T) {
	e, ownerToken, _, _, order, _ := setupTestOrderApp(t)

	body := `{"payment_status":"LUNAS","payment_method":"CASH"}`
	req := httptest.NewRequest(http.MethodPatch, "/orders/"+order.ID.String()+"/payment", bytes.NewBufferString(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+ownerToken)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var res struct {
		Success bool `json:"success"`
		Data    struct {
			PaymentStatus string `json:"payment_status"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !res.Success || res.Data.PaymentStatus != "LUNAS" {
		t.Errorf("expected payment_status LUNAS, got %+v", res)
	}
}

func TestOrderHandler_CancelItem_Success(t *testing.T) {
	e, ownerToken, _, _, order, _ := setupTestOrderApp(t)

	itemID := order.Items[0].ID
	req := httptest.NewRequest(http.MethodPost, "/orders/"+order.ID.String()+"/items/"+itemID.String()+"/cancel", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer "+ownerToken)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}
}
