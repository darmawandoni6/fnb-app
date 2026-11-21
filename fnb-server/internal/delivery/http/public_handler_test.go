package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"fnb-server/internal/delivery/http/dto"
	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type mockPublicMenuRepo struct {
	categories []domain.MenuCategory
}

func (m *mockPublicMenuRepo) ListAvailableGroupedByCategory(ctx context.Context) ([]domain.MenuCategory, error) {
	return m.categories, nil
}

func (m *mockPublicMenuRepo) ListAvailableByIDs(ctx context.Context, ids []uuid.UUID) ([]domain.Menu, error) {
	return nil, nil
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
	publicUsecase := usecase.NewPublicUsecase(tableRepo, menuRepo, settingRepo)
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
	publicUsecase := usecase.NewPublicUsecase(tableRepo, nil, nil)
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
