package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRequestTimeoutDoesNotOverwriteStartedResponse(t *testing.T) {
	handler := requestTimeout(time.Millisecond)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
		<-r.Context().Done()
	}))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("started response was overwritten with status %d", recorder.Code)
	}
}

func TestRequestTimeoutReturnsGatewayTimeoutBeforeResponseStarts(t *testing.T) {
	handler := requestTimeout(time.Millisecond)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
	if recorder.Code != http.StatusGatewayTimeout {
		t.Fatalf("expected status 504, got %d", recorder.Code)
	}
}

func TestRequestTimeoutSkipsRealtimeStream(t *testing.T) {
	handler := requestTimeout(time.Millisecond)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, hasDeadline := r.Context().Deadline(); hasDeadline {
			t.Fatal("realtime stream must not receive the global request deadline")
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/realtime", nil))
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d", recorder.Code)
	}
}
