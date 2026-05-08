SHELL := /usr/bin/env bash
COMPOSE := docker compose -f docker-compose.yml
COMPOSE_DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml
ENV_FILE := .env

.PHONY: help setup up down logs migrate backup restore status test e2e dev shell-api psql

help:
	@echo "tokenboard — infra commands"
	@echo ""
	@echo "  make setup        Bootstrap: copy .env.example → .env if missing"
	@echo "  make up           Start the stack in production mode (detached)"
	@echo "  make down         Stop the stack"
	@echo "  make logs [s=…]   Tail logs for all services (or one)"
	@echo "  make migrate      Run database migrations"
	@echo "  make backup       Dump postgres to ./backups/YYYY-MM-DD_HHMM.sql.gz"
	@echo "  make restore F=…  Restore from backup file"
	@echo "  make status       docker compose ps"
	@echo "  make psql         Open a psql shell against the running db"
	@echo "  make shell-api    Open a shell in the api container"
	@echo "  make dev          Start the dev stack with hot reload"
	@echo "  make test         Run all unit tests on host"
	@echo "  make e2e          Run e2e Playwright tests against the dev stack"

setup:
	@if [ ! -f $(ENV_FILE) ]; then \
		cp .env.example $(ENV_FILE); \
		echo "Created $(ENV_FILE) — edit it before running 'make up'."; \
	else \
		echo "$(ENV_FILE) already exists; not overwriting."; \
	fi
	@mkdir -p certs backups

up:
	$(COMPOSE) --env-file $(ENV_FILE) up -d
	@echo "Stack starting. View with: make logs"

down:
	$(COMPOSE) --env-file $(ENV_FILE) down

logs:
ifdef s
	$(COMPOSE) --env-file $(ENV_FILE) logs -f $(s)
else
	$(COMPOSE) --env-file $(ENV_FILE) logs -f
endif

migrate:
	$(COMPOSE) --env-file $(ENV_FILE) exec api npm --workspace apps/api run migrate

backup:
	@mkdir -p backups
	@TS=$$(date +%Y-%m-%d_%H%M); \
	$(COMPOSE) --env-file $(ENV_FILE) exec -T db \
		pg_dump -U $${DB_USER:-tokenboard} $${DB_NAME:-tokenboard} | gzip > backups/$$TS.sql.gz; \
	echo "Wrote backups/$$TS.sql.gz"

restore:
	@if [ -z "$(F)" ]; then echo "Usage: make restore F=backups/2026-05-07_1200.sql.gz"; exit 1; fi
	gunzip -c $(F) | $(COMPOSE) --env-file $(ENV_FILE) exec -T db \
		psql -U $${DB_USER:-tokenboard} $${DB_NAME:-tokenboard}

status:
	$(COMPOSE) --env-file $(ENV_FILE) ps

psql:
	$(COMPOSE) --env-file $(ENV_FILE) exec db \
		psql -U $${DB_USER:-tokenboard} $${DB_NAME:-tokenboard}

shell-api:
	$(COMPOSE) --env-file $(ENV_FILE) exec api sh

dev:
	$(COMPOSE_DEV) --env-file $(ENV_FILE) up

test:
	cd .. && npm test

e2e:
	cd .. && npm --workspace apps/dashboard run e2e
