package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ipnu-ippnu/laci/backend/internal/config"
	"github.com/ipnu-ippnu/laci/backend/internal/realtime"
)

func TestRecordMobileAuthEventPersistsAuditMetadata(t *testing.T) {
	pool := openRegressionDatabase(t)
	execRegressionSQL(t, pool, `CREATE TYPE "LogAction" AS ENUM ('LOGIN','LOGOUT')`)
	execRegressionSQL(t, pool, `CREATE TYPE "LogModule" AS ENUM ('AUTH')`)
	execRegressionSQL(t, pool, `CREATE TABLE "User" (id text PRIMARY KEY, name text NOT NULL, "periodeAktifId" text, "lastLogoutAt" timestamptz, "updatedAt" timestamptz NOT NULL DEFAULT now())`)
	execRegressionSQL(t, pool, `CREATE TABLE "LogActivity" (id text PRIMARY KEY, "userId" text NOT NULL, "periodeId" text NOT NULL, action "LogAction" NOT NULL, module "LogModule" NOT NULL, description text NOT NULL, browser text, device text, "ipAddress" text, location text, "userAgent" text, "createdAt" timestamptz NOT NULL DEFAULT now())`)
	execRegressionSQL(t, pool, `INSERT INTO "User" (id,name,"periodeAktifId") VALUES ('mobile-user','Sekretaris Mobile','period-1')`)

	application := &API{
		cfg:  config.Config{TrustedProxyHeaders: true},
		pool: pool,
		hub:  realtime.New(),
	}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/mobile/exchange", nil)
	request.Header.Set("X-Client-User-Agent", "Laci Mobile")
	request.Header.Set("X-Client-Location", "-7.6500, 111.3600")
	request.Header.Set("X-Client-IP", "203.0.113.25")

	application.recordAuthEvent(request, "mobile-user", "LOGIN")

	var browser, device, ipAddress, location, userAgent string
	if err := pool.QueryRow(context.Background(), `SELECT browser,device,"ipAddress",location,"userAgent" FROM "LogActivity" WHERE "userId"='mobile-user' AND action='LOGIN'`).Scan(&browser, &device, &ipAddress, &location, &userAgent); err != nil {
		t.Fatal(err)
	}
	if browser != "Laci Mobile" || device != "Mobile" || ipAddress != "203.0.113.25" || location != "-7.6500, 111.3600" || userAgent != "Laci Mobile" {
		t.Fatalf("unexpected mobile audit metadata: browser=%q device=%q ip=%q location=%q userAgent=%q", browser, device, ipAddress, location, userAgent)
	}

	application.recordAuthEvent(request, "mobile-user", "LOGOUT")
	var logoutRecorded bool
	if err := pool.QueryRow(context.Background(), `SELECT "lastLogoutAt" IS NOT NULL FROM "User" WHERE id='mobile-user'`).Scan(&logoutRecorded); err != nil {
		t.Fatal(err)
	}
	if !logoutRecorded {
		t.Fatal("mobile logout did not update lastLogoutAt")
	}
}

func TestAuditMetadataDoesNotTrustClientIPByDefault(t *testing.T) {
	application := &API{}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/arsip", nil)
	request.Header.Set("User-Agent", "Mozilla/5.0 Chrome/140.0 Safari/537.36")
	request.Header.Set("X-Client-IP", "198.51.100.10")

	metadata := application.auditMetadata(request)

	if metadata.Browser != "Chrome" {
		t.Fatalf("browser detection is not deterministic: %q", metadata.Browser)
	}
	if metadata.IPAddress == "198.51.100.10" {
		t.Fatal("untrusted X-Client-IP was accepted")
	}
}
