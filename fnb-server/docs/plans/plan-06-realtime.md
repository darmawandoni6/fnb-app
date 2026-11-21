# Plan 06 — Real-time WebSocket

One hub, one connection per client, topics per order and per table session (PRD §11.4; `flow.md` real time and polling).

Depends on: 04.
Blocks: 07 (scheduler publishes), 09.

## 1. Scope

In:

| Method | Path | Auth |
|---|---|---|
| `GET` | `/ws` | `Authorization: Bearer <access_token>` |
| `GET` | `/ws?session=<session_token>` | table session |

Plus a `Publisher` implementation, the hub, topic authorization, and the publish calls added to the usecases from plan 04/05.

Out:

- Client code (both SPAs).
- Polling fallback (already the client's job; the server must never depend on the socket).

## 2. Decisions

| # | Decision | Reason |
|---|---|---|
| 1 | Dependency `github.com/gorilla/websocket`. Added to `docs/tech-stack.md`. | Echo has no first-party WS; gorilla is the de-facto standard and is small. |
| 2 | One hub with a `map[topic]map[*client]struct{}` guarded by a mutex; sends go through a buffered channel per client. | Simple, no external broker (`docs/tech-stack.md` excludes Redis). |
| 3 | A slow client (buffer full) is dropped and disconnected, not blocked. | Server must never stall on one browser (PRD §11 non-functional). |
| 4 | `flow.md` says "one hub, one connection per client"; a dashboard client subscribes to the topics it needs by sending a subscribe message. | A cashier with 50 open orders should not open 50 sockets. |
| 5 | Subscribe message: `{"action":"subscribe","topic":"order:uuid"}` / `{"action":"unsubscribe",...}`. | One small protocol. |
| 6 | Topic authorization at subscribe time: `order:{id}` requires a valid JWT, and for `KITCHEN` the order must be paid; `session:{token}` requires the token to be an `OPEN` session. An unauthorized subscribe gets `{"event":"error","data":{"code":"FORBIDDEN"}}` and the subscription is refused. | Don't leak unpaid orders to the kitchen (plan 04 decision 17) or other tables' orders to a customer. |
| 7 | Server is the only publisher. Client messages other than subscribe/unsubscribe are ignored. | PRD §11.4. |
| 8 | Envelope on the wire matches `api.md`: `{"topic","event","data"}`. | Client code already targets it. |
| 9 | Publish happens after the transaction commits, from the usecase, via the `domain.Publisher` interface. | Never emit for a rolled-back write. |
| 10 | Ping every 30 s, pong deadline 60 s, `SetReadLimit(4<<10)`. | Keeps proxies from killing idle sockets; caps inbound memory. |
| 11 | The hub keeps no state about orders. It only routes. | The DB is the source of truth (EC-19). |
| 12 | Shutdown: the hub closes every client on `e.Shutdown` via a `Close()` called from `main` after `e.Start` returns. | No goroutine leak. |

## 3. Domain

`internal/domain/order_events.go` (declared in plan 04):

```go
type Event struct {
    Topic string
    Name  string // order.created order.updated item.updated session.closed
    Data  any
}
type Publisher interface {
    Publish(ev Event)
}
```

Usecases take a `domain.Publisher`; `nil` means no-op so tests do not need a hub.

## 4. Repository

None.

## 5. Usecase

No new usecase. The existing write usecases gain these calls after their transaction returns:

| Usecase method | Events |
|---|---|
| `CreateOrder` / `CreateManual` | `order.created` on `order:{id}` and `session:{token}` |
| `UpdateItemStatus` | `item.updated` on `order:{id}` + session, `order.updated` on `order:{id}` when the aggregate changed |
| `ConfirmPayment` | `order.updated` on `order:{id}` + session |
| `CancelOrder` | `order.updated` on `order:{id}` + session |
| `HandleMidtransCallback` | `order.updated` on `order:{id}` + session |
| Session close (plan 07/08) | `session.closed` on `session:{token}` |

The event payload is the same `OrderResponse` DTO shape, built in the usecase boundary? No — keep the hub transport-agnostic: publish `domain.Order` and let the delivery layer map it. To avoid importing `dto` into `usecase`, publish a small `domain.OrderEventData{ID, OrderNumber, Status, PaymentStatus, Items []{ID, Status}}`.

## 6. Delivery

### 6.1 `internal/delivery/http/ws_handler.go`

```go
type WSHandler struct {
    hub         *usecase.Hub
    authUsecase *usecase.AuthUsecase
    sessionUC   *usecase.TableSessionUsecase
}

func (h *WSHandler) Connect(c echo.Context) error
```

`Connect`:

1. If `?session=` is present → validate the session, role-less client, allowed topics `session:{token}` only.
2. Else parse `Authorization: Bearer`; invalid → `401`.
3. Upgrade, register with the hub, send no initial payload.
4. Serve the read loop: parse `subscribe`/`unsubscribe`, authorize, register.
5. Serve the write loop in the same handler (gorilla requires one reader and one writer; use two goroutines with a `done` channel).

### 6.2 `internal/usecase/ws_hub.go`

```go
type Hub struct { /* mutex, map topic->clients, register/unregister/publish channels */ }

func NewHub() *Hub
func (h *Hub) Run(ctx context.Context)
func (h *Hub) Register(topic string, c Client) 
func (h *Hub) Unregister(topic string, c Client)
func (h *Hub) Publish(ev domain.Event)
func (h *Hub) Close()
```

`Client` is a small interface `{ Send([]byte) bool; Close() }` implemented by the WS handler, so the hub is testable without a socket.

### 6.3 Router

```go
e.GET("/ws", h.WS.Connect)
```

No JWT middleware: the handler authenticates both modes itself and needs to control the upgrade.

### 6.4 Wiring

`cmd/api/wiring_realtime.go`:

```go
func newHub(ctx context.Context) *usecase.Hub
```

Start `hub.Run(ctx)` in `main` with a context cancelled on shutdown.

## 7. Tests

- Hub: register two clients on one topic, publish once → both receive; unregister → no receive; a client whose `Send` returns false is removed.
- Authorization: dashboard token subscribing to `order:{id}` allowed for the owner; kitchen on an unpaid order refused; customer token refused on any `order:` topic; `session:{other}` refused.
- Race: `go test -race` with concurrent publish and register/unregister.
- Handler smoke test with `httptest` + gorilla client: connect, subscribe, receive one event triggered by a real usecase call against a test DB (or a fake publisher path).

## 8. Verification

```bash
go test -race ./internal/usecase/ ./internal/delivery/http/
go build ./...
```

Manual:

```bash
websocat "ws://localhost:8081/ws?session=$T"
# {"action":"subscribe","topic":"session:$T"}
# create an order in another shell → expect order.created
```

## 9. Docs to update

- `docs/tech-stack.md` — replace "Deliberately Excluded: WebSocket" with the gorilla entry and move WebSocket into the selected stack, noting polling remains the fallback.
- `../../../docs/flow.md` — already documents the hub; no change.
- `AGENTS.md` — no change.
