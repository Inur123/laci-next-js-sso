package api

import (
	"net/http/httptest"
	"testing"
	"time"
)

func TestFilterAndSortAgendaComputedStatus(t *testing.T) {
	now := time.Now().UTC()
	items := []map[string]any{
		{"id": "upcoming", "tanggalMulai": now.Add(time.Hour).Format(time.RFC3339)},
		{"id": "ongoing", "tanggalMulai": now.Add(-time.Hour).Format(time.RFC3339), "tanggalSelesai": now.Add(time.Hour).Format(time.RFC3339)},
		{"id": "done", "tanggalMulai": now.Add(-48 * time.Hour).Format(time.RFC3339), "tanggalSelesai": now.Add(-24 * time.Hour).Format(time.RFC3339)},
	}

	request := httptest.NewRequest("GET", "/api/v1/agenda-kegiatan?status=BERLANGSUNG", nil)
	filtered := filterAndSort("agenda-kegiatan", items, request)
	if len(filtered) != 1 || filtered[0]["id"] != "ongoing" {
		t.Fatalf("expected only ongoing agenda, got %#v", filtered)
	}
	if got := items[0]["status"]; got != "MENDATANG" {
		t.Fatalf("expected upcoming status enrichment, got %v", got)
	}
	if got := items[2]["status"]; got != "SELESAI" {
		t.Fatalf("expected completed status enrichment, got %v", got)
	}
}

func TestAgendaStatusBoundariesAndDefaultDuration(t *testing.T) {
	t.Parallel()
	start := time.Date(2026, time.August, 24, 8, 0, 0, 0, time.UTC)
	end := start.Add(2 * time.Hour)
	tests := []struct {
		name string
		item map[string]any
		now  time.Time
		want string
	}{
		{
			name: "before start",
			item: map[string]any{"tanggalMulai": start.Format(time.RFC3339), "tanggalSelesai": end.Format(time.RFC3339)},
			now:  start.Add(-time.Nanosecond),
			want: "MENDATANG",
		},
		{
			name: "exact start",
			item: map[string]any{"tanggalMulai": start.Format(time.RFC3339), "tanggalSelesai": end.Format(time.RFC3339)},
			now:  start,
			want: "BERLANGSUNG",
		},
		{
			name: "exact end",
			item: map[string]any{"tanggalMulai": start.Format(time.RFC3339), "tanggalSelesai": end.Format(time.RFC3339)},
			now:  end,
			want: "BERLANGSUNG",
		},
		{
			name: "after end",
			item: map[string]any{"tanggalMulai": start.Format(time.RFC3339), "tanggalSelesai": end.Format(time.RFC3339)},
			now:  end.Add(time.Nanosecond),
			want: "SELESAI",
		},
		{
			name: "missing end defaults to 24 hours",
			item: map[string]any{"tanggalMulai": start.Format(time.RFC3339)},
			now:  start.Add(23*time.Hour + 59*time.Minute),
			want: "BERLANGSUNG",
		},
		{
			name: "invalid start remains unknown",
			item: map[string]any{"tanggalMulai": "not-a-date"},
			now:  start,
			want: "",
		},
	}
	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := agendaStatus(test.item, test.now); got != test.want {
				t.Fatalf("agendaStatus()=%q, want %q", got, test.want)
			}
		})
	}
}

func TestBerkasSPStatusBoundaries(t *testing.T) {
	t.Parallel()
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, time.August, 24, 14, 0, 0, 0, location)
	tests := []struct {
		name string
		end  time.Time
		want string
	}{
		{name: "expired yesterday", end: now.AddDate(0, 0, -1), want: "KEDALUWARSA"},
		{name: "ends today", end: now, want: "HAMPIR_HABIS"},
		{name: "thirty days left", end: now.AddDate(0, 0, 30), want: "HAMPIR_HABIS"},
		{name: "more than thirty days", end: now.AddDate(0, 0, 31), want: "AKTIF"},
	}
	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			item := map[string]any{"tanggalBerakhir": test.end.Format(time.RFC3339)}
			if got := berkasSPStatus(item, now); got != test.want {
				t.Fatalf("berkasSPStatus()=%q, want %q", got, test.want)
			}
		})
	}
}

func TestFilterAndSortBerkasSPComputedStatus(t *testing.T) {
	now := time.Now()
	items := []map[string]any{
		{"id": "active", "tanggalBerakhir": now.AddDate(0, 0, 60).Format(time.RFC3339)},
		{"id": "expiring", "tanggalBerakhir": now.AddDate(0, 0, 10).Format(time.RFC3339)},
		{"id": "expired", "tanggalBerakhir": now.AddDate(0, 0, -10).Format(time.RFC3339)},
	}
	request := httptest.NewRequest("GET", "/api/v1/berkas-sp?status=HAMPIR_HABIS", nil)
	filtered := filterAndSort("berkas-sp", items, request)
	if len(filtered) != 1 || filtered[0]["id"] != "expiring" {
		t.Fatalf("expected only expiring Berkas SP, got %#v", filtered)
	}
}
