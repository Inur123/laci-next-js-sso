package realtime

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Hub struct {
	mu      sync.RWMutex
	clients map[chan []byte]struct{}
}

func New() *Hub { return &Hub{clients: map[chan []byte]struct{}{}} }
func (h *Hub) Publish(value any) {
	data, _ := json.Marshal(value)
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		select {
		case c <- data:
		default:
		}
	}
}

func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", 500)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	c := make(chan []byte, 32)
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
	defer func() { h.mu.Lock(); delete(h.clients, c); h.mu.Unlock(); close(c) }()
	_, _ = fmt.Fprint(w, "event: connected\ndata: {}\n\n")
	flusher.Flush()
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case msg := <-c:
			_, _ = fmt.Fprintf(w, "event: update\ndata: %s\n\n", msg)
			flusher.Flush()
		case <-ticker.C:
			_, _ = fmt.Fprint(w, ": heartbeat\n\n")
			flusher.Flush()
		}
	}
}

func (h *Hub) Listen(ctx context.Context, pool *pgxpool.Pool) {
	go func() {
		for ctx.Err() == nil {
			conn, err := pool.Acquire(ctx)
			if err != nil {
				time.Sleep(time.Second)
				continue
			}
			_, err = conn.Exec(ctx, "LISTEN laci_realtime")
			if err == nil {
				for ctx.Err() == nil {
					n, err := conn.Conn().WaitForNotification(ctx)
					if err != nil {
						break
					}
					h.Publish(json.RawMessage(n.Payload))
				}
			}
			conn.Release()
			if ctx.Err() == nil {
				time.Sleep(time.Second)
			}
		}
	}()
}
