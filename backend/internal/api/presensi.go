package api

import (
	"encoding/json"
	"github.com/go-chi/chi/v5"
	"github.com/ipnu-ippnu/laci/backend/internal/cryptox"
	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
	"net/http"
	"regexp"
	"strings"
	"time"
)

func (a *API) publicParticipant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input struct{ NamaLengkap, Email, NoHp, Organisasi, Tingkat, Jabatan, Instansi string }
	if !httpx.Decode(w, r, &input) {
		return
	}
	input.NamaLengkap = strings.TrimSpace(input.NamaLengkap)
	input.NoHp = strings.ReplaceAll(strings.TrimSpace(input.NoHp), " ", "")
	emailPattern := regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	phonePattern := regexp.MustCompile(`^[0-9]{10,15}$`)
	if len(input.NamaLengkap) < 3 || len(input.NamaLengkap) > 100 || !emailPattern.MatchString(strings.TrimSpace(input.Email)) || !phonePattern.MatchString(input.NoHp) || strings.TrimSpace(input.Organisasi) == "" {
		httpx.Error(w, 422, "VALIDATION_ERROR", "Data presensi tidak valid")
		return
	}
	var date time.Time
	var start, end string
	var active bool
	err := a.pool.QueryRow(r.Context(), `SELECT tanggal,"jamMulai","jamSelesai","isActive" FROM "Presensi" WHERE id=$1`, id).Scan(&date, &start, &end, &active)
	if err != nil {
		a.dbError(w, err)
		return
	}
	if !isOpen(date, start, end, active) {
		httpx.Error(w, 409, "ATTENDANCE_CLOSED", "Presensi sudah ditutup")
		return
	}
	enc := func(v string) string { x, _ := a.crypto.EncryptText(strings.TrimSpace(v)); return x }
	participantID := newID()
	email := strings.ToLower(strings.TrimSpace(input.Email))
	_, err = a.pool.Exec(r.Context(), `INSERT INTO "PresensiData" (id,"presensiId","namaLengkap",email,"noHp","emailHash","noHpHash",organisasi,tingkat,jabatan,instansi,"createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())`, participantID, id, enc(input.NamaLengkap), enc(email), enc(input.NoHp), cryptox.HashNormalized(email), cryptox.HashNormalized(input.NoHp), strings.TrimSpace(input.Organisasi), nullableString(input.Tingkat), nullableString(input.Jabatan), nullableString(input.Instansi))
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			httpx.Error(w, http.StatusConflict, "DUPLICATE_ATTENDANCE", "Mohon maaf, email atau nomor HP ini sudah absen di kegiatan ini")
			return
		}
		a.dbError(w, err)
		return
	}
	a.hub.Publish(map[string]any{"type": "presensi", "presensiId": id})
	httpx.JSON(w, 201, map[string]string{"message": "Presensi berhasil disimpan", "participantId": participantID})
}

func isOpen(date time.Time, start, end string, active bool) bool {
	if !active {
		return false
	}
	loc, _ := time.LoadLocation("Asia/Jakarta")
	now := time.Now().In(loc)
	d := date.In(loc).Format("2006-01-02")
	from, e1 := time.ParseInLocation("2006-01-02 15:04", d+" "+start, loc)
	to, e2 := time.ParseInLocation("2006-01-02 15:04", d+" "+end, loc)
	return e1 == nil && e2 == nil && !now.Before(from) && !now.After(to)
}

func nullableString(v string) any {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return strings.TrimSpace(v)
}

func decPtr(c *cryptox.Service, value *string) any {
	if value == nil {
		return nil
	}
	decrypted, _ := c.DecryptText(*value)
	return decrypted
}

func (a *API) publicParticipantDetail(w http.ResponseWriter, r *http.Request) {
	pid := chi.URLParam(r, "participantID")
	var raw []byte
	if err := a.pool.QueryRow(r.Context(), `SELECT to_jsonb(p) FROM "PresensiData" p WHERE id=$1`, pid).Scan(&raw); err != nil {
		a.dbError(w, err)
		return
	}
	var item map[string]any
	if err := json.Unmarshal(raw, &item); err != nil {
		a.dbError(w, err)
		return
	}
	for _, field := range []string{"namaLengkap", "email", "noHp"} {
		if value, ok := item[field].(string); ok {
			item[field], _ = a.crypto.DecryptText(value)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": item})
}

func (a *API) listParticipants(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	id := chi.URLParam(r, "id")
	owned, err := a.store.Owned(r.Context(), "presensi", id, u)
	if err != nil || !owned {
		httpx.Error(w, 403, "FORBIDDEN", "Data bukan milik Anda")
		return
	}
	rows, err := a.pool.Query(r.Context(), `SELECT id,"namaLengkap",email,"noHp",organisasi,tingkat,jabatan,instansi,"createdAt" FROM "PresensiData" WHERE "presensiId"=$1 ORDER BY "createdAt" DESC`, id)
	if err != nil {
		a.dbError(w, err)
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var pid string
		var nama, email, hp, org string
		var tingkat, jabatan, instansi *string
		var created time.Time
		if err := rows.Scan(&pid, &nama, &email, &hp, &org, &tingkat, &jabatan, &instansi, &created); err != nil {
			a.dbError(w, err)
			return
		}
		dec := func(v string) string { x, _ := a.crypto.DecryptText(v); return x }
		items = append(items, map[string]any{"id": pid, "namaLengkap": dec(nama), "email": dec(email), "noHp": dec(hp), "organisasi": org, "tingkat": tingkat, "jabatan": jabatan, "instansi": instansi, "createdAt": created})
	}
	httpx.JSON(w, 200, map[string]any{"data": items, "total": len(items)})
}

func (a *API) getParticipant(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	pid := chi.URLParam(r, "participantID")
	var presensiID string
	if err := a.pool.QueryRow(r.Context(), `SELECT "presensiId" FROM "PresensiData" WHERE id=$1`, pid).Scan(&presensiID); err != nil {
		a.dbError(w, err)
		return
	}
	rctx := chi.NewRouteContext()
	_ = rctx
	owned, err := a.store.Owned(r.Context(), "presensi", presensiID, u)
	if err != nil || !owned {
		httpx.Error(w, 403, "FORBIDDEN", "Data bukan milik Anda")
		return
	}
	var raw []byte
	if err := a.pool.QueryRow(r.Context(), `SELECT to_jsonb(p) FROM "PresensiData" p WHERE id=$1`, pid).Scan(&raw); err != nil {
		a.dbError(w, err)
		return
	}
	var item map[string]any
	_ = json.Unmarshal(raw, &item)
	for _, f := range []string{"namaLengkap", "email", "noHp"} {
		if v, ok := item[f].(string); ok {
			item[f], _ = a.crypto.DecryptText(v)
		}
	}
	httpx.JSON(w, 200, map[string]any{"data": item})
}
