# Kerjo consumer backend

The consumer API is a Go 1.23 service organized as a modular monolith using
Domain-Driven Design (DDD). Each business capability is a bounded context with
inward-pointing dependencies.

## Directory structure

```text
backend/
├── cmd/
│   ├── api/                    # API composition root
│   ├── migrate/                # PostgreSQL migration command
│   └── migrate-legacy/         # One-time legacy Mongo/FerretDB import
├── internal/
│   ├── identity/               # Login, users, and consumer sessions
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/postgres/
│   ├── verification/           # Phone, KTP, face photo, approval state
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/postgres/
│   ├── marketplace/            # Worker profiles, jobs, browse filters
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/postgres/
│   ├── matching/               # Swipes, reciprocal matches, history
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/postgres/
│   ├── conversation/           # Messages, schedules, chat authorization
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/postgres/
│   ├── transport/httpapi/      # Inbound HTTP adapter and JSON mapping
│   ├── platform/               # Config, DB, logging, HTTP, IDs, storage
│   ├── bootstrap/              # Idempotent local/demo seed data
│   └── architecture/           # Automated dependency-direction tests
└── migrations/                 # Versioned SQL; sole schema source of truth
```

## Layer responsibilities

- `domain`: business vocabulary, entities, value data, and domain errors. It
  must not import application, infrastructure, transport, or platform code.
- `application`: use cases and outbound repository ports. It coordinates
  domain behavior without knowing GORM, PostgreSQL, HTTP, or local storage.
- `infrastructure`: outbound adapters that implement application ports.
- `transport/httpapi`: inbound adapter that authenticates requests, maps JSON
  to use-case inputs, and maps errors to HTTP responses.
- `platform`: technical capabilities shared by adapters, not business rules.
- `cmd`: composition roots. Concrete dependencies are wired only here.

The dependency direction is:

```text
HTTP -> application -> domain
                ^
                |
PostgreSQL adapter
```

`internal/architecture/dependency_test.go` enforces these rules during
`go test ./...`.

## Bounded contexts

### Identity

Owns consumer authentication and sessions. Google OIDC claims are accepted by
the application service; token verification itself is configured by the API
composition root.

### Verification

Owns verification state and private document metadata. Verification files are
stored through the storage adapter and never exposed as public marketplace
media.

### Marketplace

Owns worker profiles, job postings, browsing, filters, and relevance ordering.
Browsing jobs requires a complete worker profile; browsing workers requires an
active owned job.

### Matching

Owns swipe decisions and match creation. It repeats prerequisite checks at the
write boundary so clients cannot bypass browse gating by calling `/api/swipe`
directly.

### Conversation

Owns chat messages, read state, and scheduling. It consumes verification state
through an application-facing contract before allowing chat operations.

## Adding a feature

1. Put business types and invariant errors in the owning context's `domain`.
2. Add the use case and a minimal outbound port in `application`.
3. Implement the port in `infrastructure/postgres` or another adapter.
4. Expose the use case through `transport/httpapi`.
5. Wire concrete adapters in `cmd/api/main.go`.
6. Add domain/application unit tests and adapter integration tests.

Do not import a PostgreSQL repository from a handler or put HTTP types in a
domain package.

## Run and test

From the repository root:

```sh
docker compose up -d postgres
```

Then:

```sh
cd backend
export DATABASE_URL='postgres://kerjo:kerjo_local@localhost:5433/kerjo?sslmode=disable'
go run ./cmd/migrate up
go run ./cmd/api
```

Quality checks:

```sh
go test ./...
go vet ./...
```

For PostgreSQL-backed tests:

```sh
docker compose exec postgres createdb -U kerjo kerjo_test || true
TEST_DATABASE_URL='postgres://kerjo:kerjo_local@localhost:5433/kerjo_test?sslmode=disable' \
  go test ./...
```

See the repository root `README.md` for complete environment variables,
Google OAuth setup, Docker Compose, frontend startup, and CMS operations.
