package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/ipnu-ippnu/laci/backend/internal/cryptox"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
	"github.com/ipnu-ippnu/laci/backend/internal/idgen"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Resource struct {
	Table         string
	Columns       map[string]string // API field -> optional PostgreSQL cast
	Encrypted     []string
	Owner, Period bool
	Order         string
}

var Resources = map[string]Resource{
	"wilayah":          {"Wilayah", map[string]string{"jenis": "\"JenisWilayah\"", "nama": "", "ketua": "", "kontak": "", "alamat": ""}, []string{}, true, true, "\"createdAt\" DESC"},
	"anggota":          {"Anggota", map[string]string{"wilayahId": "", "nik": "", "nia": "", "email": "", "foto": "", "namaLengkap": "", "tempatLahir": "", "tanggalLahir": "timestamptz", "jenisKelamin": "\"JenisKelamin\"", "alamatLengkap": "", "noHp": "", "hobi": "", "jabatan": "", "noRfid": "", "pekerjaan": "", "jenjangPendidikan": "", "namaInstansiPendidikan": "", "status": "\"StatusVerifikasi\"", "alasanPenolakan": ""}, []string{"nik", "nia", "namaLengkap", "tempatLahir", "alamatLengkap", "noHp", "hobi", "jabatan", "noRfid", "pekerjaan", "namaInstansiPendidikan", "alasanPenolakan"}, true, true, "\"createdAt\" DESC"},
	"agenda-kegiatan":  {"AgendaKegiatan", map[string]string{"judul": "", "deskripsi": "", "lokasi": "", "warna": "", "tanggalMulai": "timestamptz", "tanggalSelesai": "timestamptz"}, []string{"judul", "deskripsi", "lokasi"}, true, true, "\"tanggalMulai\" DESC"},
	"arsip":            {"ArsipSurat", map[string]string{"noSurat": "", "jenisSurat": "\"JenisSurat\"", "tanggal": "timestamptz", "pengirimPenerima": "", "deskripsi": "", "file": "", "perihal": "", "organisasi": "\"Organisasi\""}, []string{"noSurat", "pengirimPenerima", "deskripsi", "perihal"}, true, true, "\"tanggal\" DESC"},
	"berkas-pimpinan":  {"BerkasPimpinan", map[string]string{"nama": "", "tanggal": "timestamptz", "catatan": "", "file": ""}, []string{"nama", "catatan"}, true, true, "\"tanggal\" DESC"},
	"berkas-sp":        {"BerkasSP", map[string]string{"nama": "", "tanggalMulai": "timestamptz", "tanggalBerakhir": "timestamptz", "catatan": "", "file": "", "organisasi": "\"Organisasi\""}, []string{"nama", "catatan"}, true, true, "\"tanggalMulai\" DESC"},
	"pengajuan-berkas": {"PengajuanBerkas", map[string]string{"periodeIdPac": "", "noSurat": "", "penerima": "\"PenerimaSurat\"", "tanggal": "timestamptz", "keperluan": "", "deskripsi": "", "file": "", "status": "\"StatusPengajuan\"", "alasanPenolakan": ""}, []string{"noSurat", "keperluan", "deskripsi", "alasanPenolakan"}, true, true, "\"createdAt\" DESC"},
	"presensi":         {"Presensi", map[string]string{"namaKegiatan": "", "tempat": "", "penyelenggara": "", "tanggal": "timestamptz", "jamMulai": "", "jamSelesai": "", "isActive": "boolean", "isForcedOpen": "boolean", "forcedOpenAt": "timestamptz"}, []string{}, true, true, "\"tanggal\" DESC"},
}

type Store struct {
	Pool   *pgxpool.Pool
	Crypto *cryptox.Service
}

func New(pool *pgxpool.Pool, crypto *cryptox.Service) *Store {
	return &Store{Pool: pool, Crypto: crypto}
}

func (s *Store) ActivePeriod(ctx context.Context, user identity.User) (string, error) {
	var id string
	err := s.Pool.QueryRow(ctx, `SELECT id FROM "Periode" WHERE "userId"=$1 AND "isActive"=true ORDER BY "updatedAt" DESC,"createdAt" DESC LIMIT 1`, user.ID).Scan(&id)
	if err != nil {
		return "", errors.New("Tidak ada periode aktif")
	}
	return id, nil
}

func (s *Store) ReadPeriod(ctx context.Context, user identity.User, requested string) (string, error) {
	if requested != "" {
		var id string
		if err := s.Pool.QueryRow(ctx, `SELECT id FROM "Periode" WHERE id=$1 AND "userId"=$2`, requested, user.ID).Scan(&id); err == nil {
			return id, nil
		}
	}
	// Pilihan tampilan yang kosong atau sudah tidak valid selalu kembali ke
	// periode aktif. Cookie lama tidak boleh membuat seluruh modul gagal 409.
	return s.ActivePeriod(ctx, user)
}

func (s *Store) List(ctx context.Context, key string, user identity.User, period string, limit, offset int) ([]map[string]any, int, error) {
	r, ok := Resources[key]
	if !ok {
		return nil, 0, errors.New("resource not found")
	}
	if key == "anggota" {
		return s.listAnggota(ctx, user, period, limit, offset)
	}
	where, args := []string{"TRUE"}, []any{}
	crossPeriod := user.IsCabang() && (key == "anggota" || key == "wilayah")
	if r.Owner && !crossPeriod && !(key == "pengajuan-berkas" && user.IsCabang()) {
		args = append(args, user.ID)
		where = append(where, fmt.Sprintf(`"userId"=$%d`, len(args)))
	}
	if r.Period {
		args = append(args, period)
		placeholder := fmt.Sprintf("$%d", len(args))
		switch {
		case crossPeriod:
			where = append(where, fmt.Sprintf(`"periodeId" IN (SELECT id FROM "Periode" WHERE nama=(SELECT nama FROM "Periode" WHERE id=%s))`, placeholder))
		case key == "pengajuan-berkas" && !user.IsCabang():
			where = append(where, fmt.Sprintf(`"periodeIdPac"=%s`, placeholder))
		default:
			where = append(where, fmt.Sprintf(`"periodeId"=%s`, placeholder))
		}
	}
	var count int
	if err := s.Pool.QueryRow(ctx, fmt.Sprintf(`SELECT count(*) FROM %s WHERE %s`, qi(r.Table), strings.Join(where, " AND ")), args...).Scan(&count); err != nil {
		return nil, 0, err
	}
	args = append(args, limit, offset)
	selectSQL := "to_jsonb(t)"
	fromSQL := qi(r.Table) + " t"
	orderSQL := r.Order
	if key == "pengajuan-berkas" {
		// The application list can search and sort by its owner. Include that
		// relation in every candidate row before the API filters and paginates
		// the decrypted result set; the remaining period relations are enriched
		// only for the final page.
		selectSQL += ` || jsonb_build_object('user',jsonb_build_object('id',owner.id,'name',owner.name,'email',owner.email))`
		fromSQL += ` JOIN "User" owner ON owner.id=t."userId"`
		orderSQL = `t."createdAt" DESC`
	}
	q := fmt.Sprintf(`SELECT %s FROM %s WHERE %s ORDER BY %s LIMIT $%d OFFSET $%d`, selectSQL, fromSQL, strings.Join(where, " AND "), orderSQL, len(args)-1, len(args))
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return nil, 0, err
		}
		var item map[string]any
		if err := json.Unmarshal(raw, &item); err != nil {
			return nil, 0, err
		}
		if err := s.decrypt(r, item); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, count, rows.Err()
}

// listAnggota reads the period assignment instead of the legacy snapshot on
// Anggota. This keeps historical memberships visible while the master member
// record can still point at the latest assignment for detail views.
func (s *Store) listAnggota(ctx context.Context, user identity.User, period string, limit, offset int) ([]map[string]any, int, error) {
	where := []string{"ap.\"periodeId\"=$1"}
	args := []any{period}
	if user.IsCabang() {
		where[0] = `ap."periodeId" IN (SELECT id FROM "Periode" WHERE nama=(SELECT nama FROM "Periode" WHERE id=$1))`
	} else {
		where = append(where, `ap."userId"=$2`)
		args = append(args, user.ID)
	}
	whereSQL := strings.Join(where, " AND ")
	countQuery := fmt.Sprintf(`SELECT count(*) FROM "AnggotaPeriode" ap WHERE %s`, whereSQL)
	var count int
	if err := s.Pool.QueryRow(ctx, countQuery, args...).Scan(&count); err != nil {
		return nil, 0, err
	}
	args = append(args, limit, offset)
	query := fmt.Sprintf(`
		SELECT to_jsonb(a) || jsonb_build_object(
			'userId',ap."userId",
			'periodeId',ap."periodeId",
			'wilayahId',ap."wilayahId",
			'status',ap.status,
			'alasanPenolakan',ap."alasanPenolakan",
			'user',jsonb_build_object('id',u.id,'name',u.name),
			'periode',jsonb_build_object('id',p.id,'nama',p.nama),
			'wilayah',CASE WHEN w.id IS NULL THEN NULL ELSE jsonb_build_object('id',w.id,'nama',w.nama,'jenis',w.jenis) END
		) AS item
		FROM "AnggotaPeriode" ap
		JOIN "Anggota" a ON a.id=ap."anggotaId"
		JOIN "User" u ON u.id=ap."userId"
		JOIN "Periode" p ON p.id=ap."periodeId"
		LEFT JOIN "Wilayah" w ON w.id=ap."wilayahId"
		WHERE %s
		ORDER BY a."namaLengkap" ASC, ap."createdAt" DESC
		LIMIT $%d OFFSET $%d`, whereSQL, len(args)-1, len(args))
	rows, err := s.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return nil, 0, err
		}
		var item map[string]any
		if err := json.Unmarshal(raw, &item); err != nil {
			return nil, 0, err
		}
		if err := s.decrypt(Resources["anggota"], item); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, count, rows.Err()
}

func (s *Store) Enrich(ctx context.Context, key string, item map[string]any) error {
	id, _ := item["id"].(string)
	if id == "" {
		return nil
	}
	readJSON := func(query string, args ...any) (any, error) {
		var raw []byte
		if err := s.Pool.QueryRow(ctx, query, args...).Scan(&raw); err != nil {
			return nil, err
		}
		var value any
		if err := json.Unmarshal(raw, &value); err != nil {
			return nil, err
		}
		return value, nil
	}
	switch key {
	case "wilayah":
		value, err := readJSON(`SELECT jsonb_build_object('id',u.id,'name',u.name) FROM "Wilayah" w JOIN "User" u ON u.id=w."userId" WHERE w.id=$1`, id)
		if err == nil {
			item["user"] = value
		}
		return err
	case "anggota":
		periodID := strings.TrimSpace(fmt.Sprint(item["periodeId"]))
		value, err := readJSON(`SELECT jsonb_build_object('user',jsonb_build_object('id',u.id,'name',u.name),'periode',jsonb_build_object('id',p.id,'nama',p.nama),'wilayah',CASE WHEN w.id IS NULL THEN NULL ELSE jsonb_build_object('id',w.id,'nama',w.nama,'jenis',w.jenis) END,'pendidikans',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x."createdAt") FROM "Pendidikan" x WHERE x."anggotaId"=a.id),'[]'::jsonb),'perkaderans',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.tanggal) FROM "Perkaderan" x WHERE x."anggotaId"=a.id),'[]'::jsonb)) FROM "Anggota" a JOIN "AnggotaPeriode" ap ON ap."anggotaId"=a.id AND ap."periodeId"=$2 JOIN "User" u ON u.id=ap."userId" JOIN "Periode" p ON p.id=ap."periodeId" LEFT JOIN "Wilayah" w ON w.id=ap."wilayahId" WHERE a.id=$1`, id, periodID)
		if err != nil && periodID == "" {
			value, err = readJSON(`SELECT jsonb_build_object('user',jsonb_build_object('id',u.id,'name',u.name),'periode',jsonb_build_object('id',p.id,'nama',p.nama),'wilayah',CASE WHEN w.id IS NULL THEN NULL ELSE jsonb_build_object('id',w.id,'nama',w.nama,'jenis',w.jenis) END,'pendidikans',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x."createdAt") FROM "Pendidikan" x WHERE x."anggotaId"=a.id),'[]'::jsonb),'perkaderans',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.tanggal) FROM "Perkaderan" x WHERE x."anggotaId"=a.id),'[]'::jsonb)) FROM "Anggota" a JOIN "User" u ON u.id=a."userId" JOIN "Periode" p ON p.id=a."periodeId" LEFT JOIN "Wilayah" w ON w.id=a."wilayahId" WHERE a.id=$1`, id)
		}
		if err != nil {
			return err
		}
		relations := value.(map[string]any)
		for k, v := range relations {
			item[k] = v
		}
		for _, name := range []string{"pendidikans", "perkaderans"} {
			if rows, ok := item[name].([]any); ok {
				for _, row := range rows {
					m, _ := row.(map[string]any)
					fields := []string{"namaSekolah"}
					if name == "perkaderans" {
						fields = []string{"namaPerkaderan", "tempat"}
					}
					for _, f := range fields {
						if text, ok := m[f].(string); ok {
							m[f], _ = s.Crypto.DecryptText(text)
						}
					}
				}
			}
		}
		return nil
	case "pengajuan-berkas":
		value, err := readJSON(`SELECT jsonb_build_object('user',jsonb_build_object('id',u.id,'name',u.name,'email',u.email),'periodePac',jsonb_build_object('id',pp.id,'nama',pp.nama),'periodeCabang',jsonb_build_object('id',pc.id,'nama',pc.nama)) FROM "PengajuanBerkas" x JOIN "User" u ON u.id=x."userId" JOIN "Periode" pp ON pp.id=x."periodeIdPac" JOIN "Periode" pc ON pc.id=x."periodeId" WHERE x.id=$1`, id)
		if err != nil {
			return err
		}
		for k, v := range value.(map[string]any) {
			item[k] = v
		}
		return nil
	case "presensi":
		var count int
		if err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM "PresensiData" WHERE "presensiId"=$1`, id).Scan(&count); err != nil {
			return err
		}
		item["_count"] = map[string]int{"dataPresensi": count}
		return nil
	case "berkas-sp", "berkas-pimpinan", "arsip", "agenda-kegiatan":
		res := Resources[key]
		value, err := readJSON(fmt.Sprintf(`SELECT jsonb_build_object('periode',jsonb_build_object('id',p.id,'nama',p.nama),'user',jsonb_build_object('id',u.id,'name',u.name)) FROM %s x JOIN "Periode" p ON p.id=x."periodeId" JOIN "User" u ON u.id=x."userId" WHERE x.id=$1`, qi(res.Table)), id)
		if err == nil {
			for k, v := range value.(map[string]any) {
				item[k] = v
			}
		}
		return err
	}
	return nil
}

func (s *Store) Get(ctx context.Context, key, id string) (map[string]any, error) {
	r, ok := Resources[key]
	if !ok {
		return nil, errors.New("resource not found")
	}
	var raw []byte
	if err := s.Pool.QueryRow(ctx, fmt.Sprintf(`SELECT to_jsonb(t) FROM %s t WHERE id=$1`, qi(r.Table)), id).Scan(&raw); err != nil {
		return nil, err
	}
	var item map[string]any
	if err := json.Unmarshal(raw, &item); err != nil {
		return nil, err
	}
	if err := s.decrypt(r, item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Store) GetAnggotaPeriod(ctx context.Context, id, period string) (map[string]any, error) {
	var raw []byte
	err := s.Pool.QueryRow(ctx, `
		SELECT to_jsonb(a) || jsonb_build_object(
			'userId',ap."userId", 'periodeId',ap."periodeId", 'wilayahId',ap."wilayahId",
			'status',ap.status, 'alasanPenolakan',ap."alasanPenolakan",
			'periode',jsonb_build_object('id',p.id,'nama',p.nama),
			'wilayah',CASE WHEN w.id IS NULL THEN NULL ELSE jsonb_build_object('id',w.id,'nama',w.nama,'jenis',w.jenis) END
		)
		FROM "Anggota" a
		JOIN "Periode" selected ON selected.id=$2
		JOIN "User" selectedOwner ON selectedOwner.id=selected."userId"
		JOIN "AnggotaPeriode" ap ON ap."anggotaId"=a.id AND (
			ap."periodeId"=$2 OR (
				selectedOwner.role='SEKRETARIS_CABANG' AND
				ap."periodeId" IN (SELECT id FROM "Periode" WHERE nama=selected.nama)
			)
		)
		JOIN "Periode" p ON p.id=ap."periodeId"
		LEFT JOIN "Wilayah" w ON w.id=ap."wilayahId"
		WHERE a.id=$1`, id, period).Scan(&raw)
	if err != nil {
		return nil, err
	}
	var item map[string]any
	if err := json.Unmarshal(raw, &item); err != nil {
		return nil, err
	}
	if err := s.decrypt(Resources["anggota"], item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Store) All(ctx context.Context, key string) ([]map[string]any, error) {
	resource, ok := Resources[key]
	if !ok {
		return nil, errors.New("resource not found")
	}
	rows, err := s.Pool.Query(ctx, fmt.Sprintf(`SELECT to_jsonb(t) FROM %s t ORDER BY %s`, qi(resource.Table), resource.Order))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		var item map[string]any
		if err := json.Unmarshal(raw, &item); err != nil {
			return nil, err
		}
		if err := s.decrypt(resource, item); err != nil {
			return nil, err
		}
		_ = s.Enrich(ctx, key, item)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) Create(ctx context.Context, key string, user identity.User, period string, input map[string]any) (map[string]any, error) {
	r, ok := Resources[key]
	if !ok {
		return nil, errors.New("resource not found")
	}
	input = copyMap(input)
	if err := s.encrypt(r, input); err != nil {
		return nil, err
	}
	input["id"] = newID()
	input["createdAt"] = time.Now()
	input["updatedAt"] = time.Now()
	if r.Owner {
		input["userId"] = user.ID
	}
	if r.Period {
		input["periodeId"] = period
	}
	cols, vals, args, err := mutationParts(r, input, true)
	if err != nil {
		return nil, err
	}
	q := fmt.Sprintf(`INSERT INTO %s (%s) VALUES (%s) RETURNING to_jsonb(%s.*)`, qi(r.Table), strings.Join(cols, ","), strings.Join(vals, ","), qi(r.Table))
	var raw []byte
	if err := s.Pool.QueryRow(ctx, q, args...).Scan(&raw); err != nil {
		return nil, err
	}
	var item map[string]any
	_ = json.Unmarshal(raw, &item)
	_ = s.decrypt(r, item)
	return item, nil
}

func (s *Store) Update(ctx context.Context, key, id string, input map[string]any) (map[string]any, error) {
	r, ok := Resources[key]
	if !ok {
		return nil, errors.New("resource not found")
	}
	input = copyMap(input)
	if err := s.encrypt(r, input); err != nil {
		return nil, err
	}
	input["updatedAt"] = time.Now()
	keys := sortedKeys(input)
	sets := []string{}
	args := []any{}
	for _, field := range keys {
		cast, allowed := allowedColumn(r, field, true)
		if !allowed {
			continue
		}
		args = append(args, input[field])
		ph := fmt.Sprintf("$%d", len(args))
		if cast != "" {
			ph += "::" + cast
		}
		sets = append(sets, qi(field)+"="+ph)
	}
	if len(sets) == 0 {
		return nil, errors.New("tidak ada field yang dapat diubah")
	}
	args = append(args, id)
	q := fmt.Sprintf(`UPDATE %s SET %s WHERE id=$%d RETURNING to_jsonb(%s.*)`, qi(r.Table), strings.Join(sets, ","), len(args), qi(r.Table))
	var raw []byte
	if err := s.Pool.QueryRow(ctx, q, args...).Scan(&raw); err != nil {
		return nil, err
	}
	var item map[string]any
	_ = json.Unmarshal(raw, &item)
	_ = s.decrypt(r, item)
	return item, nil
}

func (s *Store) Delete(ctx context.Context, key, id string) error {
	r, ok := Resources[key]
	if !ok {
		return errors.New("resource not found")
	}
	tag, err := s.Pool.Exec(ctx, fmt.Sprintf(`DELETE FROM %s WHERE id=$1`, qi(r.Table)), id)
	if err == nil && tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return err
}

func (s *Store) Owned(ctx context.Context, key, id string, user identity.User) (bool, error) {
	r, ok := Resources[key]
	if !ok {
		return false, errors.New("resource not found")
	}
	if !r.Owner {
		return true, nil
	}
	var owner string
	err := s.Pool.QueryRow(ctx, fmt.Sprintf(`SELECT "userId" FROM %s WHERE id=$1`, qi(r.Table)), id).Scan(&owner)
	return owner == user.ID, err
}

func (s *Store) decrypt(r Resource, item map[string]any) error {
	for _, f := range r.Encrypted {
		v, ok := item[f].(string)
		if !ok || v == "" {
			continue
		}
		plain, err := s.Crypto.DecryptText(v)
		if err != nil {
			return err
		}
		item[f] = plain
	}
	return nil
}
func (s *Store) encrypt(r Resource, input map[string]any) error {
	for _, f := range r.Encrypted {
		v, exists := input[f]
		if !exists || v == nil {
			continue
		}
		text, ok := v.(string)
		if !ok {
			return fmt.Errorf("%s harus string", f)
		}
		if text == "" {
			continue
		}
		encrypted, err := s.Crypto.EncryptText(text)
		if err != nil {
			return err
		}
		input[f] = encrypted
	}
	return nil
}

func mutationParts(r Resource, input map[string]any, create bool) ([]string, []string, []any, error) {
	keys := sortedKeys(input)
	cols, vals, args := []string{}, []string{}, []any{}
	for _, field := range keys {
		cast, ok := allowedColumn(r, field, create)
		if !ok {
			continue
		}
		cols = append(cols, qi(field))
		args = append(args, input[field])
		ph := fmt.Sprintf("$%d", len(args))
		if cast != "" {
			ph += "::" + cast
		}
		vals = append(vals, ph)
	}
	if len(cols) == 0 {
		return nil, nil, nil, errors.New("tidak ada field valid")
	}
	return cols, vals, args, nil
}
func allowedColumn(r Resource, field string, system bool) (string, bool) {
	if cast, ok := r.Columns[field]; ok {
		return cast, true
	}
	if system {
		switch field {
		case "id", "userId", "periodeId", "createdAt", "updatedAt":
			return "", true
		}
	}
	return "", false
}
func sortedKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
func copyMap(m map[string]any) map[string]any {
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

var identifier = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9]*$`)

func qi(value string) string {
	if !identifier.MatchString(value) {
		panic("unsafe SQL identifier")
	}
	return `"` + value + `"`
}
func newID() string { return idgen.New() }
