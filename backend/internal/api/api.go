package api

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/ipnu-ippnu/laci/backend/internal/config"
	"github.com/ipnu-ippnu/laci/backend/internal/cryptox"
	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
	"github.com/ipnu-ippnu/laci/backend/internal/idgen"
	"github.com/ipnu-ippnu/laci/backend/internal/mailer"
	"github.com/ipnu-ippnu/laci/backend/internal/realtime"
	"github.com/ipnu-ippnu/laci/backend/internal/storage"
	"github.com/ipnu-ippnu/laci/backend/internal/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type API struct {
	cfg     config.Config
	pool    *pgxpool.Pool
	auth    *identity.Authenticator
	store   *store.Store
	crypto  *cryptox.Service
	storage *storage.Service
	mailer  *mailer.Service
	hub     *realtime.Hub
}

func New(cfg config.Config, pool *pgxpool.Pool, auth *identity.Authenticator, crypto *cryptox.Service, objects *storage.Service, mail *mailer.Service, hub *realtime.Hub) *API {
	return &API{cfg: cfg, pool: pool, auth: auth, store: store.New(pool, crypto), crypto: crypto, storage: objects, mailer: mail, hub: hub}
}

func (a *API) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Recoverer, requestTimeout(30*time.Second), a.cors)
	r.Get("/health/live", func(w http.ResponseWriter, r *http.Request) {
		httpx.JSON(w, 200, map[string]any{"status": "ok", "service": "laci-api"})
	})
	r.Get("/health/ready", a.ready)
	r.Get("/openapi.json", a.openapi)
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/auth/login", a.login)
		r.Get("/auth/mobile/login", a.mobileLogin)
		r.Post("/auth/mobile/exchange", a.mobileExchange)
		r.Post("/auth/mobile/logout", a.mobileLogout)
		r.Get("/auth/callback", a.authCallback)
		r.Get("/auth/logout", a.logout)
		r.Post("/auth/logout", a.logout)
		r.Get("/public/stats", a.publicStats)
		r.Get("/public/agenda", a.publicAgenda)
		r.Get("/public/wilayah", a.publicWilayah)
		r.Get("/public/organisasi", a.apiKey(a.publicOrganizations))
		r.Get("/public/phbi", a.publicPHBI)
		r.Get("/public/data", a.apiKey(a.integrationData))
		r.Get("/public/presensi/{id}", a.publicPresensi)
		r.Post("/public/anggota", a.apiKey(a.publicAnggota))
		r.Post("/public/presensi/{id}/participants", a.publicParticipant)
		r.Get("/public/presensi/participants/{participantID}", a.publicParticipantDetail)
		r.Post("/cron/backups", a.cronBackup)
		r.Group(func(r chi.Router) {
			r.Use(a.auth.Middleware)
			// Dashboard and Profile are intentionally available to authenticated
			// accounts whose SSO email has not been verified yet. Every other
			// internal module is mounted behind RequireVerified below.
			r.Get("/me", a.me)
			r.Post("/me/sync", a.syncMe)
			r.Patch("/me", a.updateMe)
			r.Post("/files", a.uploadFile)
			r.Get("/images/users/{id}", a.userImage)
			r.Get("/realtime", a.hub.ServeHTTP)
			r.Get("/dashboard", a.dashboard)
			r.Route("/periods", func(r chi.Router) {
				r.Get("/", a.listPeriods)
				r.Get("/{id}", a.getPeriod)
				r.Group(func(r chi.Router) {
					r.Use(identity.RequireVerified)
					r.Post("/", a.createPeriod)
					r.Patch("/{id}", a.updatePeriod)
					r.Delete("/{id}", a.deletePeriod)
					r.Post("/{id}/activate", a.activatePeriod)
				})
			})
			r.Group(func(r chi.Router) {
				r.Use(identity.RequireVerified)
				r.Get("/directory/users", a.directoryUsers)
				r.Get("/images/anggota/{id}", a.memberImage)
				for _, key := range []string{"wilayah", "agenda-kegiatan", "arsip", "berkas-pimpinan", "berkas-sp", "pengajuan-berkas", "presensi"} {
					a.mountResource(r, key)
				}
				// Data anggota berasal dari sistem eksternal. UI aplikasi hanya dapat
				// membaca data; perubahan status memiliki endpoint khusus Cabang.
				r.Route("/anggota", func(r chi.Router) {
					r.Get("/", a.listResource("anggota"))
					r.Get("/stats", a.resourceStats("anggota"))
					r.Get("/{id}", a.getResource("anggota"))
				})
				r.Post("/anggota/copy-period", a.copyMembersToPeriod)
				r.Post("/wilayah/copy", a.copyWilayah)
				r.Patch("/anggota/{id}/status", a.memberStatus)
				r.Get("/presensi/{id}/participants", a.listParticipants)
				r.Get("/presensi/participants/{participantID}", a.getParticipant)
				r.Patch("/pengajuan-berkas/{id}/status", a.applicationStatus)
				r.Post("/imports/{resource}", a.bulkImport)
				r.Post("/exports/log", a.logExport)
				r.Get("/activity-logs", a.activityLogs)
				r.Get("/activity-logs/stats", a.activityLogStats)
				r.Get("/activity-logs/monitoring", a.activityLogMonitoring)
				r.Get("/activity-logs/{id}", a.activityLog)
				r.Group(func(r chi.Router) {
					r.Use(identity.RequireCabang)
					r.Get("/users", a.users)
					r.Get("/users/stats", a.userStats)
					r.Get("/users/{id}", a.userDetail)
					r.Patch("/users/{id}/status", a.userStatus)
					r.Delete("/users/{id}", a.deleteUser)
					r.Get("/email-logs", a.emailLogs)
					r.Get("/email-logs/stats", a.emailStats)
					r.Post("/email-logs/{id}/retry", a.retryEmail)
					r.Get("/backups", a.backups)
					r.Post("/backups", a.createBackup)
					r.Delete("/backups", a.deleteBackup)
					r.Get("/backups/url", a.backupURL)
				})
			})
		})
	})
	return r
}

func (a *API) mountResource(r chi.Router, key string) {
	path := "/" + key
	r.Route(path, func(r chi.Router) {
		if key == "agenda-kegiatan" || key == "berkas-sp" {
			r.Use(identity.RequireCabang)
		}
		r.Get("/", a.listResource(key))
		r.Post("/", a.createResource(key))
		r.Get("/stats", a.resourceStats(key))
		r.Get("/{id}", a.getResource(key))
		r.Patch("/{id}", a.updateResource(key))
		r.Delete("/{id}", a.deleteResource(key))
		r.Get("/{id}/download", a.download(key))
		r.Post("/{id}/download-token", a.downloadToken(key))
	})
}

func (a *API) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if strings.HasPrefix(r.URL.Path, "/api/v1/public/") && origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		} else if origin == a.cfg.FrontendURL {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key, X-View-Period, X-Client-Location")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *API) ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := a.pool.Ping(ctx); err != nil {
		httpx.Error(w, 503, "DATABASE_UNAVAILABLE", "Database tidak tersedia")
		return
	}
	httpx.JSON(w, 200, map[string]string{"status": "ready"})
}
func (a *API) me(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	httpx.JSON(w, 200, map[string]any{"data": u})
}

func (a *API) syncMe(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	refreshed, err := a.auth.RefreshSSOProfile(r.Context(), u.ID)
	if err != nil {
		slog.Warn("sync SSO profile", "userId", u.ID, "error", err)
		httpx.Error(w, http.StatusBadGateway, "SSO_PROFILE_SYNC_FAILED", "Profil SSO belum dapat disinkronkan")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": refreshed})
}

func (a *API) listResource(key string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, _ := identity.FromContext(r.Context())
		page, limit, _ := httpx.Pagination(r)
		period, err := a.store.ReadPeriod(r.Context(), u, r.Header.Get("X-View-Period"))
		if err != nil {
			httpx.Error(w, 409, "NO_ACTIVE_PERIOD", err.Error())
			return
		}
		listUser := u
		if key == "pengajuan-berkas" && r.URL.Query().Get("scope") == "reference" && !u.IsCabang() {
			if err := a.pool.QueryRow(r.Context(), `SELECT p.id FROM "Periode" p JOIN "User" u ON u.id=p."userId" WHERE p."isActive"=true AND u.role='SEKRETARIS_CABANG' ORDER BY p."createdAt" LIMIT 1`).Scan(&period); err != nil {
				httpx.Error(w, 409, "NO_CABANG_PERIOD", "Tidak ada periode aktif Cabang")
				return
			}
			listUser.Role = "SEKRETARIS_CABANG"
		}
		cap := 2000
		if key == "anggota" {
			cap = 3000
		}
		items, _, err := a.store.List(r.Context(), key, listUser, period, cap, 0)
		if err != nil {
			a.dbError(w, err)
			return
		}
		items = filterAndSort(key, items, r)
		total := len(items)
		start := (page - 1) * limit
		if start > total {
			start = total
		}
		end := start + limit
		if end > total {
			end = total
		}
		items = items[start:end]
		for _, item := range items {
			_ = a.store.Enrich(r.Context(), key, item)
		}
		httpx.JSON(w, 200, map[string]any{"data": items, "pagination": map[string]any{"page": page, "limit": limit, "total": total, "totalPages": (total + limit - 1) / limit}})
	}
}

func filterAndSort(key string, items []map[string]any, r *http.Request) []map[string]any {
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("search")))
	fields := map[string][]string{"wilayah": {"nama", "ketua"}, "anggota": {"namaLengkap", "jabatan", "nik", "nia", "noHp"}, "agenda-kegiatan": {"judul", "deskripsi", "lokasi"}, "arsip": {"noSurat", "perihal", "pengirimPenerima", "deskripsi"}, "berkas-pimpinan": {"nama", "catatan"}, "berkas-sp": {"nama", "catatan", "organisasi"}, "pengajuan-berkas": {"noSurat", "keperluan", "user"}, "presensi": {"namaKegiatan", "tempat", "penyelenggara"}}[key]
	filtered := make([]map[string]any, 0, len(items))
	now := time.Now()
	for _, item := range items {
		if key == "agenda-kegiatan" {
			item["status"] = agendaStatus(item, now)
		}
		if key == "berkas-sp" {
			item["status"] = berkasSPStatus(item, now)
		}
		match := q == ""
		for _, f := range fields {
			if strings.Contains(strings.ToLower(sortValue(item, f)), q) {
				match = true
				break
			}
		}
		if !match {
			continue
		}
		if userID := r.URL.Query().Get("userId"); userID != "" && userID != "ALL" && fmt.Sprint(item["userId"]) != userID {
			continue
		}
		valid := true
		for _, f := range []string{"status", "organisasi", "jenisSurat", "jenis", "penerima"} {
			want := r.URL.Query().Get(f)
			actual := fmt.Sprint(item[f])
			if key == "presensi" && f == "status" && want != "" && want != "ALL" {
				date, _ := time.Parse(time.RFC3339, fmt.Sprint(item["tanggal"]))
				open := isOpen(date, fmt.Sprint(item["jamMulai"]), fmt.Sprint(item["jamSelesai"]), item["isActive"] == true)
				if (want == "OPEN") != open {
					valid = false
					break
				}
				continue
			}
			if want != "" && want != "ALL" && actual != want {
				valid = false
				break
			}
		}
		if valid {
			filtered = append(filtered, item)
		}
	}
	sortKey := r.URL.Query().Get("sortKey")
	if sortKey == "" {
		return filtered
	}
	asc := r.URL.Query().Get("sortDir") == "asc"
	sort.SliceStable(filtered, func(i, j int) bool {
		left, right := sortValue(filtered[i], sortKey), sortValue(filtered[j], sortKey)
		if strings.HasPrefix(sortKey, "tanggal") || sortKey == "createdAt" {
			lt, _ := time.Parse(time.RFC3339, left)
			rt, _ := time.Parse(time.RFC3339, right)
			if asc {
				return lt.Before(rt)
			}
			return lt.After(rt)
		}
		if asc {
			return strings.ToLower(left) < strings.ToLower(right)
		}
		return strings.ToLower(left) > strings.ToLower(right)
	})
	return filtered
}

func sortValue(item map[string]any, key string) string {
	if key == "pengaju" {
		key = "user"
	}
	value := item[key]
	if nested, ok := value.(map[string]any); ok {
		for _, field := range []string{"name", "nama", "label", "id"} {
			if text := strings.TrimSpace(fmt.Sprint(nested[field])); text != "" && text != "<nil>" {
				return text
			}
		}
		return ""
	}
	if value == nil {
		return ""
	}
	return fmt.Sprint(value)
}

func agendaStatus(item map[string]any, now time.Time) string {
	start, err := time.Parse(time.RFC3339, fmt.Sprint(item["tanggalMulai"]))
	if err != nil {
		return ""
	}
	end := start.Add(24 * time.Hour)
	if raw := fmt.Sprint(item["tanggalSelesai"]); raw != "<nil>" && raw != "" {
		if parsed, parseErr := time.Parse(time.RFC3339, raw); parseErr == nil {
			end = parsed
		}
	}
	if now.Before(start) {
		return "MENDATANG"
	}
	if now.After(end) {
		return "SELESAI"
	}
	return "BERLANGSUNG"
}

func berkasSPStatus(item map[string]any, now time.Time) string {
	end, err := time.Parse(time.RFC3339, fmt.Sprint(item["tanggalBerakhir"]))
	if err != nil {
		return ""
	}
	location, locationErr := time.LoadLocation("Asia/Jakarta")
	if locationErr != nil {
		location = time.UTC
	}
	today := now.In(location)
	end = end.In(location)
	today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, location)
	end = time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, location)
	days := int(end.Sub(today).Hours() / 24)
	if days < 0 {
		return "KEDALUWARSA"
	}
	if days <= 30 {
		return "HAMPIR_HABIS"
	}
	return "AKTIF"
}

func (a *API) getResource(key string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, _ := identity.FromContext(r.Context())
		id := chi.URLParam(r, "id")
		owned, err := a.store.Owned(r.Context(), key, id, u)
		if err != nil {
			a.dbError(w, err)
			return
		}
		if !owned && !u.IsCabang() {
			allowedReference := false
			if key == "pengajuan-berkas" && r.URL.Query().Get("scope") == "reference" {
				var exists bool
				_ = a.pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "PengajuanBerkas" x JOIN "Periode" p ON p.id=x."periodeId" JOIN "User" owner ON owner.id=p."userId" WHERE x.id=$1 AND p."isActive"=true AND owner.role='SEKRETARIS_CABANG')`, id).Scan(&exists)
				allowedReference = exists
			}
			if !allowedReference {
				httpx.Error(w, 403, "FORBIDDEN", "Data bukan milik Anda")
				return
			}
		}
		var item map[string]any
		if key == "anggota" {
			period, periodErr := a.store.ReadPeriod(r.Context(), u, r.Header.Get("X-View-Period"))
			if periodErr != nil {
				httpx.Error(w, 409, "NO_ACTIVE_PERIOD", periodErr.Error())
				return
			}
			item, err = a.store.GetAnggotaPeriod(r.Context(), id, period)
		} else {
			item, err = a.store.Get(r.Context(), key, id)
		}
		if err != nil {
			a.dbError(w, err)
			return
		}
		_ = a.store.Enrich(r.Context(), key, item)
		if key == "agenda-kegiatan" {
			item["status"] = agendaStatus(item, time.Now())
		}
		if key == "berkas-sp" {
			item["status"] = berkasSPStatus(item, time.Now())
		}
		httpx.JSON(w, 200, map[string]any{"data": item})
	}
}
func (a *API) createResource(key string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, _ := identity.FromContext(r.Context())
		if (key == "agenda-kegiatan" || key == "berkas-sp") && !u.IsCabang() {
			httpx.Error(w, 403, "FORBIDDEN", "Akses hanya untuk Sekretaris Cabang")
			return
		}
		if key == "pengajuan-berkas" && u.IsCabang() {
			httpx.Error(w, 403, "FORBIDDEN", "Pengajuan hanya dapat dibuat PAC")
			return
		}
		var input map[string]any
		if !httpx.Decode(w, r, &input) {
			return
		}
		if fields := validateResource(key, input, true); len(fields) > 0 {
			httpx.Error(w, 422, "VALIDATION_ERROR", "Data belum lengkap", fields)
			return
		}
		period, err := a.store.ActivePeriod(r.Context(), u)
		if err != nil {
			httpx.Error(w, 409, "NO_ACTIVE_PERIOD", err.Error())
			return
		}
		if key == "pengajuan-berkas" {
			input["status"] = "PENDING"
			input["periodeIdPac"] = period
			var cabangPeriod string
			if err := a.pool.QueryRow(r.Context(), `SELECT p.id FROM "Periode" p JOIN "User" u ON u.id=p."userId" WHERE p."isActive"=true AND u.role='SEKRETARIS_CABANG' ORDER BY p."createdAt" LIMIT 1`).Scan(&cabangPeriod); err != nil {
				httpx.Error(w, 409, "NO_CABANG_PERIOD", "Tidak ada periode aktif Cabang. Hubungi Sekretaris Cabang.")
				return
			}
			period = cabangPeriod
		}
		item, err := a.store.Create(r.Context(), key, u, period, input)
		if err != nil {
			a.dbError(w, err)
			return
		}
		a.sideEffect(r, key, "CREATE", item)
		if key == "pengajuan-berkas" {
			item["originalFileName"] = input["fileName"]
			go a.notifyApplicationCreated(u, item)
		}
		httpx.JSON(w, 201, map[string]any{"data": item, "message": "Data berhasil ditambahkan"})
	}
}
func (a *API) updateResource(key string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, _ := identity.FromContext(r.Context())
		id := chi.URLParam(r, "id")
		owned, err := a.store.Owned(r.Context(), key, id, u)
		if err != nil {
			a.dbError(w, err)
			return
		}
		if !owned {
			httpx.Error(w, 403, "FORBIDDEN", "Data bukan milik Anda")
			return
		}
		var input map[string]any
		if !httpx.Decode(w, r, &input) {
			return
		}
		delete(input, "status")
		oldItem, _ := a.store.Get(r.Context(), key, id)
		if key == "pengajuan-berkas" && fmt.Sprint(oldItem["status"]) != "PENDING" {
			httpx.Error(w, 409, "INVALID_STATUS_TRANSITION", "Pengajuan yang sudah diproses tidak dapat diubah")
			return
		}
		if fields := validateResource(key, input, false); len(fields) > 0 {
			httpx.Error(w, 422, "VALIDATION_ERROR", "Data tidak valid", fields)
			return
		}
		item, err := a.store.Update(r.Context(), key, id, input)
		if err != nil {
			a.dbError(w, err)
			return
		}
		a.sideEffect(r, key, "UPDATE", item)
		if oldFile, ok := oldItem["file"].(string); ok && oldFile != "" {
			if newFile, changed := input["file"].(string); changed && newFile != "" && newFile != oldFile {
				_ = a.storage.Delete(r.Context(), oldFile)
			}
		}
		httpx.JSON(w, 200, map[string]any{"data": item, "message": "Data berhasil diperbarui"})
	}
}
func (a *API) deleteResource(key string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, _ := identity.FromContext(r.Context())
		id := chi.URLParam(r, "id")
		owned, err := a.store.Owned(r.Context(), key, id, u)
		if err != nil {
			a.dbError(w, err)
			return
		}
		if !owned && !u.IsCabang() {
			httpx.Error(w, 403, "FORBIDDEN", "Data bukan milik Anda")
			return
		}
		item, _ := a.store.Get(r.Context(), key, id)
		if err := a.store.Delete(r.Context(), key, id); err != nil {
			a.dbError(w, err)
			return
		}
		fileField := "file"
		if key == "anggota" {
			fileField = "foto"
		}
		if file, ok := item[fileField].(string); ok && file != "" {
			_ = a.storage.Delete(r.Context(), file)
		}
		a.sideEffect(r, key, "DELETE", map[string]any{"id": id})
		httpx.JSON(w, 200, map[string]string{"message": "Data berhasil dihapus"})
	}
}

func validateResource(key string, input map[string]any, create bool) map[string]string {
	required := map[string][]string{"wilayah": {"jenis", "nama"}, "anggota": {"namaLengkap", "jenisKelamin"}, "agenda-kegiatan": {"judul", "warna", "tanggalMulai"}, "arsip": {"noSurat", "jenisSurat", "tanggal", "pengirimPenerima", "perihal"}, "berkas-pimpinan": {"nama", "tanggal"}, "berkas-sp": {"nama", "tanggalMulai", "tanggalBerakhir", "organisasi"}, "pengajuan-berkas": {"noSurat", "penerima", "tanggal", "keperluan", "file"}, "presensi": {"namaKegiatan", "tempat", "penyelenggara", "tanggal", "jamMulai", "jamSelesai"}}
	errs := map[string]string{}
	for _, field := range required[key] {
		v, ok := input[field]
		if (create && !ok) || (ok && (v == nil || strings.TrimSpace(fmt.Sprint(v)) == "")) {
			errs[field] = "Wajib diisi"
		}
	}
	allowed := func(field string, values ...string) {
		value, exists := input[field]
		if !exists || value == nil || fmt.Sprint(value) == "" {
			return
		}
		for _, candidate := range values {
			if fmt.Sprint(value) == candidate {
				return
			}
		}
		errs[field] = "Nilai tidak valid"
	}
	switch key {
	case "wilayah":
		allowed("jenis", "RANTING", "PK")
	case "anggota":
		allowed("jenisKelamin", "LAKI_LAKI", "PEREMPUAN")
	case "arsip":
		allowed("jenisSurat", "MASUK", "KELUAR")
		allowed("organisasi", "IPNU", "IPPNU", "BERSAMA", "CBP_KPP")
	case "berkas-sp":
		allowed("organisasi", "IPNU", "IPPNU", "BERSAMA", "CBP_KPP")
	case "pengajuan-berkas":
		allowed("penerima", "IPNU", "IPPNU", "BERSAMA", "CBP_KPP")
	}
	for _, field := range []string{"tanggal", "tanggalMulai", "tanggalSelesai", "tanggalLahir", "tanggalBerakhir"} {
		value, exists := input[field]
		if !exists || value == nil || fmt.Sprint(value) == "" {
			continue
		}
		valid := false
		for _, layout := range []string{time.RFC3339, "2006-01-02"} {
			if _, err := time.Parse(layout, fmt.Sprint(value)); err == nil {
				valid = true
				break
			}
		}
		if !valid {
			errs[field] = "Format tanggal tidak valid"
		}
	}
	for _, field := range []string{"jamMulai", "jamSelesai"} {
		if value, exists := input[field]; exists && value != nil && fmt.Sprint(value) != "" {
			if _, err := time.Parse("15:04", fmt.Sprint(value)); err != nil {
				errs[field] = "Format jam tidak valid"
			}
		}
	}
	return errs
}

func (a *API) resourceStats(key string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, _ := identity.FromContext(r.Context())
		period, err := a.store.ReadPeriod(r.Context(), u, r.Header.Get("X-View-Period"))
		if err != nil {
			httpx.Error(w, 409, "NO_ACTIVE_PERIOD", err.Error())
			return
		}
		listUser := u
		if key == "pengajuan-berkas" && r.URL.Query().Get("scope") == "reference" && !u.IsCabang() {
			if err := a.pool.QueryRow(r.Context(), `SELECT p.id FROM "Periode" p JOIN "User" u ON u.id=p."userId" WHERE p."isActive"=true AND u.role='SEKRETARIS_CABANG' ORDER BY p."createdAt" LIMIT 1`).Scan(&period); err != nil {
				httpx.Error(w, 409, "NO_CABANG_PERIOD", "Tidak ada periode aktif Cabang")
				return
			}
			listUser.Role = "SEKRETARIS_CABANG"
		}
		items, _, err := a.store.List(r.Context(), key, listUser, period, 3000, 0)
		if err != nil {
			a.dbError(w, err)
			return
		}
		if userID := r.URL.Query().Get("userId"); userID != "" && userID != "ALL" {
			filtered := items[:0]
			for _, item := range items {
				if fmt.Sprint(item["userId"]) == userID {
					filtered = append(filtered, item)
				}
			}
			items = filtered
		}
		stats := map[string]any{"total": len(items)}
		count := func(field, value string) int {
			n := 0
			for _, item := range items {
				if fmt.Sprint(item[field]) == value {
					n++
				}
			}
			return n
		}
		switch key {
		case "arsip":
			stats["masuk"] = count("jenisSurat", "MASUK")
			stats["keluar"] = count("jenisSurat", "KELUAR")
			stats["ipnu"] = count("organisasi", "IPNU")
			stats["ippnu"] = count("organisasi", "IPPNU")
			stats["bersama"] = count("organisasi", "BERSAMA")
			stats["cbpkpp"] = count("organisasi", "CBP_KPP")
		case "berkas-sp":
			stats["ipnu"] = count("organisasi", "IPNU")
			stats["ippnu"] = count("organisasi", "IPPNU")
		case "berkas-pimpinan":
			month := time.Now().Format("2006-01")
			n := 0
			for _, item := range items {
				if strings.HasPrefix(fmt.Sprint(item["tanggal"]), month) {
					n++
				}
			}
			stats["bulanIni"] = n
		case "pengajuan-berkas":
			for _, v := range []string{"PENDING", "DITERIMA", "DITOLAK"} {
				stats[strings.ToLower(v)] = count("status", v)
			}
			stats["ipnu"] = count("penerima", "IPNU")
			stats["ippnu"] = count("penerima", "IPPNU")
			stats["bersama"] = count("penerima", "BERSAMA")
			stats["cbpKpp"] = count("penerima", "CBP_KPP")
		case "agenda-kegiatan":
			now := time.Now()
			upcoming, ongoing, done := 0, 0, 0
			for _, item := range items {
				start, _ := time.Parse(time.RFC3339, fmt.Sprint(item["tanggalMulai"]))
				end := start.Add(24 * time.Hour)
				if raw := fmt.Sprint(item["tanggalSelesai"]); raw != "<nil>" && raw != "" {
					if parsed, e := time.Parse(time.RFC3339, raw); e == nil {
						end = parsed
					}
				}
				if now.Before(start) {
					upcoming++
				} else if now.After(end) {
					done++
				} else {
					ongoing++
				}
			}
			stats["mendatang"] = upcoming
			stats["berlangsung"] = ongoing
			stats["selesai"] = done
		case "anggota":
			accepted := []map[string]any{}
			for _, item := range items {
				if fmt.Sprint(item["status"]) == "DITERIMA" {
					_ = a.store.Enrich(r.Context(), key, item)
					accepted = append(accepted, item)
				}
			}
			stats["total"] = len(accepted)
			stats["lakiLaki"] = 0
			stats["perempuan"] = 0
			for _, item := range accepted {
				gender := fmt.Sprint(item["jenisKelamin"])
				if gender == "LAKI_LAKI" {
					stats["lakiLaki"] = stats["lakiLaki"].(int) + 1
				} else if gender == "PEREMPUAN" {
					stats["perempuan"] = stats["perempuan"].(int) + 1
				}
				if rows, ok := item["perkaderans"].([]any); ok {
					for _, row := range rows {
						name := strings.ToLower(fmt.Sprint(row.(map[string]any)["namaPerkaderan"]))
						stats[name] = asInt(stats[name]) + 1
					}
				}
			}
		}
		httpx.JSON(w, 200, map[string]any{"data": stats})
	}
}
func asInt(v any) int { n, _ := v.(int); return n }

type requestAuditMetadata struct {
	Browser, Device, IPAddress, Location, UserAgent string
}

func (a *API) auditMetadata(r *http.Request) requestAuditMetadata {
	userAgent := r.UserAgent()
	if clientUserAgent := strings.TrimSpace(r.Header.Get("X-Client-User-Agent")); clientUserAgent != "" {
		userAgent = clientUserAgent
	}
	lowerUserAgent := strings.ToLower(userAgent)
	browser := "Lainnya"
	switch {
	case strings.Contains(lowerUserAgent, "laci mobile"):
		browser = "Laci Mobile"
	case strings.Contains(userAgent, "Edg/"):
		browser = "Edge"
	case strings.Contains(userAgent, "Chrome/"):
		browser = "Chrome"
	case strings.Contains(userAgent, "Firefox/"):
		browser = "Firefox"
	case strings.Contains(userAgent, "Safari/"):
		browser = "Safari"
	}
	device := "Desktop"
	if strings.Contains(lowerUserAgent, "mobile") {
		device = "Mobile"
	}
	ipAddress := r.RemoteAddr
	if host, _, splitErr := net.SplitHostPort(r.RemoteAddr); splitErr == nil {
		ipAddress = host
	}
	if clientIP := strings.TrimSpace(r.Header.Get("X-Client-IP")); a.cfg.TrustedProxyHeaders && clientIP != "" {
		ipAddress = clientIP
	}
	location := strings.TrimSpace(r.Header.Get("X-Client-Location"))
	if lat, err := r.Cookie("user_lat"); err == nil {
		if lng, lngErr := r.Cookie("user_lng"); lngErr == nil {
			location = lat.Value + ", " + lng.Value
		}
	}
	return requestAuditMetadata{
		Browser:   browser,
		Device:    device,
		IPAddress: ipAddress,
		Location:  location,
		UserAgent: userAgent,
	}
}

func (a *API) sideEffect(r *http.Request, key, action string, item map[string]any) {
	u, _ := identity.FromContext(r.Context())
	period, _ := a.store.ActivePeriod(r.Context(), u)
	module := map[string]string{"wilayah": "WILAYAH", "anggota": "ANGGOTA", "agenda-kegiatan": "AGENDA_KEGIATAN", "arsip": "ARSIP_SURAT", "berkas-pimpinan": "BERKAS_PIMPINAN", "berkas-sp": "BERKAS_SP", "pengajuan-berkas": "PENGAJUAN_BERKAS", "presensi": "PRESENSI", "periode": "PERIODE", "user": "USER"}[key]
	entity, _ := item["id"].(string)
	description := fmt.Sprintf("%s %s", action, strings.ReplaceAll(key, "-", " "))
	metadata := a.auditMetadata(r)
	_, err := a.pool.Exec(r.Context(), `INSERT INTO "LogActivity" (id,"userId","periodeId",action,module,description,"entityId",browser,device,"ipAddress",location,"userAgent","createdAt") VALUES ($1,$2,$3,$4::"LogAction",$5::"LogModule",$6,$7,$8,$9,$10,NULLIF($11,''),$12,now())`, newID(), u.ID, period, action, module, description, entity, metadata.Browser, metadata.Device, metadata.IPAddress, metadata.Location, metadata.UserAgent)
	if err != nil {
		slog.Warn("activity log failed", "error", err)
	}
	a.hub.Publish(map[string]any{"type": "mutation", "module": module, "action": action, "entityId": entity})
}

func (a *API) dbError(w http.ResponseWriter, err error) {
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, 404, "NOT_FOUND", "Data tidak ditemukan")
		return
	}
	message := err.Error()
	if strings.Contains(message, "duplicate key") {
		httpx.Error(w, 409, "DUPLICATE", "Data sudah tersedia")
		return
	}
	slog.Error("database operation failed", "error", err)
	httpx.Error(w, 500, "INTERNAL_ERROR", "Terjadi kesalahan pada server")
}
func newID() string { return idgen.New() }
