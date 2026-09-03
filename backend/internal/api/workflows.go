package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
)

func (a *API) copyWilayah(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	if u.IsCabang() {
		httpx.Error(w, 403, "FORBIDDEN", "Fitur salin hanya untuk PAC")
		return
	}
	var input struct {
		IDs   []string `json:"wilayahIds"`
		Jenis string   `json:"jenis"`
	}
	if !httpx.Decode(w, r, &input) {
		return
	}
	period, err := a.store.ActivePeriod(r.Context(), u)
	if err != nil {
		httpx.Error(w, 409, "NO_ACTIVE_PERIOD", err.Error())
		return
	}
	tx, err := a.pool.Begin(r.Context())
	if err != nil {
		a.dbError(w, err)
		return
	}
	defer tx.Rollback(r.Context())
	copied := 0
	for _, id := range input.IDs {
		tag, e := tx.Exec(r.Context(), `INSERT INTO "Wilayah" (id,"userId","periodeId",jenis,nama,ketua,kontak,alamat,"createdAt","updatedAt") SELECT $1,$2,$3,jenis,nama,ketua,kontak,alamat,now(),now() FROM "Wilayah" WHERE id=$4 AND "userId"=$2 AND jenis=$5::"JenisWilayah" AND "periodeId"<>$3 ON CONFLICT DO NOTHING`, newID(), u.ID, period, id, input.Jenis)
		if e != nil {
			err = e
			break
		}
		copied += int(tag.RowsAffected())
	}
	if err == nil {
		err = tx.Commit(r.Context())
	}
	if err != nil {
		a.dbError(w, err)
		return
	}
	a.sideEffect(r, "wilayah", "IMPORT", map[string]any{})
	httpx.JSON(w, 200, map[string]any{"message": fmt.Sprintf("%d wilayah berhasil disalin", copied), "copied": copied})
}

func (a *API) memberStatus(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	if !u.IsCabang() {
		httpx.Error(w, 403, "FORBIDDEN", "Hanya Cabang yang dapat memverifikasi anggota")
		return
	}
	var input struct{ Status, Reason string }
	if !httpx.Decode(w, r, &input) {
		return
	}
	if input.Status != "DITERIMA" && input.Status != "DITOLAK" {
		httpx.Error(w, 422, "VALIDATION_ERROR", "Status tidak valid")
		return
	}
	id := chi.URLParam(r, "id")
	period, err := a.store.ReadPeriod(r.Context(), u, r.Header.Get("X-View-Period"))
	if err != nil {
		httpx.Error(w, 409, "NO_ACTIVE_PERIOD", err.Error())
		return
	}
	var reason any
	if strings.TrimSpace(input.Reason) != "" {
		v, err := a.crypto.EncryptText(input.Reason)
		if err != nil {
			httpx.Error(w, 500, "CRYPTO_ERROR", "Gagal mengenkripsi data")
			return
		}
		reason = v
	}
	periodCondition := `ap."periodeId"=$4`
	if u.IsCabang() {
		periodCondition = `(
			ap."periodeId"=$4 OR
			ap."periodeId" IN (SELECT p2.id FROM "Periode" p2 WHERE p2.nama=(SELECT p3.nama FROM "Periode" p3 WHERE p3.id=$4))
		)`
	}
	query := fmt.Sprintf(`
		WITH updated_assignment AS (
			UPDATE "AnggotaPeriode" ap
			SET status=$1::"StatusVerifikasi","alasanPenolakan"=$2,"updatedAt"=now()
			WHERE ap."anggotaId"=$3
			  AND %s
			  AND ap.status='PENDING'
			RETURNING ap."anggotaId",ap."periodeId"
		)
		SELECT count(*) FROM updated_assignment`, periodCondition)
	var updated int
	err = a.pool.QueryRow(r.Context(), query, input.Status, reason, id, period).Scan(&updated)
	if err != nil {
		a.dbError(w, err)
		return
	}
	if updated == 0 {
		httpx.Error(w, 409, "INVALID_TRANSITION", "Hanya anggota pending yang dapat diverifikasi")
		return
	}
	_, _ = a.pool.Exec(r.Context(), `UPDATE "Anggota" a SET status=$1::"StatusVerifikasi","alasanPenolakan"=$2,"updatedAt"=now() WHERE a.id=$3 AND a."periodeId" IN (SELECT ap."periodeId" FROM "AnggotaPeriode" ap WHERE ap."anggotaId"=$3 AND ap.status=$1::"StatusVerifikasi")`, input.Status, reason, id)
	action := "APPROVE"
	if input.Status == "DITOLAK" {
		action = "REJECT"
	}
	a.sideEffect(r, "anggota", action, map[string]any{"id": id})
	go a.notifyMemberStatus(id, input.Status)
	httpx.JSON(w, 200, map[string]string{"message": "Status anggota berhasil diperbarui"})
}

func (a *API) notifyMemberStatus(anggotaId string, laciStatus string) {
	webhookURL := os.Getenv("WEBHOOK_MEMBER_STATUS_URL")
	if webhookURL == "" {
		webhookURL = "http://localhost:8090/api/v1/integrations/laci/member-status"
	}

	status := "DITERIMA"
	if laciStatus == "DITOLAK" {
		status = "DITOLAK"
	}

	payload := map[string]string{
		"event":     "member.status_changed",
		"anggotaId": anggotaId,
		"status":    status,
	}

	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", webhookURL, bytes.NewBuffer(body))
	if err != nil {
		fmt.Printf("Error creating webhook request: %v\n", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Laci-Signature", "laci-sso-webhook-trigger")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error sending webhook to %s: %v\n", webhookURL, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		fmt.Printf("Webhook sent to %s but received error status: %d\n", webhookURL, resp.StatusCode)
	} else {
		fmt.Printf("Webhook successfully sent to %s for anggota %s\n", webhookURL, anggotaId)
	}
}

func (a *API) applicationStatus(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	if !u.IsCabang() {
		httpx.Error(w, 403, "FORBIDDEN", "Hanya Cabang yang dapat memverifikasi")
		return
	}
	var input struct{ Status, Reason string }
	if !httpx.Decode(w, r, &input) {
		return
	}
	if input.Status != "DITERIMA" && input.Status != "DITOLAK" {
		httpx.Error(w, 422, "VALIDATION_ERROR", "Status tidak valid")
		return
	}
	var reason any
	if input.Reason != "" {
		reason, _ = a.crypto.EncryptText(input.Reason)
	}
	tag, err := a.pool.Exec(r.Context(), `UPDATE "PengajuanBerkas" SET status=$1::"StatusPengajuan","alasanPenolakan"=$2,"updatedAt"=now() WHERE id=$3 AND status='PENDING'`, input.Status, reason, chi.URLParam(r, "id"))
	if err != nil {
		a.dbError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, 409, "INVALID_TRANSITION", "Hanya pengajuan pending yang dapat diverifikasi")
		return
	}
	action := "APPROVE"
	if input.Status == "DITOLAK" {
		action = "REJECT"
	}
	a.sideEffect(r, "pengajuan-berkas", action, map[string]any{"id": chi.URLParam(r, "id")})
	go a.notifyApplicationStatus(chi.URLParam(r, "id"), input.Status)
	httpx.JSON(w, 200, map[string]string{"message": "Status pengajuan berhasil diperbarui"})
}
