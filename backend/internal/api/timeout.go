package api

import (
	"context"
	"net/http"
	"time"

	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
)

// responseStateWriter prevents the timeout middleware from sending a second
// status after a handler has already started its response.
type responseStateWriter struct {
	http.ResponseWriter
	wroteHeader bool
}

func (w *responseStateWriter) WriteHeader(status int) {
	if w.wroteHeader {
		return
	}
	w.wroteHeader = true
	w.ResponseWriter.WriteHeader(status)
}

func (w *responseStateWriter) Write(body []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(body)
}

func (w *responseStateWriter) Flush() {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	_ = http.NewResponseController(w.ResponseWriter).Flush()
}

func (w *responseStateWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

func requestTimeout(timeout time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Realtime is a streaming response and backups already enforce their
			// own five-minute deadline. A global 30-second deadline would cut both
			// off even though they are operating normally.
			if r.URL.Path == "/api/v1/realtime" ||
				(r.Method == http.MethodPost && (r.URL.Path == "/api/v1/backups" || r.URL.Path == "/api/v1/cron/backups")) {
				next.ServeHTTP(w, r)
				return
			}
			ctx, cancel := context.WithTimeout(r.Context(), timeout)
			defer cancel()

			state := &responseStateWriter{ResponseWriter: w}
			next.ServeHTTP(state, r.WithContext(ctx))
			if ctx.Err() == context.DeadlineExceeded && !state.wroteHeader {
				httpx.Error(state, http.StatusGatewayTimeout, "REQUEST_TIMEOUT", "Waktu pemrosesan permintaan habis")
			}
		})
	}
}
