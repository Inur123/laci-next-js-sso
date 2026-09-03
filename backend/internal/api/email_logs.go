package api

import (
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
	"net/http"
	"strings"
	"time"
)

func (a *API) emailLogs(w http.ResponseWriter, r *http.Request) {
	page, limit, offset := httpx.Pagination(r)
	where, args := []string{"TRUE"}, []any{}
	add := func(clause string, value any) {
		args = append(args, value)
		where = append(where, fmt.Sprintf(clause, len(args)))
	}
	if search := strings.TrimSpace(r.URL.Query().Get("search")); search != "" {
		add(`("to" ILIKE $%d OR subject ILIKE $%d)`, "%"+search+"%")
	}
	if typ := r.URL.Query().Get("type"); typ != "" && typ != "ALL" {
		add(`type=$%d::"EmailType"`, typ)
	}
	if status := r.URL.Query().Get("status"); status != "" && status != "ALL" {
		add(`status=$%d::"EmailStatus"`, status)
	}
	if from := r.URL.Query().Get("dateFrom"); from != "" {
		add(`"createdAt">=$%d::date`, from)
	}
	if to := r.URL.Query().Get("dateTo"); to != "" {
		add(`"createdAt"<$%d::date+interval '1 day'`, to)
	}
	whereSQL := strings.Join(where, " AND ")
	var total int
	_ = a.pool.QueryRow(r.Context(), `SELECT count(*) FROM "LogEmail" WHERE `+whereSQL, args...).Scan(&total)
	sortColumn := map[string]string{"createdAt": `"createdAt"`, "to": `"to"`, "subject": "subject", "type": "type", "status": "status"}[r.URL.Query().Get("sortKey")]
	if sortColumn == "" {
		sortColumn = `"createdAt"`
	}
	direction := "DESC"
	if r.URL.Query().Get("sortDir") == "asc" {
		direction = "ASC"
	}
	args = append(args, limit, offset)
	rows, err := a.pool.Query(r.Context(), fmt.Sprintf(`SELECT id,"to",subject,type::text,status::text,"errorMessage","retryCount",metadata,"createdAt","updatedAt" FROM "LogEmail" WHERE %s ORDER BY %s %s LIMIT $%d OFFSET $%d`, whereSQL, sortColumn, direction, len(args)-1, len(args)), args...)
	if err != nil {
		a.dbError(w, err)
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, to, subject, typ, status string
		var errorMessage, metadata *string
		var retry int
		var created, updated time.Time
		if err := rows.Scan(&id, &to, &subject, &typ, &status, &errorMessage, &retry, &metadata, &created, &updated); err != nil {
			a.dbError(w, err)
			return
		}
		items = append(items, map[string]any{"id": id, "to": to, "subject": subject, "type": typ, "status": status, "errorMessage": errorMessage, "retryCount": retry, "metadata": metadata, "createdAt": created, "updatedAt": updated})
	}
	httpx.JSON(w, 200, map[string]any{"data": items, "pagination": map[string]any{"page": page, "limit": limit, "total": total, "totalPages": (total + limit - 1) / limit}})
}

func (a *API) retryEmail(w http.ResponseWriter, r *http.Request) {
	if err := a.mailer.Retry(r.Context(), chi.URLParam(r, "id")); err != nil {
		httpx.Error(w, 409, "EMAIL_RETRY_FAILED", err.Error())
		return
	}
	httpx.JSON(w, 200, map[string]string{"message": "Email berhasil dikirim ulang"})
}

func (a *API) emailStats(w http.ResponseWriter, r *http.Request) {
	var total, today, sent, failed int
	if err := a.pool.QueryRow(r.Context(), `SELECT count(*),count(*) FILTER (WHERE "createdAt">=current_date),count(*) FILTER (WHERE status='SENT'),count(*) FILTER (WHERE status='FAILED') FROM "LogEmail"`).Scan(&total, &today, &sent, &failed); err != nil {
		a.dbError(w, err)
		return
	}
	byType := map[string]int{}
	rows, _ := a.pool.Query(r.Context(), `SELECT type::text,count(*) FROM "LogEmail" GROUP BY type`)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var typ string
			var count int
			_ = rows.Scan(&typ, &count)
			byType[typ] = count
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": map[string]any{"totalAll": total, "totalToday": today, "totalSent": sent, "totalFailed": failed, "byType": byType}})
}
