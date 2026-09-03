package api

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"github.com/ipnu-ippnu/laci/backend/internal/database"
	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
	"net/http"
	"os"
	"os/exec"
	"sort"
	"strings"
	"time"
)

func (a *API) backups(w http.ResponseWriter, r *http.Request) {
	items, err := a.storage.List(r.Context(), "backups/")
	if err != nil {
		httpx.Error(w, 502, "STORAGE_ERROR", "Gagal membaca backup")
		return
	}
	httpx.JSON(w, 200, map[string]any{"data": items})
}

func (a *API) createBackup(w http.ResponseWriter, r *http.Request) {
	if !a.storage.Enabled() {
		httpx.Error(w, 503, "STORAGE_UNAVAILABLE", "R2 belum dikonfigurasi")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()
	tmp, err := os.CreateTemp("", "laci-*.sql")
	if err != nil {
		httpx.Error(w, 500, "BACKUP_ERROR", err.Error())
		return
	}
	path := tmp.Name()
	_ = tmp.Close()
	defer os.Remove(path)
	databaseURL, _, err := database.NormalizeURL(a.cfg.DatabaseURL)
	if err != nil {
		httpx.Error(w, 500, "BACKUP_ERROR", "DATABASE_URL tidak valid")
		return
	}
	cmd := exec.CommandContext(ctx, "pg_dump", "--no-owner", "--no-privileges", "--file", path, databaseURL)
	if out, err := cmd.CombinedOutput(); err != nil {
		httpx.Error(w, 500, "BACKUP_ERROR", fmt.Sprintf("pg_dump gagal: %s", strings.TrimSpace(string(out))))
		return
	}
	sql, err := os.ReadFile(path)
	if err != nil {
		httpx.Error(w, 500, "BACKUP_ERROR", err.Error())
		return
	}
	var archive bytes.Buffer
	zw := gzip.NewWriter(&archive)
	if _, err := zw.Write(sql); err != nil {
		httpx.Error(w, 500, "BACKUP_ERROR", "Gagal mengompresi backup")
		return
	}
	if err := zw.Close(); err != nil {
		httpx.Error(w, 500, "BACKUP_ERROR", "Gagal menyelesaikan backup")
		return
	}
	key := "backups/laci-" + time.Now().Format("20060102-150405") + ".sql.gz"
	if err := a.storage.Put(ctx, key, "application/gzip", archive.Bytes()); err != nil {
		httpx.Error(w, 502, "STORAGE_ERROR", "Gagal mengunggah backup")
		return
	}
	items, _ := a.storage.List(ctx, "backups/")
	if len(items) > 10 {
		sort.Slice(items, func(i, j int) bool { return fmt.Sprint(items[i]["key"]) < fmt.Sprint(items[j]["key"]) })
		for _, old := range items[:len(items)-10] {
			_ = a.storage.Delete(ctx, fmt.Sprint(old["key"]))
		}
	}
	httpx.JSON(w, 201, map[string]any{"message": "Backup berhasil dibuat", "key": key})
}

func (a *API) cronBackup(w http.ResponseWriter, r *http.Request) {
	auth := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if a.cfg.CronSecret == "" || auth != a.cfg.CronSecret {
		httpx.Error(w, 401, "UNAUTHORIZED", "Cron secret tidak valid")
		return
	}
	a.createBackup(w, r)
}

func (a *API) deleteBackup(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if !strings.HasPrefix(key, "backups/") {
		httpx.Error(w, 422, "INVALID_KEY", "Key backup tidak valid")
		return
	}
	if err := a.storage.Delete(r.Context(), key); err != nil {
		httpx.Error(w, 502, "STORAGE_ERROR", "Gagal menghapus backup")
		return
	}
	httpx.JSON(w, 200, map[string]string{"message": "Backup berhasil dihapus"})
}

func (a *API) backupURL(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if !strings.HasPrefix(key, "backups/") {
		httpx.Error(w, 422, "INVALID_KEY", "Key backup tidak valid")
		return
	}
	url, err := a.storage.SignedURL(r.Context(), key, 10*time.Minute)
	if err != nil {
		httpx.Error(w, 502, "STORAGE_ERROR", "Gagal membuat URL backup")
		return
	}
	httpx.JSON(w, 200, map[string]string{"url": url})
}
