package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ipnu-ippnu/laci/backend/internal/cryptox"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
	"github.com/ipnu-ippnu/laci/backend/internal/store"
)

func TestReferenceFileAccessAcrossPACs(t *testing.T) {
	pool := openRegressionDatabase(t)
	execRegressionSQL(t, pool, `CREATE TABLE "User" (id text PRIMARY KEY, role text NOT NULL)`)
	execRegressionSQL(t, pool, `CREATE TABLE "Periode" (id text PRIMARY KEY, "userId" text NOT NULL, "isActive" boolean NOT NULL)`)
	execRegressionSQL(t, pool, `CREATE TABLE "PengajuanBerkas" (id text PRIMARY KEY, "userId" text NOT NULL, "periodeId" text NOT NULL, file text NOT NULL DEFAULT '')`)
	execRegressionSQL(t, pool, `CREATE TABLE "ArsipSurat" (id text PRIMARY KEY, "userId" text NOT NULL, file text NOT NULL DEFAULT '')`)
	execRegressionSQL(t, pool, `INSERT INTO "User" VALUES ('cabang','SEKRETARIS_CABANG'),('pac-owner','SEKRETARIS_PAC')`)
	execRegressionSQL(t, pool, `INSERT INTO "Periode" VALUES ('active','cabang',true),('past','cabang',false),('pac-period','pac-owner',true)`)
	execRegressionSQL(t, pool, `INSERT INTO "PengajuanBerkas" (id,"userId","periodeId") VALUES ('reference','pac-owner','active'),('old-reference','pac-owner','past'),('private','pac-owner','pac-period')`)
	execRegressionSQL(t, pool, `INSERT INTO "ArsipSurat" (id,"userId") VALUES ('archive','pac-owner')`)
	cipher, err := cryptox.New("reference-file-regression-secret")
	if err != nil {
		t.Fatal(err)
	}
	application := &API{pool: pool, store: store.New(pool, cipher), crypto: cipher}

	for _, tc := range []struct {
		name, resource, id, query, userID, role string
		allowed                                 bool
	}{
		{"other PAC reference", "pengajuan-berkas", "reference", "scope=reference", "pac-reader", "SEKRETARIS_PAC", true},
		{"another PAC reader", "pengajuan-berkas", "reference", "scope=reference", "pac-reader-2", "SEKRETARIS_PAC", true},
		{"owner without scope", "pengajuan-berkas", "reference", "", "pac-owner", "SEKRETARIS_PAC", true},
		{"Cabang without scope", "pengajuan-berkas", "reference", "", "cabang", "SEKRETARIS_CABANG", true},
		{"other PAC without scope", "pengajuan-berkas", "reference", "", "pac-reader", "SEKRETARIS_PAC", false},
		{"inactive reference period", "pengajuan-berkas", "old-reference", "scope=reference", "pac-reader", "SEKRETARIS_PAC", false},
		{"non-reference period", "pengajuan-berkas", "private", "scope=reference", "pac-reader", "SEKRETARIS_PAC", false},
		{"private archive", "arsip", "archive", "scope=reference", "pac-reader", "SEKRETARIS_PAC", false},
		{"missing file record", "pengajuan-berkas", "missing", "scope=reference", "pac-reader", "SEKRETARIS_PAC", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, endpoint := range []struct{ method, path string }{
				{http.MethodGet, "download"},
				{http.MethodGet, "download?preview=true"},
				{http.MethodPost, "download-token"},
			} {
				t.Run(endpoint.path, func(t *testing.T) {
					url := "/api/v1/" + tc.resource + "/" + tc.id + "/" + endpoint.path
					if tc.query != "" {
						separator := "?"
						if strings.Contains(url, "?") {
							separator = "&"
						}
						url += separator + tc.query
					}
					request := requestWithRouteParam(httptest.NewRequest(endpoint.method, url, nil), "id", tc.id)
					request = request.WithContext(identity.WithUser(request.Context(), identity.User{
						ID: tc.userID, Role: tc.role, EmailVerified: true,
					}))
					recorder := httptest.NewRecorder()
					handler := application.download(tc.resource)
					if endpoint.method == http.MethodPost {
						handler = application.downloadToken(tc.resource)
					}
					identity.RequireVerified(handler).ServeHTTP(recorder, request)
					wantStatus, wantCode := http.StatusForbidden, "FORBIDDEN"
					if tc.allowed {
						// An empty fixture file must reach file lookup, rather than
						// fail the ownership check. No R2 access is needed here.
						wantStatus, wantCode = http.StatusNotFound, "FILE_NOT_FOUND"
						if endpoint.method == http.MethodPost {
							wantStatus, wantCode = http.StatusOK, ""
						}
					}
					if recorder.Code != wantStatus || (wantCode != "" && !strings.Contains(recorder.Body.String(), `"code":"`+wantCode+`"`)) {
						t.Fatalf("status=%d body=%s; want status=%d code=%s", recorder.Code, recorder.Body.String(), wantStatus, wantCode)
					}
					if tc.allowed && endpoint.method == http.MethodPost {
						var payload struct{ Token string }
						if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
							t.Fatal(err)
						}
						if id, valid := cipher.VerifyDownloadToken(payload.Token); !valid || id != tc.id {
							t.Fatal("reference token must be valid for the requested document")
						}
					}
				})
			}
		})
	}
}

func TestReferenceFilesRequireAuthenticationAndVerification(t *testing.T) {
	application := &API{auth: &identity.Authenticator{}}
	for _, endpoint := range []struct{ method, path string }{
		{http.MethodGet, "download"},
		{http.MethodPost, "download-token"},
	} {
		t.Run(endpoint.path, func(t *testing.T) {
			request := httptest.NewRequest(endpoint.method, "/api/v1/pengajuan-berkas/reference/"+endpoint.path+"?scope=reference", nil)
			anonymous := httptest.NewRecorder()
			application.Router().ServeHTTP(anonymous, request)
			if anonymous.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous reference access: status=%d", anonymous.Code)
			}
			request = request.WithContext(identity.WithUser(request.Context(), identity.User{ID: "unverified", Role: "SEKRETARIS_PAC"}))
			unverified := httptest.NewRecorder()
			handler := application.download("pengajuan-berkas")
			if endpoint.method == http.MethodPost {
				handler = application.downloadToken("pengajuan-berkas")
			}
			identity.RequireVerified(handler).ServeHTTP(unverified, request)
			if unverified.Code != http.StatusForbidden || !strings.Contains(unverified.Body.String(), "EMAIL_UNVERIFIED") {
				t.Fatalf("unverified reference access: status=%d body=%s", unverified.Code, unverified.Body.String())
			}
		})
	}
}
