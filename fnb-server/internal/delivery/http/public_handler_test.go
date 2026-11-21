package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"fnb-server/internal/delivery/http/dto"
	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type mockPublicMenuRepo struct {
	categories []domain.MenuCategory
	menus      map[uuid.UUID]domain.Menu
}

func (m *mockPublicMenuRepo) ListAvailableGroupedByCategory(ctx context.Context) ([]domain.MenuCategory, error) {
	return m.categories, nil
}

func (m *mockPublicMenuRepo) ListAvailableByIDs(ctx context.Context, ids []uuid.UUID) ([]domain.Menu, error) {
	var res []domain.Menu
	for _, id := range ids {
		if menu, ok := m.menus[id]; ok {
			res = append(res, menu)
		}
	}
	return res, nil
}

type mockPublicSettingRepo struct {
	setting *domain.Setting
}

func (m *mockPublicSettingRepo) GetFirst(ctx context.Context) (*domain.Setting, error) {
	return m.setting, nil
}

func TestPublicHandler_Menu_ResponseShapeAndEmptyCategoryOmitted(t *testing.T) {
	e := echo.New()
	e.Binder = NewBinder()
	e.HTTPErrorHandler = ErrorHandler(true, nil)

	cat1ID := uuid.New()
	cat2ID := uuid.New()

	menuRepo := &mockPublicMenuRepo{
		categories: []domain.MenuCategory{
			{
				ID:   cat1ID,
				Name: "Coffee",
				Menus: []domain.Menu{
					{
						ID:          uuid.New(),
						CategoryID:  cat1ID,
						Name:        "Espresso",
						Price:       25000,
						IsAvailable: true,
					},
				},
			},
			{
				ID:    cat2ID,
				Name:  "Empty Category",
				Menus: []domain.Menu{}, // Empty: should be omitted
			},
		},
	}

	settingRepo := &mockPublicSettingRepo{
		setting: &domain.Setting{
			CafeName:    "Super Cafe",
			ServiceRate: 5,
			TaxRate:     10,
			IsOpen:      true,
		},
	}

	table := &domain.Table{ID: uuid.New(), TableNumber: "B1", IsActive: true}
	session := &domain.TableSession{
		ID:           uuid.New(),
		TableID:      table.ID,
		Table:        *table,
		SessionToken: "my-valid-token",
		Status:       domain.TableSessionStatusOpen,
	}

	tableRepo := &testTableRepo{table: table}
	sessionRepo := &testSessionRepo{session: session}

	sessionUsecase := usecase.NewTableSessionUsecase(sessionRepo, tableRepo, nil)
	publicUsecase := usecase.NewPublicUsecase(tableRepo, menuRepo, settingRepo, nil, nil, nil, nil)
	handler := NewPublicHandler(publicUsecase, sessionUsecase)

	e.GET("/public/menu", handler.Menu, SessionMiddleware(sessionUsecase))

	req := httptest.NewRequest(http.MethodGet, "/public/menu", nil)
	req.Header.Set("X-Session-Token", "my-valid-token")
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var res struct {
		Success bool             `json:"success"`
		Data    dto.MenuResponse `json:"data"`
	}

	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !res.Success {
		t.Fatal("expected success = true")
	}

	data := res.Data
	if data.CafeName != "Super Cafe" {
		t.Errorf("expected cafe_name Super Cafe, got %s", data.CafeName)
	}
	if data.ServiceRate != 5 {
		t.Errorf("expected service_rate 5, got %v", data.ServiceRate)
	}
	if data.TaxRate != 10 {
		t.Errorf("expected tax_rate 10, got %v", data.TaxRate)
	}
	if !data.IsOpen {
		t.Errorf("expected is_open = true")
	}

	// Verify only 1 category returned (empty category omitted)
	if len(data.Categories) != 1 {
		t.Fatalf("expected 1 category (empty category omitted), got %d", len(data.Categories))
	}
	if data.Categories[0].Name != "Coffee" {
		t.Errorf("expected category Coffee, got %s", data.Categories[0].Name)
	}
	if len(data.Categories[0].Menus) != 1 {
		t.Fatalf("expected 1 menu in Coffee, got %d", len(data.Categories[0].Menus))
	}
	if data.Categories[0].Menus[0].Name != "Espresso" || data.Categories[0].Menus[0].Price != 25000 {
		t.Errorf("unexpected menu details: %+v", data.Categories[0].Menus[0])
	}
}

func TestPublicHandler_OpenSession_Success(t *testing.T) {
	e := echo.New()
	e.Binder = NewBinder()
	e.HTTPErrorHandler = ErrorHandler(true, nil)

	table := &domain.Table{ID: uuid.New(), TableNumber: "A1", QRToken: "table-a1", IsActive: true}
	tableRepo := &testTableRepo{table: table}
	sessionRepo := &testSessionRepo{}

	sessionUsecase := usecase.NewTableSessionUsecase(sessionRepo, tableRepo, nil)
	publicUsecase := usecase.NewPublicUsecase(tableRepo, nil, nil, nil, nil, nil, nil)
	handler := NewPublicHandler(publicUsecase, sessionUsecase)

	e.POST("/public/tables/:qr_token/sessions", handler.OpenSession)

	req := httptest.NewRequest(http.MethodPost, "/public/tables/table-a1/sessions", nil)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var res struct {
		Success bool                    `json:"success"`
		Data    dto.OpenSessionResponse `json:"data"`
	}

	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !res.Success || res.Data.SessionToken == "" {
		t.Fatalf("expected success with non-empty session token: %+v", res)
	}
	if res.Data.TableNumber != "A1" {
		t.Errorf("expected table_number A1, got %s", res.Data.TableNumber)
	}
	if res.Data.Status != "OPEN" {
		t.Errorf("expected status OPEN, got %s", res.Data.Status)
	}
}

func TestPublicHandler_Orders_FullFlow(t *testing.T) {
	e := echo.New()
	e.Binder = NewBinder()
	e.HTTPErrorHandler = ErrorHandler(true, nil)

	table := &domain.Table{ID: uuid.New(), TableNumber: "C1", IsActive: true}
	session := &domain.TableSession{
		ID:           uuid.New(),
		TableID:      table.ID,
		Table:        *table,
		SessionToken: "session-c1",
		Status:       domain.TableSessionStatusOpen,
	}

	tableRepo := &testTableRepo{table: table}
	sessionRepo := &testSessionRepo{session: session}
	sessionUsecase := usecase.NewTableSessionUsecase(sessionRepo, tableRepo, nil)

	menuID := uuid.New()
	menuRepo := &mockPublicMenuRepo{
		menus: map[uuid.UUID]domain.Menu{
			menuID: {ID: menuID, Name: "Americano", Price: 30000, IsAvailable: true},
		},
	}
	settingRepo := &mockPublicSettingRepo{
		setting: &domain.Setting{IsOpen: true, ServiceRate: 5, TaxRate: 10},
	}

	orderRepo := &mockOrderQueryRepo{
		orders: []domain.Order{},
		byID:   map[uuid.UUID]*domain.Order{},
	}
	tx := &mockOrderTx{}
	txRunner := func(ctx context.Context, fn func(usecase.OrderTx) error) error {
		return fn(tx)
	}

	publicUsecase := usecase.NewPublicUsecase(tableRepo, menuRepo, settingRepo, orderRepo, txRunner, nil, nil)
	handler := NewPublicHandler(publicUsecase, sessionUsecase)

	sg := e.Group("/public", SessionMiddleware(sessionUsecase))
	sg.POST("/orders", handler.CreateOrder)
	sg.GET("/orders", handler.ListOrders)
	sg.GET("/orders/:id", handler.GetOrder)
	sg.POST("/orders/:id/cancel", handler.CancelOrder)

	// 1. Create order
	body := `{"customer_name":"Dewi","payment_method":"CASH","items":[{"menu_id":"` + menuID.String() + `","qty":2}]}`
	req := httptest.NewRequest(http.MethodPost, "/public/orders", bytes.NewBufferString(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-Session-Token", "session-c1")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 on create order, got %d: %s", rec.Code, rec.Body.String())
	}

	var createRes struct {
		Success bool                  `json:"success"`
		Data    dto.PublicOrderResponse `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &createRes); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	createdID, err := uuid.Parse(createRes.Data.ID)
	if err != nil {
		t.Fatalf("invalid created order id: %v", err)
	}

	// Add to mock repo so list/get/cancel can see it
	storedOrder := domain.Order{
		ID:             createdID,
		OrderNumber:    createRes.Data.OrderNumber,
		TableSessionID: &session.ID,
		TableID:        &table.ID,
		Table:          table,
		CustomerName:   "Dewi",
		Status:         domain.OrderStatusWaiting,
		PaymentStatus:  domain.PaymentStatusUnpaid,
		SubtotalAmount: createRes.Data.SubtotalAmount,
		TotalAmount:    createRes.Data.TotalAmount,
		CreatedAt:      time.Now().UTC(),
	}
	orderRepo.orders = append(orderRepo.orders, storedOrder)
	orderRepo.byID[createdID] = &storedOrder

	// 2. List orders
	req = httptest.NewRequest(http.MethodGet, "/public/orders", nil)
	req.Header.Set("X-Session-Token", "session-c1")
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on list orders, got %d: %s", rec.Code, rec.Body.String())
	}

	// 3. Get order
	req = httptest.NewRequest(http.MethodGet, "/public/orders/"+createdID.String(), nil)
	req.Header.Set("X-Session-Token", "session-c1")
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on get order, got %d: %s", rec.Code, rec.Body.String())
	}

	// 4. Cancel order
	cancelBody := `{"reason":"Customer changed mind"}`
	req = httptest.NewRequest(http.MethodPost, "/public/orders/"+createdID.String()+"/cancel", bytes.NewBufferString(cancelBody))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-Session-Token", "session-c1")
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on cancel order, got %d: %s", rec.Code, rec.Body.String())
	}
}
