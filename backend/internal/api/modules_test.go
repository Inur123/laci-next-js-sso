package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
)

func TestParseFlexibleDate(t *testing.T) {
	t.Parallel()
	for _, input := range []string{"2026-08-20", "20/08/2026", "Kamis, 20 Agustus 2026"} {
		parsed, ok := parseFlexibleDate(input)
		if !ok || parsed.Format("2006-01-02") != "2026-08-20" {
			t.Fatalf("parseFlexibleDate(%q) = %v, %v", input, parsed, ok)
		}
	}
	if _, ok := parseFlexibleDate("bukan tanggal"); ok {
		t.Fatal("invalid date must be rejected")
	}
}

func TestNormalizeImportRow(t *testing.T) {
	t.Parallel()
	row := map[string]any{"noSurat": "001", "jenisSurat": "masuk", "organisasi": "CBP/KPP", "tanggal": "20 Agustus 2026", "pengirimPenerima": "PAC", "perihal": "Undangan"}
	if err := normalizeImportRow("arsip", row); err != nil {
		t.Fatal(err)
	}
	if row["jenisSurat"] != "MASUK" || row["organisasi"] != "CBP_KPP" || !strings.HasPrefix(row["tanggal"].(string), "2026-08-20T00:00:00") {
		t.Fatalf("unexpected normalized row: %#v", row)
	}
}

func TestFilterAndSort(t *testing.T) {
	t.Parallel()
	items := []map[string]any{{"id": "2", "nama": "Zeta", "jenis": "PK"}, {"id": "1", "nama": "Alpha", "jenis": "RANTING"}}
	request := httptest.NewRequest("GET", "/?search=alpha&jenis=RANTING&sortKey=nama&sortDir=asc", nil)
	result := filterAndSort("wilayah", items, request)
	if len(result) != 1 || result[0]["id"] != "1" {
		t.Fatalf("unexpected result: %#v", result)
	}
}

func TestFilterAndSortNestedMemberRelations(t *testing.T) {
	items := []map[string]any{
		{"id": "2", "user": map[string]any{"id": "u-1", "name": "Zeta PAC"}, "periode": map[string]any{"id": "p-1", "nama": "2024-2026"}},
		{"id": "1", "user": map[string]any{"id": "u-2", "name": "Alpha PAC"}, "periode": map[string]any{"id": "p-2", "nama": "2026-2028"}},
	}
	byUser := filterAndSort("anggota", items, httptest.NewRequest("GET", "/?sortKey=user&sortDir=asc", nil))
	if byUser[0]["id"] != "1" {
		t.Fatalf("nested user sort used relation IDs instead of names: %#v", byUser)
	}
	byPeriod := filterAndSort("anggota", items, httptest.NewRequest("GET", "/?sortKey=periode&sortDir=desc", nil))
	if byPeriod[0]["id"] != "1" {
		t.Fatalf("nested period sort used map formatting instead of names: %#v", byPeriod)
	}
}

func TestFilterAndSortPengajuanByOwnerBeforePagination(t *testing.T) {
	items := []map[string]any{
		{"id": "3", "noSurat": "003", "user": map[string]any{"id": "u-3", "name": "Zeta PAC"}},
		{"id": "2", "noSurat": "002", "user": map[string]any{"id": "u-2", "name": "Beta PAC"}},
		{"id": "1", "noSurat": "001", "user": map[string]any{"id": "u-1", "name": "Alpha PAC"}},
	}

	searched := filterAndSort("pengajuan-berkas", items, httptest.NewRequest("GET", "/?search=beta", nil))
	if len(searched) != 1 || searched[0]["id"] != "2" {
		t.Fatalf("owner search did not use the enriched user name: %#v", searched)
	}

	sorted := filterAndSort("pengajuan-berkas", items, httptest.NewRequest("GET", "/?sortKey=pengaju&sortDir=asc", nil))
	if len(sorted) != 3 || sorted[0]["id"] != "1" || sorted[2]["id"] != "3" {
		t.Fatalf("owner sort was not applied globally before pagination: %#v", sorted)
	}
	firstPage := sorted[:1]
	if firstPage[0]["id"] != "1" {
		t.Fatalf("unexpected first page after owner sort: %#v", firstPage)
	}
}

func TestMountResourceRequiresCabangForCabangOnlyModules(t *testing.T) {
	for _, resource := range []string{"agenda-kegiatan", "berkas-sp"} {
		t.Run(resource, func(t *testing.T) {
			router := chi.NewRouter()
			(&API{}).mountResource(router, resource)
			request := httptest.NewRequest(http.MethodPost, "/"+resource+"/", strings.NewReader(`{}`))
			request.Header.Set("Content-Type", "application/json")
			request = request.WithContext(identity.WithUser(request.Context(), identity.User{
				ID:            "pac-1",
				Role:          "SEKRETARIS_PAC",
				EmailVerified: true,
			}))
			recorder := httptest.NewRecorder()

			router.ServeHTTP(recorder, request)

			if recorder.Code != http.StatusForbidden || !strings.Contains(recorder.Body.String(), `"code":"FORBIDDEN"`) {
				t.Fatalf("PAC reached %s mutation: status=%d body=%s", resource, recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestIsOpen(t *testing.T) {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().In(location)
	if !isOpen(now, now.Add(-2*time.Minute).Format("15:04"), now.Add(2*time.Minute).Format("15:04"), true) {
		t.Fatal("active event in its time window must be open")
	}
	if isOpen(now, "00:00", "23:59", false) {
		t.Fatal("inactive event must be closed")
	}
}
