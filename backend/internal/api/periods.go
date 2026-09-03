package api

import (
	"github.com/go-chi/chi/v5"
	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
	"github.com/jackc/pgx/v5"
	"net/http"
	"strings"
	"time"
)

func (a *API) listPeriods(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	page, limit, offset := httpx.Pagination(r)
	var total int
	if err := a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "Periode" WHERE "userId"=$1`, u.ID).Scan(&total); err != nil {
		a.dbError(w, err)
		return
	}
	rows, err := a.pool.Query(r.Context(), `SELECT id,nama,"isActive","createdAt","updatedAt" FROM "Periode" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3`, u.ID, limit, offset)
	if err != nil {
		a.dbError(w, err)
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, nama string
		var active bool
		var created, updated time.Time
		if err := rows.Scan(&id, &nama, &active, &created, &updated); err != nil {
			a.dbError(w, err)
			return
		}
		items = append(items, map[string]any{"id": id, "nama": nama, "isActive": active, "createdAt": created, "updatedAt": updated})
	}
	httpx.JSON(w, 200, map[string]any{"data": items, "pagination": map[string]any{"page": page, "limit": limit, "total": total, "totalPages": (total + limit - 1) / limit}})
}

func (a *API) createPeriod(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	var input struct {
		Name string `json:"nama"`
	}
	if !httpx.Decode(w, r, &input) {
		return
	}
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		httpx.Error(w, 422, "VALIDATION_ERROR", "Nama periode wajib diisi", map[string]string{"nama": "Wajib diisi"})
		return
	}
	tx, err := a.pool.Begin(r.Context())
	if err != nil {
		a.dbError(w, err)
		return
	}
	defer tx.Rollback(r.Context())
	var hasActive bool
	if err = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "Periode" WHERE "userId"=$1 AND "isActive"=true)`, u.ID).Scan(&hasActive); err == nil {
		// Periode pertama, atau periode baru ketika data lama tidak memiliki
		// periode aktif, langsung menjadi periode aktif default.
		active := !hasActive
		id := newID()
		_, err = tx.Exec(r.Context(), `INSERT INTO "Periode" (id,nama,"userId","isActive","createdAt","updatedAt") VALUES ($1,$2,$3,$4,now(),now())`, id, input.Name, u.ID, active)
		if err == nil && active {
			_, err = tx.Exec(r.Context(), `UPDATE "User" SET "periodeAktifId"=$1,"updatedAt"=now() WHERE id=$2`, id, u.ID)
		}
		if err == nil {
			err = tx.Commit(r.Context())
		}
		if err == nil {
			a.sideEffect(r, "periode", "CREATE", map[string]any{"id": id})
			httpx.JSON(w, 201, map[string]any{"data": map[string]any{"id": id, "nama": input.Name, "isActive": active}, "message": "Periode berhasil ditambahkan"})
			return
		}
	}
	a.dbError(w, err)
}

func (a *API) getPeriod(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	var id, nama string
	var active bool
	err := a.pool.QueryRow(r.Context(), `SELECT id,nama,"isActive" FROM "Periode" WHERE id=$1 AND "userId"=$2`, chi.URLParam(r, "id"), u.ID).Scan(&id, &nama, &active)
	if err != nil {
		a.dbError(w, err)
		return
	}
	httpx.JSON(w, 200, map[string]any{"data": map[string]any{"id": id, "nama": nama, "isActive": active}})
}

func (a *API) updatePeriod(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	var input struct {
		Name string `json:"nama"`
	}
	if !httpx.Decode(w, r, &input) {
		return
	}
	tag, err := a.pool.Exec(r.Context(), `UPDATE "Periode" SET nama=$1,"updatedAt"=now() WHERE id=$2 AND "userId"=$3`, strings.TrimSpace(input.Name), chi.URLParam(r, "id"), u.ID)
	if err != nil {
		a.dbError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		a.dbError(w, pgx.ErrNoRows)
		return
	}
	a.sideEffect(r, "periode", "UPDATE", map[string]any{"id": chi.URLParam(r, "id")})
	httpx.JSON(w, 200, map[string]string{"message": "Periode berhasil diperbarui"})
}

func (a *API) activatePeriod(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	id := chi.URLParam(r, "id")
	tx, err := a.pool.Begin(r.Context())
	if err != nil {
		a.dbError(w, err)
		return
	}
	defer tx.Rollback(r.Context())
	var exists bool
	if err = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM "Periode" WHERE id=$1 AND "userId"=$2)`, id, u.ID).Scan(&exists); err != nil || !exists {
		if err == nil {
			err = pgx.ErrNoRows
		}
		a.dbError(w, err)
		return
	}
	_, err = tx.Exec(r.Context(), `UPDATE "Periode" SET "isActive"=false,"updatedAt"=now() WHERE "userId"=$1`, u.ID)
	if err == nil {
		_, err = tx.Exec(r.Context(), `UPDATE "Periode" SET "isActive"=true,"updatedAt"=now() WHERE id=$1`, id)
	}
	if err == nil {
		_, err = tx.Exec(r.Context(), `UPDATE "User" SET "periodeAktifId"=$1,"updatedAt"=now() WHERE id=$2`, id, u.ID)
	}
	if err == nil {
		err = tx.Commit(r.Context())
	}
	if err != nil {
		a.dbError(w, err)
		return
	}
	a.sideEffect(r, "periode", "UPDATE", map[string]any{"id": id})
	httpx.JSON(w, 200, map[string]string{"message": "Periode berhasil diaktifkan"})
}

func (a *API) deletePeriod(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	id := chi.URLParam(r, "id")
	var active bool
	err := a.pool.QueryRow(r.Context(), `SELECT "isActive" FROM "Periode" WHERE id=$1 AND "userId"=$2`, id, u.ID).Scan(&active)
	if err != nil {
		a.dbError(w, err)
		return
	}
	if active {
		httpx.Error(w, 409, "ACTIVE_PERIOD", "Periode aktif tidak dapat dihapus")
		return
	}
	_, err = a.pool.Exec(r.Context(), `DELETE FROM "Periode" WHERE id=$1 AND "userId"=$2`, id, u.ID)
	if err != nil {
		a.dbError(w, err)
		return
	}
	a.sideEffect(r, "periode", "DELETE", map[string]any{"id": id})
	httpx.JSON(w, 200, map[string]string{"message": "Periode berhasil dihapus"})
}
