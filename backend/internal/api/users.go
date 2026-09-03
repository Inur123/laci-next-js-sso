package api

import (
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
	"github.com/jackc/pgx/v5"
	"net/http"
	"strings"
	"time"
)

func (a *API) updateMe(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	var input struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Image    string `json:"image"`
		Password string `json:"password"`
	}
	if !httpx.Decode(w, r, &input) {
		return
	}
	name := strings.TrimSpace(input.Name)
	if len(name) < 2 || len(name) > 100 {
		httpx.Error(w, 422, "VALIDATION_ERROR", "Nama harus 2-100 karakter")
		return
	}
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if email == "" {
		email = u.Email
	}
	var oldImage *string
	_ = a.pool.QueryRow(r.Context(), `SELECT image FROM "User" WHERE id=$1`, u.ID).Scan(&oldImage)
	image := oldImage
	if input.Image != "" {
		image = &input.Image
	}
	_, err := a.pool.Exec(r.Context(), `UPDATE "User" SET name=$1,email=$2,image=$3,"updatedAt"=now() WHERE id=$4`, name, email, image, u.ID)
	if err != nil {
		a.dbError(w, err)
		return
	}
	a.sideEffect(r, "user", "UPDATE", map[string]any{"id": u.ID})
	if input.Image != "" && oldImage != nil && *oldImage != input.Image && !strings.HasPrefix(*oldImage, "http://") && !strings.HasPrefix(*oldImage, "https://") && !strings.HasPrefix(*oldImage, "data:") {
		_ = a.storage.Delete(r.Context(), *oldImage)
	}
	httpx.JSON(w, 200, map[string]string{"message": "Profil berhasil diperbarui"})
}

func (a *API) users(w http.ResponseWriter, r *http.Request) {
	page, limit, offset := httpx.Pagination(r)
	where, args := []string{`role='SEKRETARIS_PAC'`}, []any{}
	add := func(clause string, value any) {
		args = append(args, value)
		where = append(where, fmt.Sprintf(clause, len(args)))
	}
	if search := strings.TrimSpace(r.URL.Query().Get("search")); search != "" {
		add(`(name ILIKE $%d OR email ILIKE $%d)`, "%"+search+"%")
	}
	if status := r.URL.Query().Get("status"); status == "ACTIVE" || status == "INACTIVE" {
		add(`"isActive"=$%d`, status == "ACTIVE")
	}
	if verified := r.URL.Query().Get("emailStatus"); verified == "VERIFIED" || verified == "UNVERIFIED" {
		add(`"emailVerified"=$%d`, verified == "VERIFIED")
	}
	whereSQL := strings.Join(where, " AND ")
	var total int
	_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "User" WHERE `+whereSQL, args...).Scan(&total)
	sortColumn := map[string]string{"name": "name", "email": "email", "createdAt": `"createdAt"`, "isActive": `"isActive"`}[r.URL.Query().Get("sortKey")]
	if sortColumn == "" {
		sortColumn = `"createdAt"`
	}
	direction := "DESC"
	if r.URL.Query().Get("sortDir") == "asc" {
		direction = "ASC"
	}
	args = append(args, limit, offset)
	rows, err := a.pool.Query(r.Context(), fmt.Sprintf(`SELECT id,name,email,image,"isActive","emailVerified","periodeAktifId","createdAt","lastLogoutAt" FROM "User" WHERE %s ORDER BY %s %s LIMIT $%d OFFSET $%d`, whereSQL, sortColumn, direction, len(args)-1, len(args)), args...)
	if err != nil {
		a.dbError(w, err)
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, name, email string
		var image, period *string
		var active, verified bool
		var created time.Time
		var logout *time.Time
		if err := rows.Scan(&id, &name, &email, &image, &active, &verified, &period, &created, &logout); err != nil {
			a.dbError(w, err)
			return
		}
		items = append(items, map[string]any{"id": id, "name": name, "email": email, "image": image, "role": "SEKRETARIS_PAC", "isActive": active, "emailVerified": verified, "periodeAktifId": period, "createdAt": created, "lastLogoutAt": logout})
	}
	httpx.JSON(w, 200, map[string]any{"data": items, "pagination": map[string]any{"page": page, "limit": limit, "total": total, "totalPages": (total + limit - 1) / limit}})
}

func (a *API) directoryUsers(w http.ResponseWriter, r *http.Request) {
	role := r.URL.Query().Get("role")
	if role == "" {
		role = "SEKRETARIS_PAC"
	}
	if role != "SEKRETARIS_PAC" && role != "SEKRETARIS_CABANG" {
		httpx.Error(w, 422, "VALIDATION_ERROR", "Role tidak valid")
		return
	}
	rows, err := a.pool.Query(r.Context(), `SELECT u.id,u.name,u.role::text,p.id,p.nama FROM "User" u LEFT JOIN "Periode" p ON p."userId"=u.id AND p."isActive"=true WHERE u.role=$1::"Role" AND u."isActive"=true AND u."emailVerified"=true ORDER BY u.name`, role)
	if err != nil {
		a.dbError(w, err)
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, name, userRole string
		var periodID, periodName *string
		if err := rows.Scan(&id, &name, &userRole, &periodID, &periodName); err != nil {
			a.dbError(w, err)
			return
		}
		items = append(items, map[string]any{"id": id, "name": name, "role": userRole, "periodeAktifId": periodID, "periodeAktif": map[string]any{"id": periodID, "nama": periodName}})
	}
	httpx.JSON(w, 200, map[string]any{"data": items})
}

func (a *API) userDetail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var raw []byte
	err := a.pool.QueryRow(r.Context(), `SELECT to_jsonb(u) FROM "User" u WHERE id=$1`, id).Scan(&raw)
	if err != nil {
		a.dbError(w, err)
		return
	}
	var data map[string]any
	_ = json.Unmarshal(raw, &data)
	delete(data, "password")
	var periodName *string
	_ = a.pool.QueryRow(r.Context(), `SELECT nama FROM "Periode" WHERE id=(SELECT "periodeAktifId" FROM "User" WHERE id=$1)`, id).Scan(&periodName)
	data["periodeAktif"] = periodName
	counts := map[string]string{"totalArsip": "ArsipSurat", "totalPengajuan": "PengajuanBerkas", "totalAnggota": "Anggota", "totalBerkasPimpinan": "BerkasPimpinan", "totalLog": "LogActivity"}
	for field, table := range counts {
		var total int
		_ = a.pool.QueryRow(r.Context(), fmt.Sprintf(`SELECT count(*) FROM %s WHERE "userId"=$1`, `"`+table+`"`), id).Scan(&total)
		data[field] = total
	}
	perkaderanCounts := map[string]int{"Makesta": 0, "Lakmud": 0, "Latin": 0, "Latpel": 0, "Lakut": 0, "Diklatama": 0, "Diklatmad": 0}
	perkaderans := []map[string]any{}
	rows, _ := a.pool.Query(r.Context(), `SELECT p.id,p."namaPerkaderan",p.tanggal,p.tempat FROM "Perkaderan" p JOIN "Anggota" a ON a.id=p."anggotaId" WHERE a."userId"=$1 ORDER BY p.tanggal DESC`, id)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var pid, name, place string
			var date time.Time
			if rows.Scan(&pid, &name, &date, &place) == nil {
				name, _ = a.crypto.DecryptText(name)
				place, _ = a.crypto.DecryptText(place)
				perkaderans = append(perkaderans, map[string]any{"id": pid, "namaPerkaderan": name, "tanggal": date, "tempat": place})
				for label := range perkaderanCounts {
					if strings.EqualFold(label, strings.TrimSpace(name)) {
						perkaderanCounts[label]++
					}
				}
			}
		}
	}
	pendidikanCounts := map[string]int{"SD": 0, "MI": 0, "SMP": 0, "MTs": 0, "SMA": 0, "SMK": 0, "MAN": 0, "KULIAH": 0}
	educationRows, _ := a.pool.Query(r.Context(), `SELECT p.jenjang,count(*) FROM "Pendidikan" p JOIN "Anggota" a ON a.id=p."anggotaId" WHERE a."userId"=$1 GROUP BY p.jenjang`, id)
	if educationRows != nil {
		defer educationRows.Close()
		for educationRows.Next() {
			var level string
			var total int
			if educationRows.Scan(&level, &total) == nil {
				for label := range pendidikanCounts {
					if strings.EqualFold(label, level) {
						pendidikanCounts[label] = total
					}
				}
			}
		}
	}
	data["perkaderanCounts"], data["pendidikanCounts"], data["perkaderans"] = perkaderanCounts, pendidikanCounts, perkaderans
	httpx.JSON(w, 200, map[string]any{"data": data})
}

func (a *API) userStats(w http.ResponseWriter, r *http.Request) {
	var total, active, verified int
	_ = a.pool.QueryRow(r.Context(), `SELECT count(*),count(*) FILTER (WHERE "isActive"),count(*) FILTER (WHERE "emailVerified") FROM "User" WHERE role='SEKRETARIS_PAC'`).Scan(&total, &active, &verified)
	httpx.JSON(w, http.StatusOK, map[string]any{"data": map[string]int{"total": total, "aktif": active, "nonaktif": total - active, "terverifikasi": verified, "belumVerifikasi": total - verified}})
}

func (a *API) userStatus(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	var input struct {
		IsActive bool `json:"isActive"`
	}
	if !httpx.Decode(w, r, &input) {
		return
	}
	id := chi.URLParam(r, "id")
	if id == u.ID {
		httpx.Error(w, 409, "SELF_UPDATE", "Status akun sendiri tidak dapat diubah")
		return
	}
	tag, err := a.pool.Exec(r.Context(), `UPDATE "User" SET "isActive"=$1,"updatedAt"=now() WHERE id=$2 AND role='SEKRETARIS_PAC'`, input.IsActive, id)
	if err != nil {
		a.dbError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		a.dbError(w, pgx.ErrNoRows)
		return
	}
	a.sideEffect(r, "user", "UPDATE", map[string]any{"id": id})
	httpx.JSON(w, 200, map[string]string{"message": "Status pengguna berhasil diperbarui"})
}

func (a *API) deleteUser(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	id := chi.URLParam(r, "id")
	if id == u.ID {
		httpx.Error(w, 409, "SELF_DELETE", "Akun sendiri tidak dapat dihapus")
		return
	}
	tag, err := a.pool.Exec(r.Context(), `DELETE FROM "User" WHERE id=$1 AND role='SEKRETARIS_PAC'`, id)
	if err != nil {
		a.dbError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		a.dbError(w, pgx.ErrNoRows)
		return
	}
	a.sideEffect(r, "user", "DELETE", map[string]any{"id": id})
	httpx.JSON(w, 200, map[string]string{"message": "Pengguna berhasil dihapus"})
}
