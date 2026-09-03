package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ipnu-ippnu/laci/backend/internal/identity"
)

func TestMobileLoginRejectsUnconfiguredRedirectWithoutRedirecting(t *testing.T) {
	t.Parallel()
	application := &API{auth: &identity.Authenticator{}}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/auth/mobile/login?redirect_uri=https://attacker.example/callback", nil)
	recorder := httptest.NewRecorder()
	application.mobileLogin(recorder, request)
	if recorder.Code != http.StatusServiceUnavailable || recorder.Header().Get("Location") != "" {
		t.Fatalf("unexpected disabled mobile auth response: status=%d location=%q", recorder.Code, recorder.Header().Get("Location"))
	}
	if recorder.Header().Get("Cache-Control") != "no-store" || recorder.Header().Get("Referrer-Policy") != "no-referrer" {
		t.Fatal("mobile login response must not be cached or used as a referrer")
	}
}

func TestMobileExchangeRejectsInvalidGrantBeforeDatabaseAccess(t *testing.T) {
	t.Parallel()
	application := &API{auth: &identity.Authenticator{}}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/mobile/exchange", strings.NewReader(`{"code":"invalid","codeVerifier":"invalid","redirectUri":"lacidigital://oauth/callback"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	application.mobileExchange(recorder, request)
	if recorder.Code != http.StatusBadRequest || !strings.Contains(recorder.Body.String(), "INVALID_GRANT") {
		t.Fatalf("unexpected invalid grant response: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if recorder.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("mobile exchange response must not be cached")
	}
}

func TestMobileLogoutIsIdempotentWithoutBearer(t *testing.T) {
	t.Parallel()
	application := &API{auth: &identity.Authenticator{}}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/mobile/logout", nil)
	recorder := httptest.NewRecorder()
	application.mobileLogout(recorder, request)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected idempotent 204 logout, got %d", recorder.Code)
	}
}
