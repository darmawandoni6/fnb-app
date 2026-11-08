.PHONY: help install run test build up down logs reset migrate migrate-down db-check api-check run-db db-up

COMPOSE ?= podman-compose

help:
	@printf '%s\n' \
		'run        Start PostgreSQL, PostgREST, and API' \
		'up         Start PostgreSQL and PostgREST' \
		'run-db     Start PostgreSQL container only via podman' \
		'down       Stop containers' \
		'logs       Follow container logs' \
		'reset      Delete database volume and recreate containers' \
		'migrate    Apply SQL migrations' \
		'migrate-down Roll back initial SQL migration' \
		'test       Run Go tests' \
		'build      Build API binary' \
		'db-check   Check PostgreSQL' \
		'api-check  Check API port'

run:
	$(COMPOSE) up -d db postgrest
	set -a; . ./.env; set +a; go run ./cmd/api

up:
	$(COMPOSE) up -d

run-db db-up:
	$(COMPOSE) up -d db

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

reset:
	$(COMPOSE) down -v
	$(COMPOSE) up -d

migrate:
	$(COMPOSE) exec -T db psql -U postgres -d fnb-app < migrations/000001_initial.up.sql

migrate-down:
	$(COMPOSE) exec -T db psql -U postgres -d fnb-app < migrations/000001_initial.down.sql

pull:
	$(COMPOSE) pull

test:
	go test ./...

build:
	set -a; . ./.env; set +a; go build -o bin/api ./cmd/api

db-check:
	$(COMPOSE) exec db pg_isready -U postgres -d fnb-app

api-check:
	set -a; . ./.env; set +a; curl --fail http://localhost:$$PORT/health
