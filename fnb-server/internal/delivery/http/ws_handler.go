package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"fnb-server/internal/domain"
	"fnb-server/internal/usecase"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

const (
	wsWriteWait    = 10 * time.Second
	wsPongWait     = 60 * time.Second
	wsPingPeriod   = 30 * time.Second
	wsReadLimit    = 4 << 10
	wsSendBuffer   = 32
	wsTopicOrder   = "order:"
	wsTopicSession = "session:"
	wsActionSub    = "subscribe"
	wsActionUnsub  = "unsubscribe"
)

var errForbiddenTopic = errors.New("topic not allowed")

type WSHandler struct {
	hub            *usecase.Hub
	authUsecase    *usecase.AuthUsecase
	orderRepo      domain.OrderQueryRepository
	sessionUsecase *usecase.TableSessionUsecase
	upgrader       websocket.Upgrader
}

func NewWSHandler(hub *usecase.Hub, authUsecase *usecase.AuthUsecase, orderRepo domain.OrderQueryRepository, sessionUsecase *usecase.TableSessionUsecase) *WSHandler {
	return &WSHandler{
		hub:            hub,
		authUsecase:    authUsecase,
		orderRepo:      orderRepo,
		sessionUsecase: sessionUsecase,
		upgrader: websocket.Upgrader{
			HandshakeTimeout: 10 * time.Second,
			CheckOrigin:      func(r *http.Request) bool { return true },
		},
	}
}

type wsSubscriber struct {
	ws     *websocket.Conn
	send   chan []byte
	closed chan struct{}
	once   sync.Once
}

func (s *wsSubscriber) Send(payload []byte) bool {
	select {
	case s.send <- payload:
		return true
	case <-s.closed:
		return false
	default:
		return false
	}
}

func (s *wsSubscriber) Close() {
	s.once.Do(func() {
		close(s.closed)
		s.ws.Close()
	})
}

type wsInbound struct {
	Action string `json:"action"`
	Topic  string `json:"topic"`
}

type wsErrorEnvelope struct {
	Topic string      `json:"topic"`
	Event string      `json:"event"`
	Data  wsErrorData `json:"data"`
}

type wsErrorData struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (h *WSHandler) Connect(c echo.Context) error {
	ctx := c.Request().Context()

	var role domain.UserRole
	sessionToken := strings.TrimSpace(c.QueryParam("session"))
	if sessionToken == "" {
		authHeader := c.Request().Header.Get("Authorization")
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			return domain.NewError(domain.CodeUnauthorized, "authorization or session token is required", http.StatusUnauthorized, nil)
		}
		claims, err := h.authUsecase.ValidateAccessToken(parts[1])
		if err != nil {
			return domain.NewError(domain.CodeUnauthorized, "invalid or expired access token", http.StatusUnauthorized, err)
		}
		role = claims.Role
	} else if h.sessionUsecase != nil {
		if _, err := h.sessionUsecase.RequireOpen(ctx, sessionToken); err != nil {
			return err
		}
	}

	ws, err := h.upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return nil
	}

	sub := &wsSubscriber{ws: ws, send: make(chan []byte, wsSendBuffer), closed: make(chan struct{})}
	ws.SetReadLimit(wsReadLimit)
	_ = ws.SetReadDeadline(time.Now().Add(wsPongWait))
	ws.SetPongHandler(func(string) error {
		return ws.SetReadDeadline(time.Now().Add(wsPongWait))
	})

	go h.writeLoop(sub)
	h.readLoop(ctx, sub, role, sessionToken)
	return nil
}

func (h *WSHandler) writeLoop(sub *wsSubscriber) {
	ticker := time.NewTicker(wsPingPeriod)
	defer ticker.Stop()
	defer sub.Close()

	for {
		select {
		case payload := <-sub.send:
			_ = sub.ws.SetWriteDeadline(time.Now().Add(wsWriteWait))
			if err := sub.ws.WriteMessage(websocket.TextMessage, payload); err != nil {
				return
			}
		case <-ticker.C:
			_ = sub.ws.SetWriteDeadline(time.Now().Add(wsWriteWait))
			if err := sub.ws.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		case <-sub.closed:
			return
		}
	}
}

func (h *WSHandler) readLoop(ctx context.Context, sub *wsSubscriber, role domain.UserRole, sessionToken string) {
	var subscribed []string
	defer func() {
		for _, topic := range subscribed {
			h.hub.Unregister(topic, sub)
		}
		sub.Close()
	}()

	for {
		_, payload, err := sub.ws.ReadMessage()
		if err != nil {
			return
		}
		var in wsInbound
		if err := json.Unmarshal(payload, &in); err != nil {
			continue
		}
		topic := strings.TrimSpace(in.Topic)
		switch in.Action {
		case wsActionSub:
			if err := h.authorize(ctx, topic, role, sessionToken); err != nil {
				sub.Send(mustJSON(wsErrorEnvelope{Topic: topic, Event: "error", Data: wsErrorData{Code: domain.CodeForbidden, Message: "topic not allowed"}}))
				continue
			}
			h.hub.Register(topic, sub)
			subscribed = append(subscribed, topic)
		case wsActionUnsub:
			h.hub.Unregister(topic, sub)
		}
	}
}

func (h *WSHandler) authorize(ctx context.Context, topic string, role domain.UserRole, sessionToken string) error {
	switch {
	case strings.HasPrefix(topic, wsTopicSession):
		token := strings.TrimPrefix(topic, wsTopicSession)
		if sessionToken != "" {
			if token != sessionToken {
				return errForbiddenTopic
			}
			return nil
		}
		if h.sessionUsecase == nil {
			return errForbiddenTopic
		}
		_, err := h.sessionUsecase.RequireOpen(ctx, token)
		return err
	case strings.HasPrefix(topic, wsTopicOrder):
		if role == "" {
			return errForbiddenTopic
		}
		id, err := uuid.Parse(strings.TrimPrefix(topic, wsTopicOrder))
		if err != nil {
			return errForbiddenTopic
		}
		if role != domain.UserRoleKitchen {
			return nil
		}
		order, err := h.orderRepo.GetByID(ctx, id)
		if err != nil || order == nil || order.PaymentStatus != domain.PaymentStatusPaid {
			return errForbiddenTopic
		}
		return nil
	default:
		return errForbiddenTopic
	}
}

func mustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	return b
}
