package identity

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"golang.org/x/oauth2"
)

func TestRandomTokenIsUniqueAndURLSafe(t *testing.T) {
	first, err := randomToken(32)
	if err != nil {
		t.Fatal(err)
	}
	second, err := randomToken(32)
	if err != nil {
		t.Fatal(err)
	}
	if first == second || len(first) != 43 || len(second) != 43 {
		t.Fatalf("unexpected secure token shape or duplicate")
	}
}

func TestCompleteLoginTreatsAccessDeniedAsCancellation(t *testing.T) {
	auth := &Authenticator{}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "http://localhost/callback?error=access_denied&error_description=User+cancelled", nil)
	_, err := auth.CompleteLogin(recorder, request)
	if !errors.Is(err, ErrAuthorizationDenied) {
		t.Fatalf("expected ErrAuthorizationDenied, got %v", err)
	}
}

func TestSessionCookieOwnedByGo(t *testing.T) {
	auth := &Authenticator{cookieName: "laci_session", cookieDomain: ".example.org", secureCookie: true}
	recorder := httptest.NewRecorder()
	auth.setSessionCookie(recorder, "opaque-session", time.Now().Add(sessionLifetime))
	cookies := recorder.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected one session cookie, got %d", len(cookies))
	}
	cookie := cookies[0]
	if cookie.Name != "laci_session" || !cookie.HttpOnly || !cookie.Secure || cookie.Domain != "example.org" || cookie.Path != "/" {
		t.Fatalf("unexpected session cookie attributes: %#v", cookie)
	}
}

func TestBeginLoginIncludesStateNonceAndPKCES256(t *testing.T) {
	auth := &Authenticator{
		oauth: oauth2.Config{
			ClientID: "client-id", RedirectURL: "http://localhost/callback",
			Scopes:   []string{"openid", "profile", "email"},
			Endpoint: oauth2.Endpoint{AuthURL: "https://sso.example.org/oauth/authorize"},
		},
		cookieName: "laci_session",
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "http://localhost/api/v1/auth/login", nil)
	if err := auth.BeginLogin(recorder, request); err != nil {
		t.Fatal(err)
	}
	response := recorder.Result()
	location, err := response.Location()
	if err != nil {
		t.Fatal(err)
	}
	query := location.Query()
	if response.StatusCode != http.StatusFound || query.Get("response_type") != "code" || query.Get("state") == "" || query.Get("nonce") == "" || query.Get("code_challenge") == "" || query.Get("code_challenge_method") != "S256" {
		t.Fatalf("authorization request is missing required OIDC/PKCE parameters: %s", location.String())
	}
	seen := map[string]bool{}
	for _, cookie := range response.Cookies() {
		seen[cookie.Name] = cookie.HttpOnly
	}
	for _, name := range []string{stateCookieName, verifierCookieName, nonceCookieName} {
		if !seen[name] {
			t.Fatalf("missing HttpOnly OAuth cookie %s", name)
		}
	}
}

func TestMergeClaimsUsesUserinfoAvatarWithoutReplacingVerifiedIdentity(t *testing.T) {
	avatar := " https://cdn.example.org/avatar/user.jpg "
	result := mergeClaims(
		claims{Subject: "verified-sub", Email: "verified@example.org", Name: "Verified User"},
		claims{Subject: "userinfo-sub", Email: "userinfo@example.org", Name: "Userinfo User", Avatar: &avatar},
	)
	if result.Subject != "verified-sub" || result.Email != "verified@example.org" || result.Name != "Verified User" || result.Avatar == nil {
		t.Fatalf("unexpected merged claims: %#v", result)
	}
	if normalized, present := normalizedSSOAvatar(result.Avatar); !present || normalized == nil || *normalized != "https://cdn.example.org/avatar/user.jpg" {
		t.Fatalf("unexpected normalized avatar: %#v, present=%v", normalized, present)
	}
}

func TestNormalizedSSOAvatarSupportsClearAndRejectsUnsafeURI(t *testing.T) {
	empty := "  "
	if avatar, present := normalizedSSOAvatar(&empty); !present || avatar != nil {
		t.Fatalf("empty SSO avatar must explicitly clear the image")
	}
	unsafe := "file:///private/avatar.jpg"
	if avatar, present := normalizedSSOAvatar(&unsafe); present || avatar != nil {
		t.Fatalf("unsafe SSO avatar must be ignored")
	}
	if avatar, present := normalizedSSOAvatar(nil); present || avatar != nil {
		t.Fatalf("missing SSO avatar must preserve the current image")
	}
}
