package api

import (
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"
)

func (a *API) uploadFile(w http.ResponseWriter, r *http.Request) {
	if !a.storage.Enabled() {
		httpx.Error(w, 503, "STORAGE_UNAVAILABLE", "R2 belum dikonfigurasi")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 6<<20)
	if err := r.ParseMultipartForm(6 << 20); err != nil {
		httpx.Error(w, 413, "FILE_TOO_LARGE", "Ukuran file melebihi 5 MB")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		httpx.Error(w, 422, "VALIDATION_ERROR", "File wajib dipilih")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, 5<<20+1))
	if err != nil || len(data) > 5<<20 {
		httpx.Error(w, 413, "FILE_TOO_LARGE", "Ukuran file melebihi 5 MB")
		return
	}
	prefix := strings.Trim(r.FormValue("prefix"), "/")
	if prefix == "" {
		prefix = "documents"
	}
	u, ok := identity.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "Sesi tidak valid")
		return
	}
	if !u.EmailVerified && prefix != "profile" {
		httpx.Error(w, http.StatusForbidden, "EMAIL_UNVERIFIED", "Fitur ini tersedia setelah email SSO terverifikasi")
		return
	}
	allowed := map[string]bool{"documents": true, "arsip": true, "berkas-pimpinan": true, "berkas-sp": true, "pengajuan": true, "pengajuan-berkas": true, "profile": true, "anggota": true}
	if !allowed[prefix] {
		httpx.Error(w, 422, "INVALID_PREFIX", "Folder file tidak valid")
		return
	}
	maxSize := 5 << 20
	if prefix == "profile" || prefix == "anggota" || prefix == "arsip" || prefix == "berkas-sp" || prefix == "pengajuan" || prefix == "pengajuan-berkas" {
		maxSize = 2 << 20
	}
	if len(data) > maxSize {
		httpx.Error(w, 413, "FILE_TOO_LARGE", fmt.Sprintf("Ukuran file maksimal %d MB", maxSize>>20))
		return
	}
	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(header.Filename)), ".")
	if ext == "" {
		ext = "bin"
	}
	encrypted, err := a.crypto.EncryptFile(data)
	if err != nil {
		httpx.Error(w, 500, "CRYPTO_ERROR", "Gagal mengenkripsi file")
		return
	}
	key := fmt.Sprintf("%s/%d-%s-%s.enc", prefix, time.Now().UnixMilli(), newID()[:8], ext)
	if err := a.storage.Put(r.Context(), key, "application/octet-stream", encrypted); err != nil {
		httpx.Error(w, 502, "STORAGE_ERROR", "Gagal menyimpan file")
		return
	}
	httpx.JSON(w, 201, map[string]any{"data": map[string]any{"key": key, "name": header.Filename, "size": len(data)}})
}

func (a *API) canReadFile(r *http.Request, key, id string, user identity.User) bool {
	owned, err := a.store.Owned(r.Context(), key, id, user)
	if err != nil {
		return false
	}
	if owned || user.IsCabang() {
		return true
	}
	if key != "pengajuan-berkas" || r.URL.Query().Get("scope") != "reference" {
		return false
	}
	// Match the reference detail's active Cabang period so every PAC reader
	// can open its attachments, while other private files keep owner checks.
	var allowed bool
	err = a.pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "PengajuanBerkas" x JOIN "Periode" p ON p.id=x."periodeId" JOIN "User" owner ON owner.id=p."userId" WHERE x.id=$1 AND p."isActive"=true AND owner.role='SEKRETARIS_CABANG')`, id).Scan(&allowed)
	return err == nil && allowed
}

func (a *API) downloadToken(key string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, _ := identity.FromContext(r.Context())
		id := chi.URLParam(r, "id")
		if !a.canReadFile(r, key, id, u) {
			httpx.Error(w, 403, "FORBIDDEN", "File bukan milik Anda")
			return
		}
		token, err := a.crypto.DownloadToken(id, 5*time.Minute)
		if err != nil {
			httpx.Error(w, 500, "TOKEN_ERROR", "Gagal membuat token")
			return
		}
		httpx.JSON(w, 200, map[string]any{"token": token, "expiresIn": 300})
	}
}

func (a *API) download(key string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, _ := identity.FromContext(r.Context())
		id := chi.URLParam(r, "id")
		if token := r.URL.Query().Get("token"); token != "" {
			verified, ok := a.crypto.VerifyDownloadToken(token)
			if !ok || verified != id {
				httpx.Error(w, 401, "INVALID_TOKEN", "Token unduhan tidak valid")
				return
			}
		} else if !a.canReadFile(r, key, id, u) {
			httpx.Error(w, 403, "FORBIDDEN", "File bukan milik Anda")
			return
		}
		item, err := a.store.Get(r.Context(), key, id)
		if err != nil {
			a.dbError(w, err)
			return
		}
		file, _ := item["file"].(string)
		if file == "" {
			httpx.Error(w, 404, "FILE_NOT_FOUND", "File tidak tersedia")
			return
		}
		encrypted, _, err := a.storage.Get(r.Context(), file)
		if err != nil {
			httpx.Error(w, 404, "FILE_NOT_FOUND", "File tidak ditemukan")
			return
		}
		data, err := a.crypto.DecryptFile(encrypted)
		if err != nil {
			httpx.Error(w, 500, "DECRYPT_ERROR", "File tidak dapat dibuka")
			return
		}
		w.Header().Set("Content-Type", detectContentType(file, data))
		w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename=%q`, displayFileName(file)))
		w.WriteHeader(200)
		_, _ = w.Write(data)
	}
}

func detectContentType(name string, data []byte) string {
	lower := strings.ToLower(name)
	if strings.Contains(lower, "-pdf.enc") {
		return "application/pdf"
	}
	if strings.Contains(lower, "-png.enc") {
		return "image/png"
	}
	if strings.Contains(lower, "-jpg.enc") || strings.Contains(lower, "-jpeg.enc") {
		return "image/jpeg"
	}
	return http.DetectContentType(data)
}

func displayFileName(key string) string {
	base := key
	if i := strings.LastIndex(base, "/"); i >= 0 {
		base = base[i+1:]
	}
	parts := strings.Split(base, "-")
	ext := "bin"
	if len(parts) > 1 {
		ext = strings.TrimSuffix(parts[len(parts)-1], ".enc")
	}
	return "dokumen." + ext
}

func (a *API) userImage(w http.ResponseWriter, r *http.Request) {
	u, ok := identity.FromContext(r.Context())
	targetID := chi.URLParam(r, "id")
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "Sesi tidak valid")
		return
	}
	if !u.EmailVerified && targetID != u.ID {
		httpx.Error(w, http.StatusForbidden, "EMAIL_UNVERIFIED", "Foto pengguna lain tersedia setelah email SSO terverifikasi")
		return
	}
	var key *string
	if err := a.pool.QueryRow(r.Context(), `SELECT image FROM "User" WHERE id=$1`, targetID).Scan(&key); err != nil || key == nil {
		httpx.Error(w, 404, "IMAGE_NOT_FOUND", "Foto tidak ditemukan")
		return
	}
	if remote, err := url.Parse(strings.TrimSpace(*key)); err == nil && remote.Host != "" && (remote.Scheme == "https" || remote.Scheme == "http") {
		http.Redirect(w, r, remote.String(), http.StatusTemporaryRedirect)
		return
	}
	a.serveEncryptedImage(w, r, *key)
}

func (a *API) memberImage(w http.ResponseWriter, r *http.Request) {
	var key *string
	if err := a.pool.QueryRow(r.Context(), `SELECT foto FROM "Anggota" WHERE id=$1`, chi.URLParam(r, "id")).Scan(&key); err != nil || key == nil {
		httpx.Error(w, 404, "IMAGE_NOT_FOUND", "Foto tidak ditemukan")
		return
	}
	a.serveEncryptedImage(w, r, *key)
}

func (a *API) serveEncryptedImage(w http.ResponseWriter, r *http.Request, key string) {
	encrypted, _, err := a.storage.Get(r.Context(), key)
	if err != nil {
		httpx.Error(w, 404, "IMAGE_NOT_FOUND", "Foto tidak ditemukan")
		return
	}
	data, err := a.crypto.DecryptFile(encrypted)
	if err != nil {
		httpx.Error(w, 500, "DECRYPT_ERROR", "Foto tidak dapat dibuka")
		return
	}
	w.Header().Set("Content-Type", http.DetectContentType(data))
	w.Header().Set("Cache-Control", "private, max-age=300")
	_, _ = w.Write(data)
}
