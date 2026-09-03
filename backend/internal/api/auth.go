package api

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
)

func (a *API) login(w http.ResponseWriter, r *http.Request) {
	if err := a.auth.BeginLogin(w, r); err != nil {
		slog.Error("start SSO login failed", "error", err)
		httpx.Error(w, http.StatusBadGateway, "SSO_LOGIN_FAILED", "Tidak dapat memulai login SSO")
	}
}

func (a *API) mobileLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	if err := a.auth.BeginMobileLogin(w, r); err != nil {
		switch {
		case errors.Is(err, identity.ErrMobileAuthDisabled):
			httpx.Error(w, http.StatusServiceUnavailable, "MOBILE_AUTH_DISABLED", "Login aplikasi mobile belum dikonfigurasi")
		case errors.Is(err, identity.ErrInvalidMobileAuthRequest):
			httpx.Error(w, http.StatusBadRequest, "INVALID_AUTH_REQUEST", "Parameter login aplikasi mobile tidak valid")
		default:
			slog.Error("start mobile SSO login failed", "error", err)
			httpx.Error(w, http.StatusBadGateway, "SSO_LOGIN_FAILED", "Tidak dapat memulai login SSO")
		}
	}
}

func (a *API) authCallback(w http.ResponseWriter, r *http.Request) {
	mobile, handled, mobileErr := a.auth.CompleteMobileLogin(r)
	if handled {
		if mobileErr != nil && !errors.Is(mobileErr, identity.ErrAuthorizationDenied) {
			slog.Warn("mobile SSO callback failed", "error", mobileErr)
		}
		if mobile.RedirectURL == "" {
			http.Redirect(w, r, a.cfg.FrontendURL+"/?error=auth_error", http.StatusFound)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Referrer-Policy", "no-referrer")
		http.Redirect(w, r, mobile.RedirectURL, http.StatusFound)
		return
	}
	if mobileErr != nil {
		slog.Warn("identify mobile SSO callback failed", "error", mobileErr)
	}
	user, err := a.auth.CompleteLogin(w, r)
	if err != nil {
		if errors.Is(err, identity.ErrAuthorizationDenied) {
			http.Redirect(w, r, a.cfg.FrontendURL+"/?login=cancelled", http.StatusFound)
			return
		}
		slog.Warn("SSO callback failed", "error", err)
		http.Redirect(w, r, a.cfg.FrontendURL+"/?error=auth_error", http.StatusFound)
		return
	}
	a.recordAuthEvent(r, user.ID, "LOGIN")
	http.Redirect(w, r, a.cfg.FrontendURL+"/dashboard?login=success", http.StatusFound)
}

type mobileExchangeRequest struct {
	Code         string `json:"code"`
	CodeVerifier string `json:"codeVerifier"`
	RedirectURI  string `json:"redirectUri"`
}

func (a *API) mobileExchange(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
	var body mobileExchangeRequest
	if !httpx.Decode(w, r, &body) {
		return
	}
	session, err := a.auth.ExchangeMobileCode(r.Context(), body.Code, body.CodeVerifier, body.RedirectURI, r)
	if err != nil {
		if errors.Is(err, identity.ErrAccountInactive) {
			httpx.Error(w, http.StatusUnauthorized, "ACCOUNT_INACTIVE", "Akun Anda dinonaktifkan oleh Sekretaris Cabang")
			return
		}
		if errors.Is(err, identity.ErrInvalidMobileGrant) {
			httpx.Error(w, http.StatusBadRequest, "INVALID_GRANT", "Kode login tidak valid atau telah berakhir")
			return
		}
		slog.Error("exchange mobile login code failed", "error", err)
		httpx.Error(w, http.StatusInternalServerError, "SESSION_CREATE_FAILED", "Tidak dapat membuat sesi aplikasi")
		return
	}
	a.recordAuthEvent(r, session.User.ID, "LOGIN")
	httpx.JSON(w, http.StatusOK, map[string]any{"data": session})
}

func (a *API) mobileLogout(w http.ResponseWriter, r *http.Request) {
	userID, err := a.auth.LogoutMobile(r.Context(), r.Header.Get("Authorization"))
	if err != nil {
		slog.Warn("mobile logout failed", "error", err)
		httpx.Error(w, http.StatusInternalServerError, "LOGOUT_FAILED", "Tidak dapat mengakhiri sesi aplikasi")
		return
	}
	if userID != "" {
		a.recordAuthEvent(r, userID, "LOGOUT")
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) logout(w http.ResponseWriter, r *http.Request) {
	userID, err := a.auth.Logout(w, r)
	if err != nil {
		slog.Warn("logout failed", "error", err)
	}
	if userID != "" {
		a.recordAuthEvent(r, userID, "LOGOUT")
	}
	http.Redirect(w, r, a.cfg.FrontendURL+"/?logout=success", http.StatusFound)
}

func (a *API) recordAuthEvent(r *http.Request, userID, action string) {
	var period *string
	var name string
	if err := a.pool.QueryRow(r.Context(), `SELECT "periodeAktifId",name FROM "User" WHERE id=$1`, userID).Scan(&period, &name); err != nil {
		slog.Warn("load auth event user failed", "error", err)
		return
	}
	if period != nil {
		metadata := a.auditMetadata(r)
		_, err := a.pool.Exec(r.Context(), `INSERT INTO "LogActivity" (id,"userId","periodeId",action,module,description,browser,device,"ipAddress",location,"userAgent","createdAt") VALUES ($1,$2,$3,$4::"LogAction",'AUTH',$5,$6,$7,$8,NULLIF($9,''),$10,now())`, newID(), userID, *period, action, fmt.Sprintf("User %s ke sistem: %s", strings.ToLower(action), name), metadata.Browser, metadata.Device, metadata.IPAddress, metadata.Location, metadata.UserAgent)
		if err != nil {
			slog.Warn("persist auth activity failed", "error", err)
		}
	}
	if action == "LOGOUT" {
		_, _ = a.pool.Exec(r.Context(), `UPDATE "User" SET "lastLogoutAt"=now(),"updatedAt"=now() WHERE id=$1`, userID)
	}
	a.hub.Publish(map[string]any{"type": "auth", "action": action, "userId": userID})
}
