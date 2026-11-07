# Backend Tech Stack

## Scope

Backend serves `fnb-dashboard` and `fnb-qr-menu` through one Go API and one PostgreSQL database. PostgREST is not used.

## Selected Stack

| Area | Technology | Reason |
|---|---|---|
| Language | Go | Static typing, simple deployment, low runtime overhead |
| HTTP API | Echo v4 | Existing project framework, routing, middleware, error handling |
| ORM | GORM | Existing project ORM; supports PostgreSQL, transactions, and query composition |
| PostgreSQL driver | `gorm.io/driver/postgres` with pgx | Native PostgreSQL support through GORM |
| Validation | `go-playground/validator/v10` | Declarative request validation through struct tags |
| Logging | Go `log/slog` | Standard library structured logging; text in development, JSON in production |
| Authentication | `github.com/golang-jwt/jwt/v5` | JWT access tokens for internal users |
| Password hashing | `golang.org/x/crypto/bcrypt` | Passwords are stored as bcrypt hashes, never plaintext |
| UUID | `github.com/google/uuid` | UUID generation for primary keys and public identifiers |
| Refresh tokens | `crypto/rand` + `crypto/sha256` | Cryptographically secure token generation; database stores only hashes |
| QR generation | `github.com/skip2/go-qrcode` | Generate printable table QR codes when QR management is implemented |
| Migrations | Versioned SQL + `psql` | Explicit schema changes, reviewable diffs, PostgreSQL enum support |
| Testing | Go standard `testing` package | No test framework required for current scope |

## Runtime

- Local container runtime: Podman with `podman-compose`.
- Database: PostgreSQL.
- API communication: HTTP JSON.
- MVP updates: client polling; no WebSocket, SSE, Redis, or message broker.
- Money: integer rupiah (`bigint`), never floating point.

## Package Boundaries

```text
delivery/http → usecase → repository → domain
                         └──────→ domain
```

- `cmd/*`: dependency wiring and process startup.
- `internal/config`: environment loading and validation.
- `internal/database`: GORM connection and pool setup.
- `internal/domain`: entities, typed enum constants, interfaces, and application errors.
- `internal/usecase`: business rules and atomic transactions.
- `internal/repository`: GORM queries and persistence implementations.
- `internal/delivery/http`: HTTP binding, authentication middleware, handlers, and response envelopes.
- `pkg/logger`: shared logger factory.

## Authentication

- Dashboard users receive short-lived JWT access tokens.
- Refresh tokens use an httpOnly cookie.
- Database stores refresh-token hashes in `sessions`.
- Logout and user deactivation revoke sessions.
- QR Menu customers do not authenticate; table and tracking tokens identify public flows.

## Transaction Boundaries

Use database transactions for:

- Creating an order, calculating totals, and decreasing stock.
- Changing item status and recalculating aggregate order status.
- Cancelling a pending item and restoring its stock.
- Calculating a paid-item refund and updating order totals.

## Deliberately Excluded

Do not add these for MVP:

- Redis
- WebSocket or SSE
- Payment gateway SDK
- Dependency-injection framework
- Swagger code generation
- Zap or Zerolog
- Multi-tenant database model

Add them only when a measured requirement or product decision requires them.
