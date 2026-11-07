# fnb-server

## Requirements

- Go
- Podman
- Podman Compose support: `podman compose` or `podman-compose`

## Run with Podman

Default Makefile command uses standalone `podman-compose`:

```bash
make up
make run
```

`make run` starts PostgreSQL and PostgREST, loads `.env`, then starts Go API.

If system only provides Podman Compose through Docker Compose compatibility:

```bash
make up COMPOSE="podman compose"
make run COMPOSE="podman compose"
```

That mode requires a running Podman API socket. Standalone `podman-compose` avoids Docker Compose trying to connect to a Docker socket.

Useful commands:

```bash
make down
make logs
make reset
make db-check
make test
make build
```

Services:

```text
API:        http://localhost:8081
PostgREST:  http://localhost:3000
PostgreSQL: localhost:5433

Health check: `http://localhost:8081/health`
```

`.env` is local-only and ignored by Git. Copy `.env.example` when creating a new environment.
