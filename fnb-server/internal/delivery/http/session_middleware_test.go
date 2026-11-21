package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type testTableRepo struct {
	table *domain.Table
}

func (r *testTableRepo) GetByQRToken(ctx context.Context, qrToken string) (*domain.Table, error) {
	return r.table, nil
}

type testSessionRepo struct {
	session *domain.TableSession
}

func (r *testSessionRepo) GetOpenByTableID(ctx context.Context, tableID uuid.UUID) (*domain.TableSession, error) {
	if r.session != nil && r.session.Status == domain.TableSessionStatusOpen {
		return r.session, nil
	}
	return nil, nil
}

func (r *testSessionRepo) GetBySessionToken(ctx context.Context, token string) (*domain.TableSession, error) {
	if r.session != nil && r.session.SessionToken == token {
		return r.session, nil
	}
	return nil, nil
}

func (r *testSessionRepo) ListIdleOpen(context.Context, domain.IdleSessionQuery) ([]domain.TableSession, error) {
	return nil, nil
}

func (r *testSessionRepo) Create(ctx context.Context, s *domain.TableSession) error {
	r.session = s
	return nil
}

func (r *testSessionRepo) Close(ctx context.Context, id uuid.UUID, closedBy *uuid.UUID) error {
	if r.session != nil {
		r.session.Status = domain.TableSessionStatusClosed
	}
	return nil
}

func TestSessionMiddleware_MissingHeader_Returns401(t *testing.T) {
	e := echo.New()
	u := usecase.NewTableSessionUsecase(&testSessionRepo{}, &testTableRepo{}, nil)

	handler := SessionMiddleware(u)(func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/public/menu", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := handler(c)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	appErr, ok := err.(*domain.AppError)
	if !ok || appErr.HTTPStatus != http.StatusUnauthorized {
		t.Fatalf("expected 401 UNAUTHORIZED, got %v", err)
	}
}

func TestSessionMiddleware_InvalidToken_Returns401(t *testing.T) {
	e := echo.New()
	u := usecase.NewTableSessionUsecase(&testSessionRepo{}, &testTableRepo{}, nil)

	handler := SessionMiddleware(u)(func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/public/menu", nil)
	req.Header.Set("X-Session-Token", "non-existent-token")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := handler(c)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	appErr, ok := err.(*domain.AppError)
	if !ok || appErr.HTTPStatus != http.StatusUnauthorized {
		t.Fatalf("expected 401 UNAUTHORIZED, got %v", err)
	}
}

func TestSessionMiddleware_ClosedSession_Returns401(t *testing.T) {
	e := echo.New()
	table := &domain.Table{ID: uuid.New(), TableNumber: "A1", IsActive: true}
	session := &domain.TableSession{
		ID:           uuid.New(),
		TableID:      table.ID,
		Table:        *table,
		SessionToken: "closed-token",
		Status:       domain.TableSessionStatusClosed,
	}

	u := usecase.NewTableSessionUsecase(&testSessionRepo{session: session}, &testTableRepo{table: table}, nil)

	handler := SessionMiddleware(u)(func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/public/menu", nil)
	req.Header.Set("X-Session-Token", "closed-token")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := handler(c)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	appErr, ok := err.(*domain.AppError)
	if !ok || appErr.HTTPStatus != http.StatusUnauthorized {
		t.Fatalf("expected 401 UNAUTHORIZED, got %v", err)
	}
}

func TestSessionMiddleware_ValidToken_StoresInContext(t *testing.T) {
	e := echo.New()
	table := &domain.Table{ID: uuid.New(), TableNumber: "A1", IsActive: true}
	session := &domain.TableSession{
		ID:           uuid.New(),
		TableID:      table.ID,
		Table:        *table,
		SessionToken: "valid-token-12345",
		Status:       domain.TableSessionStatusOpen,
	}

	u := usecase.NewTableSessionUsecase(&testSessionRepo{session: session}, &testTableRepo{table: table}, nil)

	var retrievedSession *domain.TableSession
	handler := SessionMiddleware(u)(func(c echo.Context) error {
		s, ok := GetTableSession(c)
		if ok {
			retrievedSession = s
		}
		return c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/public/menu", nil)
	req.Header.Set("X-Session-Token", "valid-token-12345")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := handler(c); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if retrievedSession == nil {
		t.Fatal("expected session stored in context")
	}
	if retrievedSession.SessionToken != "valid-token-12345" {
		t.Errorf("token mismatch: %s", retrievedSession.SessionToken)
	}
}
