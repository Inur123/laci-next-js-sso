.PHONY: test build frontend backend mobile-test mobile-apk

test:
	cd backend && go test ./... && go vet ./...
	cd frontend && npm run lint && npm run typecheck
	cd mobile && flutter analyze && flutter test

build:
	cd backend && go build -o /tmp/laci-api ./cmd/api
	cd frontend && npm run build

backend:
	cd backend && go run ./cmd/api

frontend:
	cd frontend && npm run dev

mobile-test:
	cd mobile && flutter analyze && flutter test

mobile-apk:
	cd mobile && flutter build apk --release
