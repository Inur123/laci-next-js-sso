package api

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
)

// copyMembersToPeriod creates a new period assignment for selected members.
// The source assignment remains untouched, so period history is preserved.
func (a *API) copyMembersToPeriod(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	var input struct {
		AnggotaIDs     []string `json:"anggotaIds"`
		SourcePeriodID string   `json:"sourcePeriodeId"`
		TargetPeriodID string   `json:"targetPeriodeId"`
	}
	if !httpx.Decode(w, r, &input) {
		return
	}
	if len(input.AnggotaIDs) == 0 || strings.TrimSpace(input.SourcePeriodID) == "" || strings.TrimSpace(input.TargetPeriodID) == "" {
		httpx.Error(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "anggotaIds, sourcePeriodeId, dan targetPeriodeId wajib diisi")
		return
	}
	if input.SourcePeriodID == input.TargetPeriodID {
		httpx.Error(w, http.StatusConflict, "SAME_PERIOD", "Periode sumber dan tujuan tidak boleh sama")
		return
	}
	var targetOwner string
	if err := a.pool.QueryRow(r.Context(), `SELECT "userId" FROM "Periode" WHERE id=$1`, input.TargetPeriodID).Scan(&targetOwner); err != nil {
		a.dbError(w, err)
		return
	}
	if targetOwner != u.ID {
		httpx.Error(w, http.StatusForbidden, "FORBIDDEN", "Periode tujuan bukan milik Anda")
		return
	}

	tx, err := a.pool.Begin(r.Context())
	if err != nil {
		a.dbError(w, err)
		return
	}
	defer tx.Rollback(r.Context())

	// PAC may copy only its own assignments. Cabang may consolidate visible
	// PAC assignments into its own period while preserving the original owner.
	ownerFilter := `ap."userId"=$4`
	sourceFilter := `ap."periodeId"=$2`
	args := []any{input.AnggotaIDs, input.SourcePeriodID, input.TargetPeriodID, u.ID}
	if u.IsCabang() {
		ownerFilter = "TRUE"
		// The Cabang period is the UI source selector while assignments live on
		// PAC periods with the same name. This mirrors the Cabang member list.
		sourceFilter = `ap."periodeId" IN (
			SELECT id FROM "Periode"
			WHERE nama=(SELECT nama FROM "Periode" WHERE id=$2 AND "userId"=$4)
		)`
	}
	query := fmt.Sprintf(`
		INSERT INTO "AnggotaPeriode" (id,"anggotaId","userId","periodeId","wilayahId",status,"alasanPenolakan","createdAt","updatedAt")
		SELECT 'ap_' || ap."anggotaId" || '_' || $3,
		       ap."anggotaId",ap."userId",$3,NULL,ap.status,ap."alasanPenolakan",now(),now()
		FROM "AnggotaPeriode" ap
		WHERE ap."anggotaId"=ANY($1::text[])
		  AND %s
		  AND %s
		ON CONFLICT ("anggotaId","periodeId") DO NOTHING`, sourceFilter, ownerFilter)
	result, err := tx.Exec(r.Context(), query, args...)
	if err != nil {
		a.dbError(w, err)
		return
	}

	// Keep the legacy snapshot pointed at the newest assignment for existing
	// detail/integration consumers. Historical rows remain in AnggotaPeriode.
	_, err = tx.Exec(r.Context(), `
		UPDATE "Anggota" a
		SET "userId"=ap."userId", "periodeId"=ap."periodeId", "wilayahId"=ap."wilayahId",
		    status=ap.status, "alasanPenolakan"=ap."alasanPenolakan", "updatedAt"=now()
		FROM "AnggotaPeriode" ap
		WHERE ap."anggotaId"=a.id AND ap."periodeId"=$1 AND ap."anggotaId"=ANY($2::text[])`, input.TargetPeriodID, input.AnggotaIDs)
	if err != nil {
		a.dbError(w, err)
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		a.dbError(w, err)
		return
	}
	a.sideEffect(r, "anggota", "IMPORT", map[string]any{"count": result.RowsAffected(), "periodeId": input.TargetPeriodID})
	httpx.JSON(w, http.StatusOK, map[string]any{
		"message": fmt.Sprintf("%d anggota berhasil dimasukkan ke periode tujuan", result.RowsAffected()),
		"copied":  result.RowsAffected(),
	})
}
