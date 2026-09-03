package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/ipnu-ippnu/laci/backend/internal/cryptox"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
	"github.com/ipnu-ippnu/laci/backend/internal/realtime"
	"github.com/ipnu-ippnu/laci/backend/internal/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var regressionSchemaSequence atomic.Uint64

func TestBulkImportBerkasSPRequiresCabangBeforeReadingPayload(t *testing.T) {
	request := requestWithRouteParam(
		httptest.NewRequest(http.MethodPost, "/api/v1/imports/berkas-sp", strings.NewReader(`{"rows":[]}`)),
		"resource",
		"berkas-sp",
	)
	request = request.WithContext(identity.WithUser(request.Context(), identity.User{
		ID:   "pac-1",
		Role: "SEKRETARIS_PAC",
	}))
	recorder := httptest.NewRecorder()

	(&API{}).bulkImport(recorder, request)

	if recorder.Code != http.StatusForbidden || !strings.Contains(recorder.Body.String(), `"code":"FORBIDDEN"`) {
		t.Fatalf("unexpected PAC import response: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestBulkImportBerkasSPAllowsCabangThroughAuthorizationGuard(t *testing.T) {
	request := requestWithRouteParam(
		httptest.NewRequest(http.MethodPost, "/api/v1/imports/berkas-sp", strings.NewReader(`not-json`)),
		"resource",
		"berkas-sp",
	)
	request = request.WithContext(identity.WithUser(request.Context(), identity.User{
		ID:   "cabang-1",
		Role: "SEKRETARIS_CABANG",
	}))
	recorder := httptest.NewRecorder()

	(&API{}).bulkImport(recorder, request)

	if recorder.Code != http.StatusBadRequest || !strings.Contains(recorder.Body.String(), `"code":"VALIDATION_ERROR"`) {
		t.Fatalf("Cabang should pass authorization and reach payload validation: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestReferenceDownloadTokenAuthorization(t *testing.T) {
	pool := openRegressionDatabase(t)
	execRegressionSQL(t, pool, `CREATE TABLE "User" (id text PRIMARY KEY, role text NOT NULL)`)
	execRegressionSQL(t, pool, `CREATE TABLE "Periode" (id text PRIMARY KEY, "userId" text NOT NULL, "isActive" boolean NOT NULL, "createdAt" timestamptz NOT NULL)`)
	execRegressionSQL(t, pool, `CREATE TABLE "PengajuanBerkas" (id text PRIMARY KEY, "userId" text NOT NULL, "periodeId" text NOT NULL)`)
	execRegressionSQL(t, pool, `INSERT INTO "User" (id,role) VALUES ('cabang-owner','SEKRETARIS_CABANG')`)
	execRegressionSQL(t, pool, `INSERT INTO "Periode" (id,"userId","isActive","createdAt") VALUES ('cabang-active','cabang-owner',true,now())`)
	execRegressionSQL(t, pool, `INSERT INTO "PengajuanBerkas" (id,"userId","periodeId") VALUES ('reference-1','cabang-owner','cabang-active')`)

	cipher, err := cryptox.New("regression-download-secret")
	if err != nil {
		t.Fatal(err)
	}
	application := &API{
		pool:   pool,
		store:  store.New(pool, cipher),
		crypto: cipher,
	}
	pac := identity.User{ID: "pac-reader", Role: "SEKRETARIS_PAC"}

	withoutScope := requestWithRouteParam(
		httptest.NewRequest(http.MethodPost, "/api/v1/pengajuan-berkas/reference-1/download-token", nil),
		"id",
		"reference-1",
	)
	withoutScope = withoutScope.WithContext(identity.WithUser(withoutScope.Context(), pac))
	denied := httptest.NewRecorder()
	application.downloadToken("pengajuan-berkas")(denied, withoutScope)
	if denied.Code != http.StatusForbidden {
		t.Fatalf("reference without scope must be forbidden: status=%d body=%s", denied.Code, denied.Body.String())
	}

	withScope := requestWithRouteParam(
		httptest.NewRequest(http.MethodPost, "/api/v1/pengajuan-berkas/reference-1/download-token?scope=reference", nil),
		"id",
		"reference-1",
	)
	withScope = withScope.WithContext(identity.WithUser(withScope.Context(), pac))
	allowed := httptest.NewRecorder()
	application.downloadToken("pengajuan-berkas")(allowed, withScope)
	if allowed.Code != http.StatusOK {
		t.Fatalf("active Cabang reference must be authorized: status=%d body=%s", allowed.Code, allowed.Body.String())
	}
	var payload struct {
		Token     string `json:"token"`
		ExpiresIn int    `json:"expiresIn"`
	}
	if err := json.Unmarshal(allowed.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Token == "" || payload.ExpiresIn != 300 {
		t.Fatalf("unexpected reference token payload: %#v", payload)
	}
}

func TestCabangCopyUsesMatchingPACPeriodNameAsSource(t *testing.T) {
	pool := openRegressionDatabase(t)
	execRegressionSQL(t, pool, `CREATE TYPE "LogAction" AS ENUM ('IMPORT')`)
	execRegressionSQL(t, pool, `CREATE TYPE "LogModule" AS ENUM ('ANGGOTA')`)
	execRegressionSQL(t, pool, `CREATE TABLE "Periode" (id text PRIMARY KEY, "userId" text NOT NULL, nama text NOT NULL, "isActive" boolean NOT NULL DEFAULT false, "updatedAt" timestamptz NOT NULL DEFAULT now(), "createdAt" timestamptz NOT NULL DEFAULT now())`)
	execRegressionSQL(t, pool, `CREATE TABLE "Anggota" (id text PRIMARY KEY, "userId" text NOT NULL, "periodeId" text NOT NULL, "wilayahId" text, status text NOT NULL, "alasanPenolakan" text, "updatedAt" timestamptz NOT NULL DEFAULT now())`)
	execRegressionSQL(t, pool, `CREATE TABLE "AnggotaPeriode" (id text PRIMARY KEY, "anggotaId" text NOT NULL, "userId" text NOT NULL, "periodeId" text NOT NULL, "wilayahId" text, status text NOT NULL, "alasanPenolakan" text, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("anggotaId","periodeId"))`)
	execRegressionSQL(t, pool, `CREATE TABLE "LogActivity" (id text PRIMARY KEY, "userId" text NOT NULL, "periodeId" text NOT NULL, action "LogAction" NOT NULL, module "LogModule" NOT NULL, description text NOT NULL, "entityId" text, browser text, device text, "ipAddress" text, location text, "userAgent" text, "createdAt" timestamptz NOT NULL DEFAULT now())`)
	execRegressionSQL(t, pool, `INSERT INTO "Periode" (id,"userId",nama,"isActive") VALUES ('source-cabang','cabang-1','2024-2026',false),('target-cabang','cabang-1','2026-2028',true),('source-pac-match','pac-1','2024-2026',false),('source-pac-other','pac-2','periode-lain',false)`)
	execRegressionSQL(t, pool, `INSERT INTO "Anggota" (id,"userId","periodeId",status) VALUES ('member-match','pac-1','source-pac-match','DITERIMA'),('member-other','pac-2','source-pac-other','DITERIMA')`)
	execRegressionSQL(t, pool, `INSERT INTO "AnggotaPeriode" (id,"anggotaId","userId","periodeId",status) VALUES ('assignment-match','member-match','pac-1','source-pac-match','DITERIMA'),('assignment-other','member-other','pac-2','source-pac-other','DITERIMA')`)

	application := &API{
		pool:  pool,
		store: store.New(pool, nil),
		hub:   realtime.New(),
	}
	request := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/anggota/copy-period",
		strings.NewReader(`{"anggotaIds":["member-match","member-other"],"sourcePeriodeId":"source-cabang","targetPeriodeId":"target-cabang"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	request = request.WithContext(identity.WithUser(request.Context(), identity.User{
		ID:   "cabang-1",
		Role: "SEKRETARIS_CABANG",
	}))
	recorder := httptest.NewRecorder()

	application.copyMembersToPeriod(recorder, request)

	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), `"copied":1`) {
		t.Fatalf("unexpected Cabang copy response: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	var copiedOwner string
	if err := pool.QueryRow(context.Background(), `SELECT "userId" FROM "AnggotaPeriode" WHERE "anggotaId"='member-match' AND "periodeId"='target-cabang'`).Scan(&copiedOwner); err != nil {
		t.Fatalf("matching PAC assignment was not copied: %v", err)
	}
	if copiedOwner != "pac-1" {
		t.Fatalf("copied assignment owner changed: got %q", copiedOwner)
	}
	var unrelatedCopies int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM "AnggotaPeriode" WHERE "anggotaId"='member-other' AND "periodeId"='target-cabang'`).Scan(&unrelatedCopies); err != nil {
		t.Fatal(err)
	}
	if unrelatedCopies != 0 {
		t.Fatalf("assignment from a differently named period was copied: count=%d", unrelatedCopies)
	}
}

func requestWithRouteParam(request *http.Request, key, value string) *http.Request {
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add(key, value)
	return request.WithContext(context.WithValue(request.Context(), chi.RouteCtxKey, routeContext))
}

func openRegressionDatabase(t *testing.T) *pgxpool.Pool {
	t.Helper()
	databaseURL := strings.TrimSpace(os.Getenv("LACI_TEST_DATABASE_URL"))
	if databaseURL == "" {
		t.Skip("set LACI_TEST_DATABASE_URL to run PostgreSQL regression tests")
	}
	admin, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatalf("connect regression database: %v", err)
	}
	schema := fmt.Sprintf(
		"laci_api_regression_%d_%d_%d",
		os.Getpid(),
		time.Now().UnixNano(),
		regressionSchemaSequence.Add(1),
	)
	identifier := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(context.Background(), "CREATE SCHEMA "+identifier); err != nil {
		admin.Close()
		t.Fatalf("create regression schema: %v", err)
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
		t.Fatalf("open isolated regression pool: %v", err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+identifier+" CASCADE")
		admin.Close()
	})
	return pool
}

func execRegressionSQL(t *testing.T, pool *pgxpool.Pool, query string) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), query); err != nil {
		t.Fatalf("execute regression fixture: %v\nquery: %s", err, query)
	}
}
