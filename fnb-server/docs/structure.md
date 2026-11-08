# fnb-server Structure

## Standard Layout

```text
fnb-server/
├── cmd/
│   ├── api/main.go                 # Process bootstrap: config, logger, DB, start
│   ├── api/wiring.go               # Dependency construction, one function per feature
│   └── worker/main.go              # Optional Kafka worker entry point
├── internal/
│   ├── config/config.go            # Environment configuration
│   ├── database/database.go        # GORM PostgreSQL connection and pool
│   ├── domain/                     # Business entities, events, repository interfaces
│   ├── repository/                 # Database implementations
│   ├── usecase/                    # Business rules
│   └── delivery/
│       ├── http/                   # HTTP handlers, router, and middleware
│       │   ├── router.go           # Echo setup, middleware, and route registration
│       │   ├── *_middleware.go     # HTTP middleware by feature
│       │   └── dto/                # HTTP request and response DTOs by feature
│       └── kafka/                  # Kafka event consumers; thin adapters
├── pkg/                            # Reusable public helpers
│   ├── kafka/                      # Kafka transport wrapper
│   └── logger/                     # Logging helper
├── migrations/                     # Versioned SQL schema changes (*.up.sql, *.down.sql)
├── docker/postgres/init.sql        # One-time PostgreSQL roles and grants
├── docker-compose.yml              # PostgreSQL and PostgREST
├── .env.example                    # Local configuration template
├── Makefile                        # Standard local commands (podman-compose)
├── README.md                       # Setup and run instructions
├── go.mod
└── go.sum
```

## Dependency Direction

```text
delivery → usecase → repository → domain
                 └──→ domain
 database → config
 cmd      → all required application packages
```

`domain` stays independent. `cmd` performs wiring. Repositories and usecases are constructed in `cmd`, never inside `internal/delivery`. No dependency injection framework.

## Package Rules

1. `cmd/*` contains startup and wiring only. No business logic or route registration. Per-feature wiring lives in `cmd/api/wiring.go`.
2. `internal/config` reads and validates environment values. It does not open connections.
3. `internal/database` creates GORM connections and configures pools. It does not read environment variables.
4. `internal/domain` contains entities, event payloads, and interfaces. It must not import delivery, repository, or framework packages.
5. `internal/repository` implements domain repository interfaces and owns GORM queries.
6. `internal/usecase` owns business rules. It depends on interfaces, not concrete repositories or GORM.
7. `internal/delivery/http` translates HTTP requests and responses. Keep handlers thin.
8. `internal/delivery/http/router.go` creates Echo, configures HTTP behavior and middleware, and registers routes.
9. `internal/delivery/http/dto` owns HTTP transport DTOs. Keep DTOs separate from domain entities.
10. HTTP middleware stays as feature-named files in `internal/delivery/http`; do not create a middleware subpackage until middleware is shared across transports.
11. `internal/delivery/kafka` decodes messages and calls usecases. Keep consumers thin.
12. `pkg` contains reusable code with a stable API. App-specific code belongs under `internal`.
13. `migrations` contains versioned schema changes. `docker/postgres/init.sql` contains bootstrap roles only.
14. Secrets stay in `.env`; commit `.env.example`, never `.env`.
15. New packages need a clear owner. Do not create folders for hypothetical future code.
16. Use interfaces at dependency boundaries. Do not add interfaces with one implementation unless mocking or inversion needs them.
17. Every non-trivial business rule gets one focused test.
18. Keep external framework details at outer layers.

## Wiring Rules

1. `cmd/api/main.go` contains process bootstrap only: config, logger, database, router start.
2. Per-feature constructors live in `cmd/api/wiring.go` (`newAuthHandler`, `newPublicHandler`, `newOrderHandler`) and are assembled into `newRouter`.
3. Adding a new feature only updates `wiring.go`; `main.go` remains untouched at ~25 lines.
4. Wiring functions take required infrastructure dependencies, such as `*gorm.DB` and `*config.Config`. They return handlers, not repos or usecases.
5. Never construct repositories or usecases inside `internal/delivery/http`. The router receives handlers.
6. Split `wiring.go` into `wiring_<feature>.go` files in the same package when it exceeds ~150 lines.
7. No DI container or DI framework. Explicit constructor calls only.

## Naming Rules

- Files use `snake_case.go`.
- Package names use short lowercase names.
- Interfaces describe behavior: `UserRepository`, not `UserRepositoryInterface`.
- Constructors use `NewThing`.
- Context is the first method argument after the receiver.
- Errors add operation context with `%w`.
- DTO types are exported; group them by feature in `internal/delivery/http/dto/<feature>.go`.

## DTO Rules

- Request and response DTOs belong to `internal/delivery/http/dto`.
- Use one DTO file per feature, such as `auth.go` and `health.go`.
- Request DTOs use `validate` tags and bind through `http.Binder`.
- Response DTOs use typed structs, not `map[string]interface{}` or `map[string]string`.
- DTOs describe transport JSON; they are not domain entities.
- DTOs may import `domain` for response data, but must not import usecase or repository packages.
- Keep handler files focused on HTTP translation and orchestration.

## API Responses

HTTP response format and Echo error handling are defined in [`api-response.md`](api-response.md). Every handler follows that document.

Application execution flows are defined in [`flow.md`](flow.md). API draft and future Bruno collection source are defined in [`api.md`](api.md).

Shared-value constants are defined in [`constants.md`](constants.md). Avoid repeated literals for stable application values.

Commit and push workflow is defined in [`git.md`](git.md). Follow it manually before repository changes.

Logging behavior is defined in [`logging.md`](logging.md). Use one injected structured logger per process.

Request validation is defined in [`validation.md`](validation.md). Validate at delivery boundary; keep business rules in usecases.

## Request Flow

```text
HTTP/Kafka
   ↓
delivery adapter
   ↓
usecase
   ↓
domain repository interface
   ↓
repository implementation
   ↓
GORM/PostgreSQL
```
