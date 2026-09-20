FROM golang:1.23-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/kerjo-api ./cmd/api && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/kerjo-migrate ./cmd/migrate && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/kerjo-migrate-legacy ./cmd/migrate-legacy

FROM alpine:3.22 AS runtime-base

RUN apk add --no-cache ca-certificates && \
    addgroup -S kerjo && adduser -S -G kerjo -u 10001 kerjo
WORKDIR /app
RUN mkdir -p /data/uploads && chown -R kerjo:kerjo /data
USER kerjo

FROM runtime-base AS legacy-migration
COPY --from=build /out/kerjo-migrate-legacy /usr/local/bin/
CMD ["kerjo-migrate-legacy"]

FROM runtime-base AS runtime
COPY --from=build /out/kerjo-api /out/kerjo-migrate /usr/local/bin/
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8000/health/ready >/dev/null || exit 1
CMD ["kerjo-api"]
