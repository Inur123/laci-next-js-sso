package api

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func (a *API) publicStats(w http.ResponseWriter, r *http.Request) {
	var members, applications, pac int
	var periodName *string
	_ = a.pool.QueryRow(r.Context(), `SELECT p.nama FROM "Periode" p JOIN "User" u ON u.id=p."userId" WHERE u.role='SEKRETARIS_CABANG' AND p."isActive"=true ORDER BY p."createdAt" LIMIT 1`).Scan(&periodName)
	if periodName != nil {
		_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "Anggota" a JOIN "Periode" p ON p.id=a."periodeId" WHERE p.nama=$1`, *periodName).Scan(&members)
		_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "PengajuanBerkas" x JOIN "Periode" p ON p.id=x."periodeId" WHERE p.nama=$1`, *periodName).Scan(&applications)
	}
	_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "User" WHERE role='SEKRETARIS_PAC' AND "isActive"=true`).Scan(&pac)
	httpx.JSON(w, 200, map[string]any{"data": map[string]int{"anggota": members, "pengajuan": applications, "pac": pac}})
}

func (a *API) publicAgenda(w http.ResponseWriter, r *http.Request) {
	rows, err := a.pool.Query(r.Context(), `SELECT id,judul,deskripsi,lokasi,warna,"tanggalMulai","tanggalSelesai" FROM "AgendaKegiatan" WHERE "tanggalMulai">=now()-interval '1 year' ORDER BY "tanggalMulai"`)
	if err != nil {
		a.dbError(w, err)
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, title, color string
		var desc, location *string
		var start time.Time
		var end *time.Time
		if err := rows.Scan(&id, &title, &desc, &location, &color, &start, &end); err != nil {
			a.dbError(w, err)
			return
		}
		title, _ = a.crypto.DecryptText(title)
		items = append(items, map[string]any{"id": id, "title": title, "description": decPtr(a.crypto, desc), "location": decPtr(a.crypto, location), "color": color, "start": start, "end": end})
	}
	httpx.JSON(w, 200, map[string]any{"data": items})
}

func (a *API) publicPresensi(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := a.store.Get(r.Context(), "presensi", id)
	if err != nil {
		a.dbError(w, err)
		return
	}
	var count int
	_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "PresensiData" WHERE "presensiId"=$1`, id).Scan(&count)
	item["_count"] = map[string]int{"dataPresensi": count}
	item["isOpen"] = publicPresensiOpen(item)
	httpx.JSON(w, 200, map[string]any{"data": item})
}

func publicPresensiOpen(item map[string]any) bool {
	dateText, _ := item["tanggal"].(string)
	start, _ := item["jamMulai"].(string)
	end, _ := item["jamSelesai"].(string)
	active, _ := item["isActive"].(bool)
	date, err := time.Parse(time.RFC3339, dateText)
	if err != nil {
		return false
	}
	return isOpen(date, start, end, active)
}

func (a *API) publicWilayah(w http.ResponseWriter, r *http.Request) {
	where, args := []string{"TRUE"}, []any{}
	if kind := r.URL.Query().Get("jenis"); kind == "RANTING" || kind == "PK" {
		args = append(args, kind)
		where = append(where, fmt.Sprintf(`w.jenis=$%d::"JenisWilayah"`, len(args)))
	}
	if pacID := r.URL.Query().Get("pacId"); pacID != "" {
		args = append(args, pacID)
		where = append(where, fmt.Sprintf(`w."userId"=$%d`, len(args)))
	}
	rows, err := a.pool.Query(r.Context(), fmt.Sprintf(`SELECT w.id,w.jenis::text,w.nama,w.ketua,w.kontak,w.alamat,u.id,u.name,p.nama,p."isActive" FROM "Wilayah" w JOIN "User" u ON u.id=w."userId" JOIN "Periode" p ON p.id=w."periodeId" WHERE %s ORDER BY w."createdAt" DESC`, strings.Join(where, " AND ")), args...)
	if err != nil {
		a.dbError(w, err)
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, jenis, nama, userID, userName, periodName string
		var ketua, kontak, alamat *string
		var periodActive bool
		if err := rows.Scan(&id, &jenis, &nama, &ketua, &kontak, &alamat, &userID, &userName, &periodName, &periodActive); err != nil {
			a.dbError(w, err)
			return
		}
		items = append(items, map[string]any{"id": id, "jenis": jenis, "nama": nama, "ketua": ketua, "kontak": kontak, "alamat": alamat, "user": map[string]any{"id": userID, "name": userName}, "periode": map[string]any{"nama": periodName, "isActive": periodActive}})
	}
	httpx.JSON(w, 200, map[string]any{"success": true, "count": len(items), "data": items})
}

// publicOrganizations exposes the organization choices needed by an external
// member-registration system. Periods and wilayah are resolved from the
// selected user's current active period; callers must not supply a period ID.
func (a *API) publicOrganizations(w http.ResponseWriter, r *http.Request) {
	type wilayahItem struct {
		ID    string `json:"id"`
		Jenis string `json:"jenis"`
		Nama  string `json:"nama"`
	}
	type organizationItem struct {
		ID           string            `json:"id"`
		Name         string            `json:"name"`
		Role         string            `json:"role"`
		PeriodeAktif map[string]string `json:"periodeAktif"`
		Wilayah      []wilayahItem     `json:"wilayah"`
	}

	load := func(role string) ([]organizationItem, error) {
		rows, err := a.pool.Query(r.Context(), `
			SELECT u.id,u.name,u.role::text,p.id,p.nama
			FROM "User" u
			JOIN "Periode" p ON p."userId"=u.id AND p."isActive"=true
			WHERE u.role=$1::"Role" AND u."isActive"=true AND u."emailVerified"=true
			ORDER BY u.name`, role)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		items := []organizationItem{}
		for rows.Next() {
			var item organizationItem
			var periodID, periodName string
			if err := rows.Scan(&item.ID, &item.Name, &item.Role, &periodID, &periodName); err != nil {
				return nil, err
			}
			item.PeriodeAktif = map[string]string{"id": periodID, "nama": periodName}
			item.Wilayah = []wilayahItem{}
			wilayahRows, err := a.pool.Query(r.Context(), `
				SELECT id,jenis::text,nama
				FROM "Wilayah"
				WHERE "userId"=$1 AND "periodeId"=$2
				ORDER BY jenis,nama`, item.ID, periodID)
			if err != nil {
				return nil, err
			}
			for wilayahRows.Next() {
				var wilayah wilayahItem
				if err := wilayahRows.Scan(&wilayah.ID, &wilayah.Jenis, &wilayah.Nama); err != nil {
					wilayahRows.Close()
					return nil, err
				}
				item.Wilayah = append(item.Wilayah, wilayah)
			}
			if err := wilayahRows.Err(); err != nil {
				wilayahRows.Close()
				return nil, err
			}
			wilayahRows.Close()
			items = append(items, item)
		}
		return items, rows.Err()
	}

	cabang, err := load("SEKRETARIS_CABANG")
	if err != nil {
		a.dbError(w, err)
		return
	}
	pac, err := load("SEKRETARIS_PAC")
	if err != nil {
		a.dbError(w, err)
		return
	}

	var selectedCabang any
	if len(cabang) > 0 {
		selectedCabang = cabang[0]
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data": map[string]any{
			"cabang": selectedCabang,
			"pac":    pac,
		},
	})
}

func (a *API) publicPHBI(w http.ResponseWriter, r *http.Request) {
	year := time.Now().Year()
	if raw := r.URL.Query().Get("year"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 2000 || parsed > 2100 {
			httpx.Error(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "Tahun tidak valid")
			return
		}
		year = parsed
	}
	request, err := http.NewRequestWithContext(r.Context(), http.MethodGet, fmt.Sprintf("https://api-hari-libur.vercel.app/api?year=%d", year), nil)
	if err != nil {
		a.dbError(w, err)
		return
	}
	response, err := (&http.Client{Timeout: 15 * time.Second}).Do(request)
	if err != nil || response.StatusCode < 200 || response.StatusCode >= 300 {
		httpx.Error(w, http.StatusBadGateway, "UPSTREAM_ERROR", "Gagal mengambil data kalender nasional")
		return
	}
	defer response.Body.Close()
	var payload struct {
		Data any `json:"data"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		httpx.Error(w, http.StatusBadGateway, "UPSTREAM_ERROR", "Respons kalender nasional tidak valid")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "year": strconv.Itoa(year), "source": "https://github.com/andifahruddinakas/api-hari-libur", "holidays": payload.Data})
}

func nestedString(item map[string]any, relation, field string) string {
	if object, ok := item[relation].(map[string]any); ok {
		return fmt.Sprint(object[field])
	}
	return ""
}

func (a *API) integrationData(w http.ResponseWriter, r *http.Request) {
	keys := []string{"arsip", "anggota", "pengajuan-berkas", "berkas-pimpinan", "berkas-sp", "agenda-kegiatan"}
	all := map[string][]map[string]any{}
	for _, key := range keys {
		items, err := a.store.All(r.Context(), key)
		if err != nil {
			a.dbError(w, err)
			return
		}
		all[key] = items
	}
	response := map[string]any{"success": true, "timestamp": time.Now().UTC().Format(time.RFC3339)}
	response["arsipSurat"] = mapItems(all["arsip"], func(item map[string]any) map[string]any {
		return map[string]any{"id": item["id"], "noSurat": item["noSurat"], "pengirimPenerima": item["pengirimPenerima"], "perihal": item["perihal"], "deskripsi": item["deskripsi"], "jenisSurat": item["jenisSurat"], "organisasi": item["organisasi"], "tanggal": item["tanggal"], "file": item["file"], "uploader": nestedString(item, "user", "name"), "periode": nestedString(item, "periode", "nama"), "createdAt": item["createdAt"]}
	})
	response["anggota"] = mapItems(all["anggota"], func(item map[string]any) map[string]any {
		return map[string]any{"id": item["id"], "nik": item["nik"], "nama": item["namaLengkap"], "email": item["email"], "noHp": item["noHp"], "tempatLahir": item["tempatLahir"], "tanggalLahir": item["tanggalLahir"], "alamat": item["alamatLengkap"], "pekerjaan": item["pekerjaan"], "jenjangPendidikan": item["jenjangPendidikan"], "uploader": nestedString(item, "user", "name"), "periode": nestedString(item, "periode", "nama"), "createdAt": item["createdAt"]}
	})
	response["pengajuanBerkas"] = mapItems(all["pengajuan-berkas"], func(item map[string]any) map[string]any {
		return map[string]any{"id": item["id"], "noSurat": item["noSurat"], "keperluan": item["keperluan"], "deskripsi": item["deskripsi"], "status": item["status"], "file": item["file"], "pacName": nestedString(item, "user", "name"), "periodePac": nestedString(item, "periodePac", "nama"), "catatanAdmin": item["alasanPenolakan"], "createdAt": item["createdAt"]}
	})
	response["berkasPimpinan"] = mapItems(all["berkas-pimpinan"], func(item map[string]any) map[string]any {
		return map[string]any{"id": item["id"], "nama": item["nama"], "catatan": item["catatan"], "tanggal": item["tanggal"], "file": item["file"], "uploader": nestedString(item, "user", "name"), "periode": nestedString(item, "periode", "nama"), "createdAt": item["createdAt"]}
	})
	response["berkasSP"] = mapItems(all["berkas-sp"], func(item map[string]any) map[string]any {
		return map[string]any{"id": item["id"], "nama": item["nama"], "catatan": item["catatan"], "tanggalMulai": item["tanggalMulai"], "tanggalBerakhir": item["tanggalBerakhir"], "file": item["file"], "uploader": nestedString(item, "user", "name"), "periode": nestedString(item, "periode", "nama"), "createdAt": item["createdAt"]}
	})
	response["agendaKegiatan"] = mapItems(all["agenda-kegiatan"], func(item map[string]any) map[string]any {
		return map[string]any{"id": item["id"], "judul": item["judul"], "deskripsi": item["deskripsi"], "tanggalMulai": item["tanggalMulai"], "tanggalSelesai": item["tanggalSelesai"], "lokasi": item["lokasi"], "warna": item["warna"], "uploader": nestedString(item, "user", "name"), "createdAt": item["createdAt"]}
	})
	periods, users := []map[string]any{}, []map[string]any{}
	periodRows, _ := a.pool.Query(r.Context(), `SELECT id,nama,"isActive","createdAt" FROM "Periode" ORDER BY "createdAt" DESC`)
	if periodRows != nil {
		for periodRows.Next() {
			var id, name string
			var active bool
			var created time.Time
			_ = periodRows.Scan(&id, &name, &active, &created)
			periods = append(periods, map[string]any{"id": id, "nama": name, "isActive": active, "createdAt": created})
		}
		periodRows.Close()
	}
	userRows, _ := a.pool.Query(r.Context(), `SELECT id,name,email,role::text,"isActive","emailVerified","createdAt" FROM "User" ORDER BY "createdAt" DESC`)
	if userRows != nil {
		for userRows.Next() {
			var id, name, email, role string
			var active, verified bool
			var created time.Time
			_ = userRows.Scan(&id, &name, &email, &role, &active, &verified, &created)
			users = append(users, map[string]any{"id": id, "name": name, "email": email, "role": role, "isActive": active, "emailVerified": verified, "createdAt": created})
		}
		userRows.Close()
	}
	response["periode"], response["users"] = periods, users
	httpx.JSON(w, http.StatusOK, response)
}

func mapItems(items []map[string]any, transform func(map[string]any) map[string]any) []map[string]any {
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		result = append(result, transform(item))
	}
	return result
}

func (a *API) publicAnggota(w http.ResponseWriter, r *http.Request) {
	var input map[string]any
	if !httpx.Decode(w, r, &input) {
		return
	}
	targetRole := strings.ToUpper(strings.TrimSpace(fmt.Sprint(input["targetRole"])))
	if targetRole == "<NIL>" {
		targetRole = ""
	}
	targetID := strings.TrimSpace(fmt.Sprint(input["targetId"]))
	if targetID == "<nil>" {
		targetID = ""
	}
	// pacId/userId remain accepted for backwards compatibility. New clients
	// should use targetRole + targetId so Cabang and PAC are explicit.
	if targetRole == "" {
		if _, exists := input["pacId"]; exists {
			targetRole = "PAC"
		} else if _, exists := input["userId"]; exists {
			targetRole = "PAC"
		}
	}
	if targetID == "" {
		targetID = strings.TrimSpace(fmt.Sprint(input["pacId"]))
		if targetID == "<nil>" {
			targetID = ""
		}
	}
	if targetID == "" {
		targetID = strings.TrimSpace(fmt.Sprint(input["userId"]))
		if targetID == "<nil>" {
			targetID = ""
		}
	}
	role := map[string]string{"PAC": "SEKRETARIS_PAC", "CABANG": "SEKRETARIS_CABANG"}[targetRole]
	if role == "" || targetID == "" {
		httpx.Error(w, 422, "VALIDATION_ERROR", "targetRole (PAC/CABANG) dan targetId wajib diisi")
		return
	}
	if fields := validateResource("anggota", input, true); len(fields) > 0 {
		httpx.Error(w, 422, "VALIDATION_ERROR", "namaLengkap dan jenisKelamin wajib diisi", fields)
		return
	}
	var period string
	if err := a.pool.QueryRow(r.Context(), `
		SELECT p.id
		FROM "User" u
		JOIN "Periode" p ON p."userId"=u.id AND p."isActive"=true
		WHERE u.id=$1 AND u.role=$2::"Role" AND u."isActive"=true AND u."emailVerified"=true
		ORDER BY p."updatedAt" DESC,p."createdAt" DESC
		LIMIT 1`, targetID, role).Scan(&period); err != nil {
		httpx.Error(w, 422, "INVALID_TARGET", "Target organisasi tidak valid atau belum memiliki periode aktif")
		return
	}
	if wilayahID := strings.TrimSpace(fmt.Sprint(input["wilayahId"])); wilayahID != "" && wilayahID != "<nil>" {
		var belongs bool
		if err := a.pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "Wilayah" WHERE id=$1 AND "userId"=$2 AND "periodeId"=$3)`, wilayahID, targetID, period).Scan(&belongs); err != nil {
			a.dbError(w, err)
			return
		}
		if !belongs {
			httpx.Error(w, 422, "INVALID_WILAYAH", "Wilayah tidak dimiliki target organisasi atau bukan bagian dari periode aktif")
			return
		}
	}
	fake := identity.User{ID: targetID, Role: role, IsActive: true, ActivePeriodID: &period}
	input["status"] = "PENDING"
	item, err := a.store.Create(r.Context(), "anggota", fake, period, input)
	if err != nil {
		a.dbError(w, err)
		return
	}
	memberID := fmt.Sprint(item["id"])
	if _, err := a.pool.Exec(r.Context(), `INSERT INTO "AnggotaPeriode" (id,"anggotaId","userId","periodeId","wilayahId",status,"alasanPenolakan","createdAt","updatedAt") SELECT $1,id,"userId","periodeId","wilayahId",status,"alasanPenolakan",now(),now() FROM "Anggota" WHERE id=$2`, newID(), memberID); err != nil {
		_, _ = a.pool.Exec(r.Context(), `DELETE FROM "Anggota" WHERE id=$1`, memberID)
		a.dbError(w, err)
		return
	}
	if err := a.createMemberRelations(r.Context(), memberID, input); err != nil {
		_, _ = a.pool.Exec(r.Context(), `DELETE FROM "Anggota" WHERE id=$1`, memberID)
		a.dbError(w, err)
		return
	}
	a.hub.Publish(map[string]any{"type": "anggota", "action": "CREATE", "entityId": item["id"]})
	httpx.JSON(w, 201, map[string]any{"data": map[string]any{"id": memberID, "targetRole": targetRole, "targetId": targetID, "periodeId": period}, "message": "Data anggota berhasil dikirim dan menunggu verifikasi Cabang."})
}

func (a *API) createMemberRelations(ctx context.Context, memberID string, input map[string]any) error {
	tx, err := a.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if rows, ok := input["perkaderans"].([]any); ok {
		for _, raw := range rows {
			row, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			name, _ := a.crypto.EncryptText(strings.TrimSpace(fmt.Sprint(row["namaPerkaderan"])))
			place := strings.TrimSpace(fmt.Sprint(row["tempat"]))
			if place == "" || place == "<nil>" {
				place = "-"
			}
			place, _ = a.crypto.EncryptText(place)
			date := time.Now()
			if parsed, ok := parseFlexibleDate(fmt.Sprint(row["tanggal"])); ok {
				date = parsed
			}
			if _, err := tx.Exec(ctx, `INSERT INTO "Perkaderan" (id,"anggotaId","namaPerkaderan",tanggal,tempat,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,now(),now())`, newID(), memberID, name, date, place); err != nil {
				return err
			}
		}
	}
	if rows, ok := input["pendidikans"].([]any); ok {
		for _, raw := range rows {
			row, ok := raw.(map[string]any)
			if !ok {
				continue
			}
			jenjang := strings.TrimSpace(fmt.Sprint(row["jenjang"]))
			school := strings.TrimSpace(fmt.Sprint(row["namaSekolah"]))
			if school == "" || school == "<nil>" {
				school = "-"
			}
			school, _ = a.crypto.EncryptText(school)
			if _, err := tx.Exec(ctx, `INSERT INTO "Pendidikan" (id,"anggotaId",jenjang,"namaSekolah","createdAt","updatedAt") VALUES ($1,$2,$3,$4,now(),now())`, newID(), memberID, jenjang, school); err != nil {
				return err
			}
		}
	}
	return tx.Commit(ctx)
}

func (a *API) apiKey(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if a.cfg.APIKey == "" || r.Header.Get("X-API-Key") != a.cfg.APIKey {
			httpx.Error(w, 401, "INVALID_API_KEY", "API key tidak valid")
			return
		}
		next(w, r)
	}
}
