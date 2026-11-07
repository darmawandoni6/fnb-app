# fnb-server Structure

## Standard Layout

```text
fnb-server/
├── cmd/
│   ├── api/main.go                 # REST API entry point and dependency wiring
│   └── worker/main.go              # Optional Kafka worker entry point
├── internal/
│   ├── config/config.go            # Environment configuration
│   ├── database/database.go        # GORM PostgreSQL connection and pool
│   ├── domain/                     # Business entities, events, repository interfaces
│   ├── repository/                 # Database implementations
│   ├── usecase/                    # Business rules
│   └── delivery/
│       ├── http/                   # HTTP handlers and router
│       └── kafka/                  # Kafka event consumers; thin adapters
├── pkg/                            # Reusable public helpers
│   ├── kafka/                      # Kafka transport wrapper
│   └── logger/                     # Logging helper
├── migrations/                     # Versioned database schema changes
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

`domain` stays independent. `cmd` performs wiring. No dependency injection framework.

## Package Rules

1. `cmd/*` contains startup and wiring only. No business logic.
2. `internal/config` reads and validates environment values. It does not open connections.
3. `internal/database` creates GORM connections and configures pools. It does not read environment variables.
4. `internal/domain` contains entities, event payloads, and interfaces. It must not import delivery, repository, or framework packages.
5. `internal/repository` implements domain repository interfaces and owns GORM queries.
6. `internal/usecase` owns business rules. It depends on interfaces, not concrete repositories or GORM.
7. `internal/delivery/http` translates HTTP requests and responses. Keep handlers thin.
8. `internal/delivery/kafka` decodes messages and calls usecases. Keep consumers thin.
9. `pkg` contains reusable code with a stable API. App-specific code belongs under `internal`.
10. `migrations` contains versioned schema changes. `docker/postgres/init.sql` contains bootstrap roles only.
11. Secrets stay in `.env`; commit `.env.example`, never `.env`.
12. New packages need a clear owner. Do not create folders for hypothetical future code.
13. Use interfaces at dependency boundaries. Do not add interfaces with one implementation unless mocking or inversion needs them.
14. Every non-trivial business rule gets one focused test.
15. Keep external framework details at outer layers.

## Naming Rules

- Files use `snake_case.go`.
- Package names use short lowercase names.
- Interfaces describe behavior: `UserRepository`, not `UserRepositoryInterface`.
- Constructors use `NewThing`.
- Context is the first method argument after the receiver.
- Errors add operation context with `%w`.

## API Responses

HTTP response format and Echo error handling are defined in [`api-response.md`](api-response.md). Every handler follows that document.

Shared-value constants are defined in [`constants.md`](constants.md). Avoid repeated literals for stable application values.

Commit and push workflow is defined in [`git.md`](git.md). Follow it manually before repository changes.

Logging behavior is defined in [`logging.md`](logging.md). Use one injected structured logger per process.

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
