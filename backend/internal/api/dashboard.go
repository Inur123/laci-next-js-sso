package api

import (
	"fmt"
	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
	"net/http"
	"sort"
	"strings"
	"time"
)

func (a *API) dashboard(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	period, err := a.store.ReadPeriod(r.Context(), u, r.Header.Get("X-View-Period"))
	if err != nil {
		httpx.Error(w, 409, "NO_ACTIVE_PERIOD", err.Error())
		return
	}
	count := func(table, column string) int {
		var n int
		_ = a.pool.QueryRow(r.Context(), fmt.Sprintf(`SELECT count(*) FROM "%s" WHERE "%s"=$1 AND "userId"=$2`, table, column), period, u.ID).Scan(&n)
		return n
	}
	personal := map[string]any{"anggota": count("Anggota", "periodeId"), "surat": count("ArsipSurat", "periodeId"), "berkasPimpinan": count("BerkasPimpinan", "periodeId"), "berkasSP": count("BerkasSP", "periodeId"), "kegiatan": count("AgendaKegiatan", "periodeId"), "presensi": count("Presensi", "periodeId")}
	if u.IsCabang() {
		var n int
		_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "PengajuanBerkas" WHERE "periodeId"=$1`, period).Scan(&n)
		personal["pengajuan"] = n
	} else {
		personal["pengajuan"] = count("PengajuanBerkas", "periodeIdPac")
	}
	var userCount, periodCount, globalAnggota, globalArsip, globalPimpinan, globalPengajuan int
	_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "User" WHERE role='SEKRETARIS_PAC' AND "isActive"=true AND "emailVerified"=true`).Scan(&userCount)
	_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "Periode" WHERE "userId"=$1`, u.ID).Scan(&periodCount)
	_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "Anggota" a JOIN "Periode" p ON p.id=a."periodeId" WHERE p."isActive"=true`).Scan(&globalAnggota)
	_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "ArsipSurat" a JOIN "Periode" p ON p.id=a."periodeId" WHERE p."isActive"=true`).Scan(&globalArsip)
	_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "BerkasPimpinan" a JOIN "Periode" p ON p.id=a."periodeId" WHERE p."isActive"=true`).Scan(&globalPimpinan)
	_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "PengajuanBerkas" WHERE status='DITERIMA'`).Scan(&globalPengajuan)
	personal["userCount"] = userCount
	personal["periode"] = periodCount
	personal["globalAnggota"] = globalAnggota
	personal["globalArsip"] = globalArsip
	personal["globalPimpinan"] = globalPimpinan
	personal["globalPengajuan"] = globalPengajuan
	trend := []map[string]any{}
	for i := 5; i >= 0; i-- {
		d := time.Now().AddDate(0, -i, 0)
		var n int
		start := time.Date(d.Year(), d.Month(), 1, 0, 0, 0, 0, d.Location())
		end := start.AddDate(0, 1, 0)
		_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "ArsipSurat" WHERE "userId"=$1 AND "periodeId"=$2 AND "createdAt">=$3 AND "createdAt"<$4`, u.ID, period, start, end).Scan(&n)
		trend = append(trend, map[string]any{"name": d.Format("Jan"), "value": n})
	}
	personal["trend"] = trend
	role := "PAC"
	var monitoring any
	if u.IsCabang() {
		role = "CABANG"
		leaderboard := []map[string]any{}
		rows, _ := a.pool.Query(r.Context(), `SELECT u.id,u.name,u.image,(SELECT count(*) FROM "Anggota" a JOIN "Periode" p ON p.id=a."periodeId" WHERE a."userId"=u.id AND p."isActive"=true),(SELECT count(*) FROM "ArsipSurat" a JOIN "Periode" p ON p.id=a."periodeId" WHERE a."userId"=u.id AND p."isActive"=true),(SELECT count(*) FROM "PengajuanBerkas" x WHERE x."userId"=u.id AND x.status='DITERIMA') FROM "User" u WHERE u.role='SEKRETARIS_PAC' AND u."isActive"=true LIMIT 50`)
		if rows != nil {
			defer rows.Close()
			for rows.Next() {
				var id, name string
				var image *string
				var members, letters, applications int
				_ = rows.Scan(&id, &name, &image, &members, &letters, &applications)
				leaderboard = append(leaderboard, map[string]any{"id": id, "name": name, "image": image, "stats": map[string]int{"anggotas": members, "arsipSurats": letters, "pengajuanBerkass": applications}, "score": members + letters + applications})
			}
		}
		sort.Slice(leaderboard, func(i, j int) bool { return leaderboard[i]["score"].(int) > leaderboard[j]["score"].(int) })
		var pending int
		_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "User" WHERE role='SEKRETARIS_PAC' AND "isActive"=false`).Scan(&pending)
		perkaderan := map[string]int{"Makesta": 0, "Lakmud": 0, "Latin": 0, "Latpel": 0, "Lakut": 0, "Diklatama": 0, "Diklatmad": 0}
		rows, _ = a.pool.Query(r.Context(), `SELECT k."namaPerkaderan" FROM "Perkaderan" k JOIN "Anggota" a ON a.id=k."anggotaId" JOIN "Periode" p ON p.id=a."periodeId" WHERE p."isActive"=true`)
		if rows != nil {
			for rows.Next() {
				var encrypted string
				_ = rows.Scan(&encrypted)
				name, _ := a.crypto.DecryptText(encrypted)
				for label := range perkaderan {
					if strings.EqualFold(label, strings.TrimSpace(name)) {
						perkaderan[label]++
					}
				}
			}
			rows.Close()
		}
		pendidikan := map[string]int{"SD": 0, "MI": 0, "SMP": 0, "MTs": 0, "SMA": 0, "SMK": 0, "MAN": 0, "KULIAH": 0}
		rows, _ = a.pool.Query(r.Context(), `SELECT e.jenjang,count(*) FROM "Pendidikan" e JOIN "Anggota" a ON a.id=e."anggotaId" JOIN "Periode" p ON p.id=a."periodeId" WHERE p."isActive"=true GROUP BY e.jenjang`)
		if rows != nil {
			for rows.Next() {
				var level string
				var total int
				_ = rows.Scan(&level, &total)
				for label := range pendidikan {
					if strings.EqualFold(label, level) {
						pendidikan[label] = total
					}
				}
			}
			rows.Close()
		}
		monitoring = map[string]any{"leaderboard": leaderboard, "global": map[string]any{"totalAnggota": globalAnggota, "totalSurat": globalArsip + globalPimpinan + globalPengajuan, "totalPAC": userCount, "verifikasiPending": pending, "perkaderan": perkaderan, "pendidikan": pendidikan}}
	}
	httpx.JSON(w, 200, map[string]any{"data": map[string]any{"role": role, "emailVerified": u.EmailVerified, "personal": personal, "monitoring": monitoring}})
}
