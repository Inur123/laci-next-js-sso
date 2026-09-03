package api

import (
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
	"net/http"
	"strings"
	"time"
)

func (a *API) activityLogs(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	page, limit, offset := httpx.Pagination(r)
	where := []string{`l."userId"=$1`}
	args := []any{u.ID}
	if u.IsCabang() && r.URL.Query().Get("scope") == "global" {
		where = []string{"TRUE"}
		args = nil
	}
	add := func(clause string, value any) {
		args = append(args, value)
		where = append(where, fmt.Sprintf(clause, len(args)))
	}
	if userID := r.URL.Query().Get("userId"); u.IsCabang() && r.URL.Query().Get("scope") == "global" && userID != "" && userID != "ALL" {
		add(`l."userId"=$%d`, userID)
	}
	if action := r.URL.Query().Get("action"); action != "" && action != "ALL" {
		add(`l.action=$%d::"LogAction"`, action)
	}
	if module := r.URL.Query().Get("module"); module != "" && module != "ALL" {
		add(`l.module=$%d::"LogModule"`, module)
	}
	if search := strings.TrimSpace(r.URL.Query().Get("search")); search != "" {
		add(`(l.description ILIKE $%d OR u.name ILIKE $%d OR u.email ILIKE $%d)`, "%"+search+"%")
	}
	dateFrom := r.URL.Query().Get("dateFrom")
	if dateFrom == "" {
		dateFrom = r.URL.Query().Get("startDate")
	}
	if dateFrom != "" {
		add(`l."createdAt">=$%d::date`, dateFrom)
	}
	dateTo := r.URL.Query().Get("dateTo")
	if dateTo == "" {
		dateTo = r.URL.Query().Get("endDate")
	}
	if dateTo != "" {
		add(`l."createdAt"<$%d::date+interval '1 day'`, dateTo)
	}
	whereSQL := strings.Join(where, " AND ")
	var total int
	_ = a.pool.QueryRow(r.Context(), fmt.Sprintf(`SELECT count(*) FROM "LogActivity" l JOIN "User" u ON u.id=l."userId" WHERE %s`, whereSQL), args...).Scan(&total)
	sortColumn := map[string]string{"createdAt": `l."createdAt"`, "action": "l.action", "module": "l.module", "description": "l.description", "user": "u.name"}[r.URL.Query().Get("sortKey")]
	if sortColumn == "" {
		sortColumn = `l."createdAt"`
	}
	direction := "DESC"
	if r.URL.Query().Get("sortDir") == "asc" {
		direction = "ASC"
	}
	args = append(args, limit, offset)
	rows, err := a.pool.Query(r.Context(), fmt.Sprintf(`SELECT l.id,l.action::text,l.module::text,l.description,l."entityId",l."createdAt",l.browser,l.device,l."ipAddress",l.location,u.name,u.email FROM "LogActivity" l JOIN "User" u ON u.id=l."userId" WHERE %s ORDER BY %s %s LIMIT $%d OFFSET $%d`, whereSQL, sortColumn, direction, len(args)-1, len(args)), args...)
	if err != nil {
		a.dbError(w, err)
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, action, module, desc, name, email string
		var entity, browser, device, ip, location *string
		var created time.Time
		if err := rows.Scan(&id, &action, &module, &desc, &entity, &created, &browser, &device, &ip, &location, &name, &email); err != nil {
			a.dbError(w, err)
			return
		}
		items = append(items, map[string]any{"id": id, "action": action, "module": module, "description": desc, "entityId": entity, "createdAt": created, "browser": browser, "device": device, "ipAddress": ip, "location": location, "user": map[string]any{"name": name, "email": email}})
	}
	httpx.JSON(w, 200, map[string]any{"data": items, "pagination": map[string]any{"page": page, "limit": limit, "total": total, "totalPages": (total + limit - 1) / limit}})
}

func (a *API) activityLog(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	var raw []byte
	err := a.pool.QueryRow(r.Context(), `SELECT to_jsonb(l)||jsonb_build_object('user',jsonb_build_object('id',owner.id,'name',owner.name,'email',owner.email,'role',owner.role),'periode',jsonb_build_object('id',p.id,'nama',p.nama)) FROM "LogActivity" l JOIN "User" owner ON owner.id=l."userId" JOIN "Periode" p ON p.id=l."periodeId" WHERE l.id=$1 AND (l."userId"=$2 OR $3=true)`, chi.URLParam(r, "id"), u.ID, u.IsCabang()).Scan(&raw)
	if err != nil {
		a.dbError(w, err)
		return
	}
	var data map[string]any
	_ = json.Unmarshal(raw, &data)
	httpx.JSON(w, 200, map[string]any{"data": data})
}

func (a *API) activityLogStats(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	where, args := `"userId"=$1`, []any{u.ID}
	if u.IsCabang() && r.URL.Query().Get("scope") == "global" {
		where, args = "TRUE", nil
		if userID := r.URL.Query().Get("userId"); userID != "" && userID != "ALL" {
			where, args = `"userId"=$1`, []any{userID}
		}
	}
	rows, err := a.pool.Query(r.Context(), fmt.Sprintf(`SELECT module::text,count(*) FROM "LogActivity" WHERE %s GROUP BY module`, where), args...)
	if err != nil {
		a.dbError(w, err)
		return
	}
	defer rows.Close()
	data := map[string]int{"TOTAL": 0}
	for rows.Next() {
		var module string
		var total int
		if err := rows.Scan(&module, &total); err != nil {
			a.dbError(w, err)
			return
		}
		data[module] = total
		data["TOTAL"] += total
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": data})
}

func (a *API) activityLogMonitoring(w http.ResponseWriter, r *http.Request) {
	u, _ := identity.FromContext(r.Context())
	if !u.IsCabang() {
		httpx.Error(w, http.StatusForbidden, "FORBIDDEN", "Akses hanya untuk Sekretaris Cabang")
		return
	}
	where, args := `l."createdAt">=current_date-interval '6 days'`, []any{}
	if userID := r.URL.Query().Get("userId"); userID != "" && userID != "ALL" {
		where += ` AND l."userId"=$1`
		args = append(args, userID)
	}
	distribution := []map[string]any{}
	rows, err := a.pool.Query(r.Context(), fmt.Sprintf(`SELECT l.module::text,count(*) FROM "LogActivity" l WHERE %s GROUP BY l.module ORDER BY count(*) DESC`, where), args...)
	if err != nil {
		a.dbError(w, err)
		return
	}
	for rows.Next() {
		var name string
		var value int
		_ = rows.Scan(&name, &value)
		distribution = append(distribution, map[string]any{"name": name, "value": value})
	}
	rows.Close()
	leaderboard := []map[string]any{}
	rows, _ = a.pool.Query(r.Context(), fmt.Sprintf(`SELECT u.id,u.name,u.image,count(*) FROM "LogActivity" l JOIN "User" u ON u.id=l."userId" WHERE %s GROUP BY u.id,u.name,u.image ORDER BY count(*) DESC LIMIT 10`, where), args...)
	if rows != nil {
		for rows.Next() {
			var id, name string
			var image *string
			var count int
			_ = rows.Scan(&id, &name, &image, &count)
			leaderboard = append(leaderboard, map[string]any{"id": id, "name": name, "image": image, "count": count})
		}
		rows.Close()
	}
	byDate := map[string]int{}
	rows, _ = a.pool.Query(r.Context(), fmt.Sprintf(`SELECT to_char(l."createdAt" AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD'),count(*) FROM "LogActivity" l WHERE %s GROUP BY 1`, where), args...)
	if rows != nil {
		for rows.Next() {
			var date string
			var count int
			_ = rows.Scan(&date, &count)
			byDate[date] = count
		}
		rows.Close()
	}
	timeline := []map[string]any{}
	for offset := 6; offset >= 0; offset-- {
		date := time.Now().AddDate(0, 0, -offset).Format("2006-01-02")
		timeline = append(timeline, map[string]any{"date": date, "count": byDate[date]})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": map[string]any{"distribution": distribution, "leaderboard": leaderboard, "timeline": timeline}})
}
