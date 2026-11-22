package http

import (
	"context"
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

type mockReportRepo struct {
	summary domain.SalesReportSummary
	trends  []domain.DailySalesTrend
	menus   []domain.TopSellingMenuItem
	cats    []domain.CategorySalesShare
	err     error
}

func (m *mockReportRepo) ListSummary(context.Context, domain.ReportFilter) (*domain.SalesReportSummary, error) {
	s := m.summary
	return &s, m.err
}
func (m *mockReportRepo) ListTrends(context.Context, domain.ReportFilter) ([]domain.DailySalesTrend, error) {
	return m.trends, m.err
}
func (m *mockReportRepo) ListTopMenus(context.Context, domain.ReportFilter, int) ([]domain.TopSellingMenuItem, error) {
	return m.menus, m.err
}
func (m *mockReportRepo) ListCategorySales(context.Context, domain.ReportFilter) ([]domain.CategorySalesShare, error) {
	return m.cats, m.err
}

type mockReportOrderRepo struct{ orders []domain.Order }

func (m *mockReportOrderRepo) List(_ context.Context, f domain.OrderFilter) ([]domain.Order, error) {
	return m.orders, nil
}
func (m *mockReportOrderRepo) GetByID(context.Context, uuid.UUID) (*domain.Order, error) {
	return nil, nil
}
func (m *mockReportOrderRepo) GetByOrderNumber(context.Context, string) (*domain.Order, error) {
	return nil, nil
}
func (m *mockReportOrderRepo) ListCashTimeoutIDs(context.Context, domain.CashTimeoutQuery) ([]uuid.UUID, error) {
	return nil, nil
}
func (m *mockReportOrderRepo) ListItemMoves(context.Context, domain.ItemMoveQuery) ([]domain.ItemMove, error) {
	return nil, nil
}

// testReportsRouter builds the /reports group with a token guard so the role
// matrix is covered without a full auth stack.
func testReportsRouter(reportRepo domain.ReportRepository, orderRepo domain.OrderQueryRepository, role domain.UserRole) *echo.Echo {
	e := echo.New()
	e.Binder = NewBinder()
	e.HTTPErrorHandler = ErrorHandler(true, nil)
	h := NewReportHandler(usecase.NewReportUsecase(reportRepo, orderRepo))
	g := e.Group("/reports", func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Set("role", role)
			return next(c)
		}
	}, RequireRoles(domain.UserRoleOwner))
	g.GET("/summary", h.Summary)
	g.GET("/transactions", h.Transactions)
	return e
}

func reportsFixture() *mockReportRepo {
	return &mockReportRepo{
		summary: domain.SalesReportSummary{TotalRevenue: 300000, TotalOrders: 3, AverageOrderValue: 100000, CashRevenue: 300000, TotalItemsSold: 9},
		trends:  []domain.DailySalesTrend{{Date: "2026-11-20", Revenue: 100000, OrderCount: 1}, {Date: "2026-11-21", Revenue: 200000, OrderCount: 2}},
		menus:   []domain.TopSellingMenuItem{{MenuID: "m1", MenuName: "Latte", CategoryName: "Minuman", QtySold: 9, TotalRevenue: 300000}},
		cats:    []domain.CategorySalesShare{{CategoryID: "c1", CategoryName: "Minuman", TotalRevenue: 300000, TotalItemsSold: 9, Percentage: 100}},
	}
}

func TestReportHandler_Summary(t *testing.T) {
	e := testReportsRouter(reportsFixture(), &mockReportOrderRepo{}, domain.UserRoleOwner)

	req := httptest.NewRequest(http.MethodGet, "/reports/summary?from=2026-11-20&to=2026-11-21", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	for _, want := range []string{`"summary"`, `"trends"`, `"top_menus"`, `"categories"`, `"total_revenue":300000`} {
		if !strings.Contains(body, want) {
			t.Fatalf("missing %s in %s", want, body)
		}
	}
}

func TestReportHandler_RangeValidation(t *testing.T) {
	repo := &mockReportRepo{}
	cases := []struct{ name, query string }{
		{"missing both", ""},
		{"missing to", "?from=2026-11-20"},
		{"inverted", "?from=2026-11-21&to=2026-11-20"},
		{"too long", "?from=2025-01-01&to=2026-11-20"},
		{"bad format", "?from=20-11-2026&to=2026-11-21"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := testReportsRouter(repo, &mockReportOrderRepo{}, domain.UserRoleOwner)
			req := httptest.NewRequest(http.MethodGet, "/reports/summary"+tc.query, nil)
			rec := httptest.NewRecorder()
			e.ServeHTTP(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
			}
			if !strings.Contains(rec.Body.String(), domain.CodeValidationError) {
				t.Fatalf("expected VALIDATION_ERROR, got %s", rec.Body.String())
			}
		})
	}
}

func TestReportHandler_RoleGuard(t *testing.T) {
	for _, role := range []domain.UserRole{domain.UserRoleCashier, domain.UserRoleKitchen} {
		e := testReportsRouter(reportsFixture(), &mockReportOrderRepo{}, role)
		req := httptest.NewRequest(http.MethodGet, "/reports/summary?from=2026-11-20&to=2026-11-21", nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("role %s: expected 403, got %d", role, rec.Code)
		}
	}
}

func TestReportHandler_Transactions(t *testing.T) {
	order := domain.Order{
		ID:            uuid.New(),
		OrderNumber:   "TA-20261121-001",
		OrderType:     domain.OrderTypeTakeAway,
		CustomerName:  "Budi",
		Status:        domain.OrderStatusCompleted,
		PaymentStatus: domain.PaymentStatusUnpaid,
		TotalAmount:   20000,
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}
	e := testReportsRouter(reportsFixture(), &mockReportOrderRepo{orders: []domain.Order{order}}, domain.UserRoleOwner)

	req := httptest.NewRequest(http.MethodGet, "/reports/transactions?from=2026-11-20&to=2026-11-21&payment_method=ALL&order_type=TAKE_AWAY", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "TA-20261121-001") {
		t.Fatalf("expected the order in the response, got %s", rec.Body.String())
	}

	// A bogus filter value is rejected.
	req = httptest.NewRequest(http.MethodGet, "/reports/transactions?from=2026-11-20&to=2026-11-21&payment_method=BITCOIN", nil)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for bad payment_method, got %d", rec.Code)
	}
}
