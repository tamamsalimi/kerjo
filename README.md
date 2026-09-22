# kerjo.id

kerjo.id is an Expo/React Native job-matching app with Go services and
PostgreSQL storage. Every account can act as both a worker and an employer
without selecting a permanent role. Jelajah has separate `Lowongan` and
`Pekerja` feeds: a complete worker profile unlocks job swiping, while an active
job posting unlocks worker swiping.

## Run locally

### Prerequisites

- Docker Desktop, OrbStack, or Colima with Docker Compose
- Node.js 20 or newer with Corepack
- A Google OAuth Web Client ID for sign-in
- Go 1.23 or newer only when running the backend outside Docker

### 1. Configure Google sign-in

Create `.env` in the repository root:

```dotenv
GOOGLE_CLIENT_IDS=your-web-client-id.apps.googleusercontent.com
```

Create `frontend/.env`:

```dotenv
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

In Google Cloud Console, configure the Web OAuth client with:

- Authorized JavaScript origin: `http://localhost:8081`
- Authorized redirect URI: `http://localhost:8081/`

The backend can start without a client ID, but Google sign-in remains disabled.
Never place a Google client secret in the frontend.

### 2. Start PostgreSQL and the API

If you use Colima on macOS, start it first:

```sh
colima start
```

Then start all backend services:

```sh
docker compose up -d --build
```

This starts:

- Go API: `http://localhost:8000`
- CMS web app: `http://localhost:5173`
- CMS API: `http://localhost:8001`
- PostgreSQL: `localhost:5433`
- one-shot schema migration and idempotent seed job

The API connects directly to PostgreSQL through GORM. Application records are
stored in the persistent `kerjo_postgres_data_v2` volume. Uploaded profile
photos use the `kerjo_upload_data` volume.

Verify the API:

```sh
curl http://localhost:8000/api/
```

Expected response:

```json
{"message":"kerjo.id API"}
```

### 3. Create the first CMS administrator

The CMS uses dedicated password accounts and does not share consumer Google
sign-in. Create the first account through the interactive CLI:

```sh
docker compose run --rm -it cms-backend kerjo-cms-admin
```

Choose `[1] create`, then enter the email, a password of at least 12 characters,
and one of these roles:

- `superadmin`: all operations, audit logs, and history cleanup
- `moderator`: user and marketplace moderation
- `reviewer`: identity verification review

Open `http://localhost:5173` and sign in with that account. Passwords and
session tokens are stored only as hashes. CMS activity is recorded in the
admin audit log.

### 4. Start the Expo frontend

In another terminal:

```sh
cd frontend
corepack yarn install
corepack yarn web --port 8081
```

Open `http://localhost:8081`.

After Google sign-in, the user lands directly in the app. Every account can
use both sides of the marketplace. Complete `Profil Kerja` to swipe Lowongan,
or post an active Lowongan to swipe Pekerja.

### 5. Stop the app

Stop the frontend with `Ctrl+C`, then stop backend services:

```sh
docker compose down
```

Local PostgreSQL data and uploads are preserved. To delete all local application
data and start clean:

```sh
docker compose down -v
```

### 6. Testing-only access from another device

This is for local testing only. It does not change production OAuth, CMS,
Postgres exposure, or Metro. `APP_ENV` stays `development`.

Phones cannot use `http://192.168.x.x:8081` for Google sign-in because WebCrypto
requires localhost or HTTPS. The testing stack therefore uses one HTTPS origin
for both the Expo web app and `/api`.

1. Copy `dev/multi-device.env.example` to `dev/multi-device.env`.
2. Set `NGROK_DOMAIN` to your reserved ngrok hostname, without `https://`.
3. Keep `NGROK_AUTHTOKEN` in that local file if the CLI is not already
   authenticated. Do not commit it.
4. Add these values to a **development / testing** Google OAuth Web client only:

   - Authorized JavaScript origin: `https://<your-ngrok-domain>`
   - Authorized redirect URI: `https://<your-ngrok-domain>/`

   Leave the existing localhost origin (`http://localhost:8081`) in place for
   laptop testing. Do not add these hosts to a production OAuth client.

5. Start everything with one command:

```sh
chmod +x dev/start-multi-device.sh dev/stop-multi-device.sh
./dev/start-multi-device.sh
```

The launcher starts PostgreSQL, migrations, the API, the local same-origin
gateway on `http://localhost:8090`, Expo on `8081`, and ngrok to the gateway.
It sets `EXPO_PUBLIC_BACKEND_URL=https://<your-ngrok-domain>` for that session
only so phones call `/api` on the same HTTPS origin.

Open `https://<your-ngrok-domain>` on the phone. CMS stays on
`http://localhost:5173` and is not published through the tunnel.

Stop everything with:

```sh
./dev/stop-multi-device.sh
```

## Useful development commands

Rebuild and restart the backend:

```sh
docker compose up -d --build backend cms-backend cms-frontend
```

View service status and logs:

```sh
docker compose ps
docker compose logs -f backend
docker compose logs -f cms-backend cms-frontend
```

Restart Expo with a cleared Metro cache:

```sh
cd frontend
corepack yarn web --port 8081 --clear
```

Run frontend lint:

```sh
cd frontend
corepack yarn lint
```

Run CMS checks:

```sh
cd cms
npm ci
npm run lint
npm run test
npm run build
```

Run both backend modules' tests and static checks:

```sh
cd backend
go test ./...
go vet ./...

cd ../cms-backend
go test ./...
go vet ./...
```

Run the PostgreSQL-backed integration test:

```sh
docker compose exec postgres createdb -U kerjo kerjo_test || true
cd backend
TEST_DATABASE_URL='postgres://kerjo:kerjo_local@localhost:5433/kerjo_test?sslmode=disable' \
  go test ./...
```

## Run the backend without Docker

Keep PostgreSQL running:

```sh
docker compose up -d postgres
```

Apply migrations and seed data, then run the API:

```sh
cd backend
export DATABASE_URL='postgres://kerjo:kerjo_local@localhost:5433/kerjo?sslmode=disable'
go run ./cmd/migrate up
GOOGLE_CLIENT_IDS='your-web-client-id.apps.googleusercontent.com' \
  go run ./cmd/api
```

Optional backend variables:

- `APP_ENV`: runtime environment, default `development`
- `STORAGE_DIR`: uploaded-photo directory, default `data/uploads`
- `PORT`: HTTP port, default `8000`
- `ADDR`: complete listen address, for example `127.0.0.1:8000`
- `CORS_ALLOWED_ORIGINS`: comma-separated browser origins
- `LOG_LEVEL`: `debug`, `info`, `warn`, or `error`
- `DB_MAX_OPEN_CONNS`, `DB_MAX_IDLE_CONNS`, and
  `DB_CONN_MAX_LIFETIME`: PostgreSQL pool settings

Run the CMS services directly:

```sh
cd cms-backend
CMS_DATABASE_URL='postgres://kerjo:kerjo_local@localhost:5433/kerjo?sslmode=disable' \
  go run ./cmd/admin

CMS_DATABASE_URL='postgres://kerjo:kerjo_local@localhost:5433/kerjo?sslmode=disable' \
CMS_CORS_ALLOWED_ORIGINS='http://localhost:5173' \
  go run ./cmd/api

cd ../cms
npm ci
npm run dev
```

CMS backend variables:

- `CMS_DATABASE_URL`: shared PostgreSQL connection string, required
- `CMS_APP_ENV`: runtime environment, default `development`
- `CMS_PORT` or `CMS_ADDR`: listen port/address, default `8001`
- `CMS_STORAGE_DIR`: read-only verification-document directory
- `CMS_CORS_ALLOWED_ORIGINS`: comma-separated CMS browser origins
- `CMS_SESSION_TTL`: admin session duration; code default `12h`, local Compose default `8h`
- `CMS_COOKIE_SECURE`: set `true` behind production HTTPS
- `CMS_LOG_LEVEL`: `debug`, `info`, `warn`, or `error`

## Legacy FerretDB migration

The normal runtime does not start FerretDB. Existing data can be migrated once
from the retained legacy volume with the migration profile:

```sh
docker compose --profile migration up -d postgres legacy-postgres ferretdb
docker compose --profile migration run --rm migrate-legacy
docker compose --profile migration stop ferretdb legacy-postgres
docker compose up -d backend
```

The migration hashes legacy bearer tokens before storage, preserves public IDs
and timestamps, is safe to rerun, compares collection/table counts, and checks
for orphaned relationships. Take a volume backup before production cutover.

## CMS operations

Use the CMS instead of direct PostgreSQL access for identity review, account
suspension, session revocation, job/review moderation, match and message
metadata, audit logs, and activity-history cleanup. Verification photos are
served only to authenticated CMS sessions with `Cache-Control: no-store`.
Message text and schedule notes are intentionally excluded from CMS responses.

History cleanup requires a superadmin to generate a preview and type the exact
confirmation phrase returned by the server. Every privileged PII read and
mutation is audited; passwords, session tokens, NIK values, document contents,
message text, and schedule notes are never written to logs.

## Backend architecture

Both Go services use DDD with inward-pointing dependencies:

```text
transport / CLI -> application -> domain
                               ^
                               |
                         infrastructure
```

The consumer backend is a modular monolith with `identity`, `verification`,
`marketplace`, `matching`, and `conversation` bounded contexts. Every context
keeps domain models, application use cases/ports, and PostgreSQL adapters in
separate packages. Architecture tests fail if an inner layer imports an outer
adapter.

See:

- [`backend/README.md`](backend/README.md) for the consumer bounded contexts,
  directory tree, dependency rules, and feature workflow.
- [`cms-backend/README.md`](cms-backend/README.md) for CMS administration,
  moderation use cases, and schema ownership.

Consumer backend entry points are under `backend/cmd/`:

- `api`: production HTTP API
- `migrate`: versioned SQL migrations and idempotent demo seeds
- `migrate-legacy`: one-time DocumentDB/FerretDB import

The independently built CMS API and administrator CLI live in `cms-backend/`.
Both services share PostgreSQL, but the consumer backend migration command is
the sole schema owner, including CMS migration
`backend/migrations/000005_ops_cms.up.sql`. Neither API uses GORM
`AutoMigrate`.

## Native Expo development

Create Android and iOS OAuth clients in Google Cloud, then configure
`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in
`frontend/.env`. Add every accepted client ID to the root `GOOGLE_CLIENT_IDS`
value, separated by commas.

Start a native target:

```sh
cd frontend
corepack yarn ios
# or
corepack yarn android
```
