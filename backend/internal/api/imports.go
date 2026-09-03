package api

import (
	"errors"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
	"github.com/ipnu-ippnu/laci/backend/internal/store"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func (a *API) bulkImport(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	key := chi.URLParam(r, "resource")
	if _, ok := store.Resources[key]; !ok {
		httpx.Error(w, 404, "NOT_FOUND", "Modul import tidak dikenal")
		return
	}
	if key != "arsip" && key != "berkas-pimpinan" && key != "berkas-sp" {
		httpx.Error(w, 422, "UNSUPPORTED_IMPORT", "Modul ini tidak memiliki import Excel")
		return
	}
	if key == "berkas-sp" && !u.IsCabang() {
		httpx.Error(w, http.StatusForbidden, "FORBIDDEN", "Akses hanya untuk Sekretaris Cabang")
		return
	}
	var input struct {
		Rows     []map[string]any `json:"rows"`
		FileName string           `json:"fileName"`
	}
	if !httpx.Decode(w, r, &input) {
		return
	}
	if len(input.Rows) > 3000 {
		httpx.Error(w, 413, "TOO_MANY_ROWS", "Maksimal 3000 baris")
		return
	}
	period, err := a.store.ActivePeriod(r.Context(), u)
	if err != nil {
		httpx.Error(w, 409, "NO_ACTIVE_PERIOD", err.Error())
		return
	}
	success := 0
	failures := []string{}
	for i, row := range input.Rows {
		if err := normalizeImportRow(key, row); err != nil {
			failures = append(failures, fmt.Sprintf("Baris %d: %s", i+2, err.Error()))
			continue
		}
		if fields := validateResource(key, row, true); len(fields) > 0 {
			failures = append(failures, fmt.Sprintf("Baris %d: Ada kolom wajib yang kosong", i+2))
			continue
		}
		if _, err := a.store.Create(r.Context(), key, u, period, row); err != nil {
			failures = append(failures, fmt.Sprintf("Baris %d: %s", i+2, err.Error()))
			continue
		}
		success++
	}
	a.sideEffect(r, key, "IMPORT", map[string]any{})
	httpx.JSON(w, 200, map[string]any{"success": success, "failed": len(failures), "errors": failures, "message": fmt.Sprintf("%d data berhasil diimpor", success)})
}

func normalizeImportRow(key string, row map[string]any) error {
	dateFields := map[string][]string{"arsip": {"tanggal"}, "berkas-pimpinan": {"tanggal"}, "berkas-sp": {"tanggalMulai", "tanggalBerakhir"}}[key]
	for _, field := range dateFields {
		parsed, ok := parseFlexibleDate(fmt.Sprint(row[field]))
		if !ok {
			return fmt.Errorf("format tanggal %q tidak valid", row[field])
		}
		row[field] = parsed.Format(time.RFC3339)
	}
	if key == "arsip" {
		kind := strings.ToUpper(strings.TrimSpace(fmt.Sprint(row["jenisSurat"])))
		if kind != "MASUK" && kind != "KELUAR" {
			return errors.New("Jenis Surat harus MASUK atau KELUAR")
		}
		row["jenisSurat"] = kind
		org := strings.ReplaceAll(strings.ToUpper(strings.TrimSpace(fmt.Sprint(row["organisasi"]))), "/", "_")
		if !validOrganization(org) {
			row["organisasi"] = nil
		} else {
			row["organisasi"] = org
		}
	}
	if key == "berkas-sp" {
		org := strings.ReplaceAll(strings.ToUpper(strings.TrimSpace(fmt.Sprint(row["organisasi"]))), "/", "_")
		if !validOrganization(org) {
			org = "IPNU"
		}
		row["organisasi"] = org
	}
	return nil
}

func validOrganization(value string) bool {
	return value == "IPNU" || value == "IPPNU" || value == "BERSAMA" || value == "CBP_KPP"
}

func parseFlexibleDate(raw string) (time.Time, bool) {
	value := strings.TrimSpace(raw)
	if value == "" || value == "<nil>" {
		return time.Time{}, false
	}
	if comma := strings.Index(value, ","); comma >= 0 {
		value = strings.TrimSpace(value[comma+1:])
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02", "02/01/2006", "2/1/2006"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, true
		}
	}
	months := map[string]time.Month{"januari": 1, "februari": 2, "maret": 3, "april": 4, "mei": 5, "juni": 6, "juli": 7, "agustus": 8, "september": 9, "oktober": 10, "november": 11, "desember": 12}
	parts := strings.Fields(strings.ToLower(value))
	if len(parts) == 3 {
		day, dayErr := strconv.Atoi(parts[0])
		year, yearErr := strconv.Atoi(parts[2])
		if month, ok := months[parts[1]]; ok && dayErr == nil && yearErr == nil {
			parsed := time.Date(year, month, day, 0, 0, 0, 0, time.Local)
			if parsed.Day() == day && parsed.Month() == month {
				return parsed, true
			}
		}
	}
	return time.Time{}, false
}

func (a *API) logExport(w http.ResponseWriter, r *http.Request) {
	var input struct{ Module, FileName string }
	if !httpx.Decode(w, r, &input) {
		return
	}
	u, _ := identity.FromContext(r.Context())
	period, err := a.store.ActivePeriod(r.Context(), u)
	if err != nil {
		httpx.Error(w, 409, "NO_ACTIVE_PERIOD", err.Error())
		return
	}
	_, err = a.pool.Exec(r.Context(), `INSERT INTO "LogActivity" (id,"userId","periodeId",action,module,description,"createdAt") VALUES ($1,$2,$3,'EXPORT',$4::"LogModule",$5,now())`, newID(), u.ID, period, input.Module, "Export file "+input.FileName)
	if err != nil {
		a.dbError(w, err)
		return
	}
	httpx.JSON(w, 200, map[string]string{"message": "Export tercatat"})
}
