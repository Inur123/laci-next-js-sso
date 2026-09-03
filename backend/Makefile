.PHONY: fmt test build run vet

fmt:
	gofmt -w ./cmd ./internal

test:
	go test ./...

vet:
	go vet ./...

build:
	go build -o bin/laci-api ./cmd/api

run:
	go run ./cmd/api
