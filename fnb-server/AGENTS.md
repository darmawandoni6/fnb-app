# AGENTS

## Read first

Canonical checklist: `docs/rules.md`. It links to sibling docs in `docs/`:
structure, rules, api-response, constants, git, logging, validation, flow,
api, and tech-stack. Read the
relevant doc before adding code. The checklist gates every commit.

## Commands

- `make run` — starts Postgres + PostgREST via `podman-compose`, loads `.env`, runs API on `:8081`
- `make test` — `go test ./...`
- `make build` — builds `bin/api`
- `make db-check` / `make api-check` — probes DB and `GET /health`
- Single test: `go test ./internal/delivery/http/ -run TestName`

Verification order before commit: `go test ./... && go build ./...`

## Environment gotchas

- Runtime is Podman. Makefile uses `COMPOSE ?= podman-compose`. Do not change to `docker compose`; `podman compose` resolves to the Docker CLI plugin and fails without a Docker socket.
- `.env` must quote `DATABASE_URL` — DSN contains spaces. Unquoted, the shell splits it and Go falls back to the OS user with empty dbname.
- Ports: API `8081`, Postgres `5433`, PostgREST `3000`. `8080`/`5432` may be occupied by other local projects. If free, prefer defaults from `.env.example` and update this file.
- `docker/postgres/init.sql` runs only on first volume creation. Role changes need `make reset`, which deletes DB data — confirm first.
- `.env` is gitignored. Never commit it, `bin/`, credentials, or tokens.

## Architecture

- Entrypoint: `cmd/api/main.go` only — wiring: config → database → logger → echo. No business logic in `cmd`.
- Dependency direction: `delivery → usecase → repository → domain`. `domain` imports nothing from other internal packages.
- Every Echo instance must set both `e.Binder = httpDelivery.NewBinder()` and `e.HTTPErrorHandler = httpDelivery.ErrorHandler(cfg.IsDevelopment(), log)`.
- Responses: envelope `{success, data}` / `{success, error{code, message}}`. Success only via `httpDelivery.Success`; errors via `domain.NewError` with codes from `internal/domain/error_codes.go`. Details: `docs/api-response.md`.
- Validation: `validate` struct tags + custom binder at delivery boundary. Business rules stay in usecases. Details: `docs/validation.md`.
- Logging: one injected `*slog.Logger` created in main (`pkg/logger`). No `fmt.Print*`, no package `log`. Production logs JSON to stderr. Details: `docs/logging.md`.
- Packages planned in `docs/structure.md` but not yet created (`repository`, `usecase`, `delivery/kafka`, `migrations`). Create only when real code lands.

## Git

- Conventional Commits: `type(scope): summary`. Checklist: `docs/git.md`.
- Always propose the commit message, show checklist result, and wait for user confirmation before committing or pushing. Never auto-commit.
- Branch `master`, remote `origin`.

## Sync

Update this file when commands, ports, dependencies, or rules change.
