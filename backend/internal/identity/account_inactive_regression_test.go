package identity

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/oauth2"
)

var identityRegressionSchemaSequence atomic.Uint64

func TestWriteAuthErrorAccountInactiveContract(t *testing.T) {
	recorder := httptest.NewRecorder()

	writeAuthError(
		recorder,
		http.StatusUnauthorized,
		"ACCOUNT_INACTIVE",
		"Akun Anda dinonaktifkan oleh Sekretaris Cabang",
	)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("unexpected status: %d", recorder.Code)
	}
	if contentType := recorder.Header().Get("Content-Type"); contentType != "application/json" {
		t.Fatalf("unexpected content type: %q", contentType)
	}
	if body := recorder.Body.String(); !strings.Contains(body, `"code":"ACCOUNT_INACTIVE"`) {
		t.Fatalf("inactive account code missing from response: %s", body)
	}
}

func TestRequireVerifiedBlocksUnverifiedAccounts(t *testing.T) {
	nextCalled := false
	handler := RequireVerified(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusNoContent)
	}))
	request := httptest.NewRequest(http.MethodGet, "/api/v1/anggota", nil)
	request = request.WithContext(WithUser(request.Context(), User{
		ID:            "unverified-1",
		EmailVerified: false,
	}))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if nextCalled {
		t.Fatal("unverified account reached an internal feature handler")
	}
	if recorder.Code != http.StatusForbidden || !strings.Contains(recorder.Body.String(), `"code":"EMAIL_UNVERIFIED"`) {
		t.Fatalf("unexpected verification response: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestRequireVerifiedAllowsVerifiedAccounts(t *testing.T) {
	handler := RequireVerified(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	request := httptest.NewRequest(http.MethodGet, "/api/v1/anggota", nil)
	request = request.WithContext(WithUser(request.Context(), User{
		ID:            "verified-1",
		EmailVerified: true,
	}))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("verified account was blocked: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestMiddlewareMapsInactiveMobileSessionToStableError(t *testing.T) {
	pool := openIdentityRegressionDatabase(t)
	createIdentitySessionTables(t, pool)
	execIdentityRegressionSQL(t, pool, `INSERT INTO "User" (id,email,name,role,"isActive","emailVerified") VALUES ('inactive-1','inactive@example.test','Inactive User','SEKRETARIS_PAC',false,true)`)
	execIdentityRegressionSQL(t, pool, `INSERT INTO "Account" (id,"userId","providerId","accountId","updatedAt") VALUES ('account-1','inactive-1','sso-ipnu','subject-1',now())`)
	rawToken := MobileTokenPrefix + base64.RawURLEncoding.EncodeToString(make([]byte, 32))
	if _, err := pool.Exec(context.Background(), `INSERT INTO "Session" (id,"userId",token,"expiresAt") VALUES ('session-1','inactive-1',$1,now()+interval '1 hour')`, mobileSessionStorageKey(rawToken)); err != nil {
		t.Fatal(err)
	}

	authenticator := &Authenticator{
		pool:       pool,
		providerID: "sso-ipnu",
		cookieName: "laci_session",
	}
	nextCalled := false
	handler := authenticator.Middleware(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		nextCalled = true
	}))
	request := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	request.Header.Set("Authorization", "Bearer "+rawToken)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if nextCalled {
		t.Fatal("inactive account reached the protected handler")
	}
	if recorder.Code != http.StatusUnauthorized || !strings.Contains(recorder.Body.String(), `"code":"ACCOUNT_INACTIVE"`) {
		t.Fatalf("unexpected inactive middleware response: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestMobileExchangeReturnsAccountInactiveBeforeSessionCreation(t *testing.T) {
	pool := openIdentityRegressionDatabase(t)
	createIdentitySessionTables(t, pool)
	execIdentityRegressionSQL(t, pool, `CREATE TABLE "MobileAuthTransaction" (id text PRIMARY KEY, "exchangeCodeHash" text, "codeChallenge" text NOT NULL, "redirectUri" text NOT NULL, "providerCompletedAt" timestamptz, "userId" text, "expiresAt" timestamptz NOT NULL)`)
	execIdentityRegressionSQL(t, pool, `INSERT INTO "User" (id,email,name,role,"isActive","emailVerified") VALUES ('inactive-mobile','inactive-mobile@example.test','Inactive Mobile','SEKRETARIS_PAC',false,true)`)
	execIdentityRegressionSQL(t, pool, `INSERT INTO "Account" (id,"userId","providerId","accountId","updatedAt") VALUES ('account-mobile','inactive-mobile','sso-ipnu','subject-mobile',now())`)

	verifier := oauth2.GenerateVerifier()
	challenge := oauth2.S256ChallengeFromVerifier(verifier)
	code := mobileExchangeCodePrefix + base64.RawURLEncoding.EncodeToString(make([]byte, 32))
	redirectURI := "lacidigital://oauth/callback"
	if _, err := pool.Exec(
		context.Background(),
		`INSERT INTO "MobileAuthTransaction" (id,"exchangeCodeHash","codeChallenge","redirectUri","providerCompletedAt","userId","expiresAt") VALUES ('transaction-1',$1,$2,$3,now(),'inactive-mobile',now()+interval '1 minute')`,
		opaqueHash(code),
		challenge,
		redirectURI,
	); err != nil {
		t.Fatal(err)
	}
	authenticator := &Authenticator{
		pool:               pool,
		providerID:         "sso-ipnu",
		mobileRedirectURIs: map[string]struct{}{redirectURI: {}},
	}

	_, err := authenticator.ExchangeMobileCode(
		context.Background(),
		code,
		verifier,
		redirectURI,
		httptest.NewRequest(http.MethodPost, "/api/v1/auth/mobile/exchange", nil),
	)

	if !errors.Is(err, ErrAccountInactive) {
		t.Fatalf("expected ErrAccountInactive, got %v", err)
	}
	var sessions int
	if scanErr := pool.QueryRow(context.Background(), `SELECT count(*) FROM "Session"`).Scan(&sessions); scanErr != nil {
		t.Fatal(scanErr)
	}
	if sessions != 0 {
		t.Fatalf("inactive mobile exchange created %d session(s)", sessions)
	}
}

func createIdentitySessionTables(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	execIdentityRegressionSQL(t, pool, `CREATE TABLE "User" (id text PRIMARY KEY, email text NOT NULL, name text NOT NULL, image text, role text NOT NULL, "isActive" boolean NOT NULL, "emailVerified" boolean NOT NULL, "periodeAktifId" text)`)
	execIdentityRegressionSQL(t, pool, `CREATE TABLE "Account" (id text PRIMARY KEY, "userId" text NOT NULL, "providerId" text NOT NULL, "accountId" text NOT NULL, "updatedAt" timestamptz NOT NULL)`)
	execIdentityRegressionSQL(t, pool, `CREATE TABLE "Session" (id text PRIMARY KEY, "userId" text NOT NULL, token text NOT NULL, "expiresAt" timestamptz NOT NULL)`)
}

func openIdentityRegressionDatabase(t *testing.T) *pgxpool.Pool {
	t.Helper()
	databaseURL := strings.TrimSpace(os.Getenv("LACI_TEST_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("set LACI_TEST_DATABASE_URL to run PostgreSQL identity regressions")
	}
	admin, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatalf("connect regression database: %v", err)
	}
	schema := fmt.Sprintf(
		"laci_identity_regression_%d_%d_%d",
		os.Getpid(),
		time.Now().UnixNano(),
		identityRegressionSchemaSequence.Add(1),
	)
	identifier := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(context.Background(), "CREATE SCHEMA "+identifier); err != nil {
		admin.Close()
		t.Fatalf("create identity regression schema: %v", err)
	}
	configuration, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+identifier+" CASCADE")
		admin.Close()
		t.Fatal(err)
	}
	configuration.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(context.Background(), configuration)
	if err != nil {
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+identifier+" CASCADE")
		admin.Close()
		t.Fatalf("open isolated identity pool: %v", err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+identifier+" CASCADE")
		admin.Close()
	})
	return pool
}

func execIdentityRegressionSQL(t *testing.T, pool *pgxpool.Pool, query string) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), query); err != nil {
		t.Fatalf("execute identity regression fixture: %v\nquery: %s", err, query)
	}
}
