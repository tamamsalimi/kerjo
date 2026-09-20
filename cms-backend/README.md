# Kerjo CMS backend

This directory is an independently built and deployed Go service for CMS
operations. It shares Kerjo's PostgreSQL database with the consumer backend,
but it does not import or copy source at build time from `backend/`.

The consumer backend's migration runner remains the only schema owner.
`backend/migrations/000005_ops_cms.up.sql` creates the CMS tables and moderation
columns. This service defines local GORM mappings and never runs AutoMigrate.

## DDD structure

```text
cms-backend/
├── cmd/
│   ├── api/                           # HTTP API composition root
│   └── admin/                         # Interactive administrator CLI
├── internal/
│   ├── ops/                           # CMS administration bounded context
│   │   ├── domain/                    # Roles, errors, cleanup model
│   │   ├── application/
│   │   │   ├── ports.go               # Outbound repository contract
│   │   │   ├── admin_usecases.go      # Accounts, login, sessions
│   │   │   ├── query_usecases.go      # Dashboard and read models
│   │   │   └── moderation_usecases.go # Review, moderation, cleanup
│   │   └── infrastructure/postgres/   # GORM and SQL adapter
│   ├── transport/adminapi/            # Inbound HTTP adapter
│   ├── platform/                      # DB, HTTP, logs, and storage
│   ├── config/                        # Runtime configuration
│   └── architecture/                  # Dependency-direction tests
└── go.mod
```

The dependency direction is:

```text
Admin API / CLI -> application -> domain
                              ^
                              |
                    PostgreSQL adapter
```

- `domain` contains CMS business vocabulary and no outer-layer imports.
- `application` contains use cases and repository ports.
- `infrastructure/postgres` implements those ports against the shared schema.
- `transport/adminapi` maps cookies, HTTP requests, and responses.
- `cmd` is the composition root.

`internal/architecture/dependency_test.go` enforces these boundaries. The
`ops` application layer is split by use case: administrator access, read
queries, and privileged moderation/cleanup.

## Commands

```sh
go test ./...
go vet ./...
go run ./cmd/api
go run ./cmd/admin
```

From the repository root, the interactive administrator CLI is:

```sh
docker compose run --rm -it cms-backend kerjo-cms-admin
```

The CLI does not create accounts automatically; administrators are only
created through an explicit interactive `create` action.

## Environment

All runtime settings are CMS-scoped:

- `CMS_DATABASE_URL` (required)
- `CMS_APP_ENV` (default `development`)
- `CMS_ADDR` or `CMS_PORT` (default `:8001`)
- `CMS_STORAGE_DIR` (default `data/uploads`, mounted read-only in Compose)
- `CMS_CORS_ALLOWED_ORIGINS` (default `http://localhost:5173`)
- `CMS_SESSION_TTL` (code default `12h`; local Compose default `8h`)
- `CMS_COOKIE_SECURE` (defaults to true in production)
- `CMS_LOG_LEVEL` (`debug`, `info`, `warn`, or `error`)

The API retains hashed password and cookie sessions, role-based authorization,
strict origin/CORS checks, login throttling, audit logging, protected
verification documents, metadata-only message/schedule views, moderation, and
typed-confirmation history cleanup.

## Adding an operation

1. Define business vocabulary or errors in `internal/ops/domain`.
2. Add the use case to the matching application file.
3. Add only the smallest required method to the repository port.
4. Implement that port in `internal/ops/infrastructure/postgres`.
5. Map the operation in `internal/transport/adminapi`.
6. Keep authorization and audit decisions in the application layer.

The CMS may read and moderate consumer-owned tables, but it does not own their
schema. Add all schema changes under `backend/migrations`.
