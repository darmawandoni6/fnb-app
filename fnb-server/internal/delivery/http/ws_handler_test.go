package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

type wsTestRepo struct{ orders map[uuid.UUID]*domain.Order }

func (r *wsTestRepo) List(context.Context, domain.OrderFilter) ([]domain.Order, error) {
	return nil, nil
}
func (r *wsTestRepo) GetByID(_ context.Context, id uuid.UUID) (*domain.Order, error) {
	return r.orders[id], nil
}
func (r *wsTestRepo) GetByOrderNumber(context.Context, string) (*domain.Order, error) {
	return nil, nil
}

func (r *wsTestRepo) ListCashTimeoutIDs(context.Context, domain.CashTimeoutQuery) ([]uuid.UUID, error) {
	return nil, nil
}
func (r *wsTestRepo) ListItemMoves(context.Context, domain.ItemMoveQuery) ([]domain.ItemMove, error) {
	return nil, nil
}

type wsTestSessionRepo struct {
	sessions map[string]*domain.TableSession
}

func (r *wsTestSessionRepo) GetOpenByTableID(context.Context, uuid.UUID) (*domain.TableSession, error) {
	return nil, nil
}
func (r *wsTestSessionRepo) GetBySessionToken(_ context.Context, token string) (*domain.TableSession, error) {
	return r.sessions[token], nil
}
func (r *wsTestSessionRepo) Create(context.Context, *domain.TableSession) error { return nil }
func (r *wsTestSessionRepo) Close(context.Context, uuid.UUID, *uuid.UUID) error {
	return nil
}
func (r *wsTestSessionRepo) GetByID(_ context.Context, id uuid.UUID) (*domain.TableSession, error) {
	for _, s := range r.sessions {
		if s.ID == id {
			return s, nil
		}
	}
	return nil, nil
}
func (r *wsTestSessionRepo) ListIdleOpen(context.Context, domain.IdleSessionQuery) ([]domain.TableSession, error) {
	return nil, nil
}

func newWSTestServer(t *testing.T) (*httptest.Server, *usecase.Hub) {
	t.Helper()
	hub := usecase.NewHub()
	go hub.Run(context.Background())
	t.Cleanup(hub.Close)

	repo := &wsTestRepo{orders: map[uuid.UUID]*domain.Order{}}
	sessionRepo := &wsTestSessionRepo{sessions: map[string]*domain.TableSession{
		"tok": {ID: uuid.New(), SessionToken: "tok", Status: domain.TableSessionStatusOpen, Table: domain.Table{IsActive: true}},
	}}
	sessionUsecase := usecase.NewTableSessionUsecase(sessionRepo, nil, nil)
	h := NewWSHandler(hub, nil, repo, sessionUsecase)
	e := echo.New()
	e.Binder = NewBinder()
	e.HTTPErrorHandler = ErrorHandler(false, nil)
	e.GET("/ws", h.Connect)
	srv := httptest.NewServer(e)
	t.Cleanup(srv.Close)
	return srv, hub
}

func wsDial(t *testing.T, srv *httptest.Server) *websocket.Conn {
	t.Helper()
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws?session=tok"
	conn, resp, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		body := ""
		if resp != nil {
			body = resp.Status
		}
		t.Fatalf("websocket dial failed: %v (%s)", err, body)
	}
	t.Cleanup(func() { conn.Close() })
	return conn
}

func TestWSHandler_UnauthenticatedRejected(t *testing.T) {
	srv, _ := newWSTestServer(t)
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws"
	_, resp, err := websocket.DefaultDialer.Dial(url, nil)
	if err == nil {
		t.Fatal("expected handshake to be rejected")
	}
	if resp != nil && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestWSHandler_SubscribeSessionTopicReceivesEvent(t *testing.T) {
	srv, hub := newWSTestServer(t)
	conn := wsDial(t, srv)

	sub, _ := json.Marshal(map[string]string{"action": "subscribe", "topic": "session:tok"})
	if err := conn.WriteMessage(websocket.TextMessage, sub); err != nil {
		t.Fatalf("subscribe failed: %v", err)
	}
	time.Sleep(50 * time.Millisecond)

	order := &domain.Order{ID: uuid.New(), OrderNumber: "DI-20261121-001"}
	hub.PublishSession(context.Background(), "tok", domain.OrderEvent{Event: "order.created", Order: order})

	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, payload, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("no event received: %v", err)
	}
	var env struct {
		Topic string         `json:"topic"`
		Event string         `json:"event"`
		Data  map[string]any `json:"data"`
	}
	if err := json.Unmarshal(payload, &env); err != nil {
		t.Fatalf("bad envelope: %v", err)
	}
	if env.Topic != "session:tok" || env.Event != "order.created" {
		t.Errorf("unexpected envelope: %s", payload)
	}
	if env.Data["order_number"] != "DI-20261121-001" {
		t.Errorf("expected order data in payload, got %v", env.Data)
	}
}

func TestWSHandler_UnauthorizedTopicReturnsError(t *testing.T) {
	srv, _ := newWSTestServer(t)
	conn := wsDial(t, srv)

	sub, _ := json.Marshal(map[string]string{"action": "subscribe", "topic": "order:" + uuid.New().String()})
	if err := conn.WriteMessage(websocket.TextMessage, sub); err != nil {
		t.Fatalf("subscribe failed: %v", err)
	}

	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, payload, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("no error envelope received: %v", err)
	}
	if !strings.Contains(string(payload), `"FORBIDDEN"`) {
		t.Errorf("expected FORBIDDEN error, got %s", payload)
	}
}
