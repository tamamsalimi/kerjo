FROM golang:1.23-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/kerjo-cms-api ./cmd/api && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/kerjo-cms-admin ./cmd/admin

FROM alpine:3.22

RUN apk add --no-cache ca-certificates && \
    addgroup -S kerjo && adduser -S -G kerjo -u 10001 kerjo
WORKDIR /app
RUN mkdir -p /data/uploads && chown -R kerjo:kerjo /data
COPY --from=build /out/kerjo-cms-api /out/kerjo-cms-admin /usr/local/bin/
USER kerjo
EXPOSE 8001
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8001/health/ready >/dev/null || exit 1
CMD ["kerjo-cms-api"]
