package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/ipnu-ippnu/laci/backend/internal/api"
	"github.com/ipnu-ippnu/laci/backend/internal/config"
	"github.com/ipnu-ippnu/laci/backend/internal/cryptox"
	"github.com/ipnu-ippnu/laci/backend/internal/database"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
	"github.com/ipnu-ippnu/laci/backend/internal/mailer"
	"github.com/ipnu-ippnu/laci/backend/internal/realtime"
	"github.com/ipnu-ippnu/laci/backend/internal/storage"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("configuration failed", "error", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	pool, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	crypto, err := cryptox.New(cfg.EncryptionKey)
	if err != nil {
		slog.Error("crypto failed", "error", err)
		os.Exit(1)
	}
	auth, err := identity.New(ctx, cfg, pool)
	if err != nil {
		slog.Error("SSO initialization failed", "error", err)
		os.Exit(1)
	}
	objects, err := storage.New(ctx, cfg)
	if err != nil {
		slog.Error("R2 initialization failed", "error", err)
		os.Exit(1)
	}
	mail := mailer.New(cfg, pool)
	hub := realtime.New()
	hub.Listen(ctx, pool)
	server := &http.Server{Addr: cfg.HTTPAddr, Handler: api.New(cfg, pool, auth, crypto, objects, mail, hub).Router(), ReadHeaderTimeout: 10_000_000_000}
	go func() {
		slog.Info("Laci API listening", "address", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server stopped", "error", err)
			stop()
		}
	}()
	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	_ = server.Shutdown(shutdown)
}
