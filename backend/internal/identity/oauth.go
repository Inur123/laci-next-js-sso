package identity

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/ipnu-ippnu/laci/backend/internal/idgen"
	"github.com/jackc/pgx/v5"
	"golang.org/x/oauth2"
)

const (
	stateCookieName    = "laci_oauth_state"
	verifierCookieName = "laci_oauth_verifier"
	nonceCookieName    = "laci_oauth_nonce"
	sessionLifetime    = 6 * time.Hour
	loginLifetime      = 10 * time.Minute
)

// ErrAuthorizationDenied marks a login that the user deliberately cancelled
// at the SSO provider. It is an expected OAuth outcome, not an application
// failure.
var ErrAuthorizationDenied = errors.New("SSO authorization denied")

// BeginLogin starts the Authorization Code + PKCE flow against the existing SSO.
func (a *Authenticator) BeginLogin(w http.ResponseWriter, r *http.Request) error {
	state, err := randomToken(32)
	if err != nil {
		return err
	}
	verifier := oauth2.GenerateVerifier()
	nonce, err := randomToken(32)
	if err != nil {
		return err
	}
	a.setTemporaryCookie(w, stateCookieName, state)
	a.setTemporaryCookie(w, verifierCookieName, verifier)
	a.setTemporaryCookie(w, nonceCookieName, nonce)
	url := a.oauth.AuthCodeURL(
		state,
		oauth2.AccessTypeOffline,
		oauth2.S256ChallengeOption(verifier),
		oauth2.SetAuthURLParam("nonce", nonce),
		oauth2.SetAuthURLParam("prompt", "consent"),
	)
	http.Redirect(w, r, url, http.StatusFound)
	return nil
}

// CompleteLogin validates the callback, links the SSO identity to the local
// application user, persists the provider tokens in Account, and creates the
// application session owned by Go.
func (a *Authenticator) CompleteLogin(w http.ResponseWriter, r *http.Request) (User, error) {
	defer a.clearTemporaryCookies(w)
	if providerError := r.URL.Query().Get("error"); providerError != "" {
		description := strings.TrimSpace(r.URL.Query().Get("error_description"))
		if providerError == "access_denied" {
			if description != "" {
				return User{}, fmt.Errorf("%w: %s", ErrAuthorizationDenied, description)
			}
			return User{}, ErrAuthorizationDenied
		}
		if description != "" {
			return User{}, fmt.Errorf("SSO rejected login: %s (%s)", providerError, description)
		}
		return User{}, fmt.Errorf("SSO rejected login: %s", providerError)
	}
	stateCookie, stateErr := r.Cookie(stateCookieName)
	verifierCookie, verifierErr := r.Cookie(verifierCookieName)
	nonceCookie, nonceErr := r.Cookie(nonceCookieName)
	if stateErr != nil || verifierErr != nil || nonceErr != nil || stateCookie.Value == "" || verifierCookie.Value == "" || nonceCookie.Value == "" {
		return User{}, errors.New("OAuth state, nonce, or PKCE verifier is missing")
	}
	if r.URL.Query().Get("state") != stateCookie.Value {
		return User{}, errors.New("OAuth state is invalid")
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		return User{}, errors.New("OAuth authorization code is missing")
	}
	token, err := a.oauth.Exchange(r.Context(), code, oauth2.VerifierOption(verifierCookie.Value))
	if err != nil {
		return User{}, fmt.Errorf("exchange SSO code: %w", err)
	}
	identityClaims, idToken, err := a.claimsFromOAuthToken(r.Context(), token, nonceCookie.Value)
	if err != nil {
		return User{}, err
	}
	user, err := a.linkAccount(r.Context(), identityClaims, token, idToken)
	if err != nil {
		return User{}, err
	}
	sessionToken, expiresAt, err := a.createSession(r.Context(), user.ID, r)
	if err != nil {
		return User{}, err
	}
	a.setSessionCookie(w, sessionToken, expiresAt)
	return user, nil
}

func (a *Authenticator) claimsFromOAuthToken(ctx context.Context, token *oauth2.Token, expectedNonce string) (claims, string, error) {
	var result claims
	idToken, _ := token.Extra("id_token").(string)
	if idToken == "" {
		return claims{}, "", errors.New("SSO token response does not contain an ID token")
	}
	if idToken != "" {
		verified, err := a.verifier.Verify(ctx, idToken)
		if err != nil {
			return claims{}, "", fmt.Errorf("verify SSO ID token: %w", err)
		}
		if expectedNonce == "" || verified.Nonce != expectedNonce {
			return claims{}, "", errors.New("SSO ID token nonce is invalid")
		}
		if err := verified.Claims(&result); err != nil {
			return claims{}, "", fmt.Errorf("read SSO claims: %w", err)
		}
	}
	// Avatar lives in the SSO userinfo response rather than the ID token for
	// existing accounts. Fetch it on every completed login, but keep login
	// available when userinfo is temporarily unavailable and the verified ID
	// token already contains the required identity claims.
	info, infoErr := a.provider.UserInfo(ctx, oauth2.StaticTokenSource(token))
	if infoErr == nil {
		profile := claims{Subject: info.Subject, Email: info.Email}
		if err := info.Claims(&profile); err != nil {
			if result.Subject == "" || result.Email == "" {
				return claims{}, "", fmt.Errorf("read SSO userinfo claims: %w", err)
			}
		} else {
			result = mergeClaims(result, profile)
		}
	} else if result.Subject == "" || result.Email == "" {
		return claims{}, "", fmt.Errorf("read SSO userinfo: %w", infoErr)
	}
	if result.Subject == "" || result.Email == "" {
		return claims{}, "", errors.New("SSO must return sub and email claims")
	}
	if strings.TrimSpace(result.Name) == "" {
		result.Name = strings.Split(result.Email, "@")[0]
	}
	return result, idToken, nil
}

func (a *Authenticator) linkAccount(ctx context.Context, c claims, token *oauth2.Token, idToken string) (User, error) {
	user, err := a.applicationUser(ctx, c)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return User{}, err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		user = User{
			ID: idgen.New(), Subject: c.Subject, Email: c.Email, Name: c.Name,
			Role: "SEKRETARIS_PAC", IsActive: true, EmailVerified: true,
		}
		_, err = a.pool.Exec(ctx, `
			INSERT INTO "User" (id,name,email,"emailVerified",role,"isActive","createdAt","updatedAt")
			VALUES ($1,$2,$3,true,'SEKRETARIS_PAC',true,now(),now())
			ON CONFLICT (email) DO NOTHING`, user.ID, user.Name, user.Email)
		if err != nil {
			return User{}, fmt.Errorf("create application user: %w", err)
		}
		user, err = a.applicationUser(ctx, c)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return User{}, err
		}
		if errors.Is(err, pgx.ErrNoRows) {
			// The user exists by email but has not been linked yet.
			err = a.pool.QueryRow(ctx, `SELECT id,$1,email,name,image,role::text,"isActive","emailVerified","periodeAktifId" FROM "User" WHERE lower(email)=lower($2) LIMIT 1`, c.Subject, c.Email).
				Scan(&user.ID, &user.Subject, &user.Email, &user.Name, &user.Image, &user.Role, &user.IsActive, &user.EmailVerified, &user.ActivePeriodID)
			if err != nil {
				return User{}, fmt.Errorf("map new application user: %w", err)
			}
		}
	}
	var expiresAt any
	if !token.Expiry.IsZero() {
		expiresAt = token.Expiry
	}
	_, err = a.pool.Exec(ctx, `
		INSERT INTO "Account" (id,"userId","accountId","providerId","accessToken","refreshToken","idToken","expiresAt","accessTokenExpiresAt",scope,"createdAt","updatedAt")
		VALUES ($1,$2,$3,$4,$5,NULLIF($6,''),NULLIF($7,''),$8,$8,NULLIF($9,''),now(),now())
		ON CONFLICT ("providerId","accountId") DO UPDATE SET
			"userId"=excluded."userId", "accessToken"=excluded."accessToken",
			"refreshToken"=COALESCE(excluded."refreshToken","Account"."refreshToken"),
			"idToken"=COALESCE(excluded."idToken","Account"."idToken"),
			"expiresAt"=excluded."expiresAt", "accessTokenExpiresAt"=excluded."accessTokenExpiresAt",
			scope=excluded.scope, "updatedAt"=now()`,
		idgen.New(), user.ID, c.Subject, a.providerID, token.AccessToken, token.RefreshToken, idToken, expiresAt, tokenTypeScope(token))
	if err != nil {
		return User{}, fmt.Errorf("persist SSO account: %w", err)
	}
	if avatar, present := normalizedSSOAvatar(c.Avatar); present {
		if _, err := a.pool.Exec(ctx, `UPDATE "User" SET image=$1,"updatedAt"=now() WHERE id=$2`, avatar, user.ID); err != nil {
			return User{}, fmt.Errorf("sync SSO avatar: %w", err)
		}
		user.Image = avatar
	}
	user.Subject = c.Subject
	return user, nil
}

// RefreshSSOProfile refreshes the provider token when needed and synchronizes
// profile fields owned by SSO without changing the Go-owned mobile session.
func (a *Authenticator) RefreshSSOProfile(ctx context.Context, userID string) (User, error) {
	var accountID string
	var accessToken, refreshToken *string
	var expiresAt *time.Time
	err := a.pool.QueryRow(ctx, `
		SELECT "accountId","accessToken","refreshToken",COALESCE("accessTokenExpiresAt","expiresAt")
		FROM "Account"
		WHERE "userId"=$1 AND "providerId"=$2
		ORDER BY "updatedAt" DESC
		LIMIT 1`, userID, a.providerID).Scan(&accountID, &accessToken, &refreshToken, &expiresAt)
	if err != nil {
		return User{}, fmt.Errorf("load SSO account: %w", err)
	}
	if accessToken == nil || strings.TrimSpace(*accessToken) == "" {
		return User{}, errors.New("SSO account does not contain an access token")
	}
	providerToken := &oauth2.Token{AccessToken: *accessToken}
	if refreshToken != nil {
		providerToken.RefreshToken = *refreshToken
	}
	if expiresAt != nil {
		providerToken.Expiry = *expiresAt
	}
	providerToken, err = a.oauth.TokenSource(ctx, providerToken).Token()
	if err != nil {
		return User{}, fmt.Errorf("refresh SSO profile token: %w", err)
	}
	var nextExpiry any
	if !providerToken.Expiry.IsZero() {
		nextExpiry = providerToken.Expiry
	}
	if _, err := a.pool.Exec(ctx, `
		UPDATE "Account" SET "accessToken"=$1,
			"refreshToken"=COALESCE(NULLIF($2,''),"refreshToken"),
			"accessTokenExpiresAt"=$3,"expiresAt"=$3,"updatedAt"=now()
		WHERE "userId"=$4 AND "providerId"=$5 AND "accountId"=$6`,
		providerToken.AccessToken, providerToken.RefreshToken, nextExpiry,
		userID, a.providerID, accountID); err != nil {
		return User{}, fmt.Errorf("persist refreshed SSO token: %w", err)
	}

	info, err := a.provider.UserInfo(ctx, oauth2.StaticTokenSource(providerToken))
	if err != nil {
		return User{}, fmt.Errorf("read refreshed SSO userinfo: %w", err)
	}
	profile := claims{Subject: info.Subject, Email: info.Email}
	if err := info.Claims(&profile); err != nil {
		return User{}, fmt.Errorf("read refreshed SSO claims: %w", err)
	}
	if profile.Subject == "" {
		profile.Subject = info.Subject
	}
	if profile.Subject != accountID {
		return User{}, errors.New("refreshed SSO subject does not match the linked account")
	}
	if avatar, present := normalizedSSOAvatar(profile.Avatar); present {
		if _, err := a.pool.Exec(ctx, `UPDATE "User" SET image=$1,"updatedAt"=now() WHERE id=$2`, avatar, userID); err != nil {
			return User{}, fmt.Errorf("sync refreshed SSO avatar: %w", err)
		}
	}
	return userByID(ctx, a.pool, userID, a.providerID)
}

func tokenTypeScope(token *oauth2.Token) string {
	if scope, ok := token.Extra("scope").(string); ok {
		return scope
	}
	return "openid profile email"
}

func (a *Authenticator) createSession(ctx context.Context, userID string, r *http.Request) (string, time.Time, error) {
	token, err := randomToken(32)
	if err != nil {
		return "", time.Time{}, err
	}
	expiresAt := time.Now().Add(sessionLifetime)
	_, _ = a.pool.Exec(ctx, `DELETE FROM "Session" WHERE "expiresAt"<=now()`)
	_, err = a.pool.Exec(ctx, `INSERT INTO "Session" (id,"userId","expiresAt",token,"ipAddress","userAgent","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now(),now())`,
		idgen.New(), userID, expiresAt, token, clientIP(r), r.UserAgent())
	if err != nil {
		return "", time.Time{}, fmt.Errorf("create application session: %w", err)
	}
	return token, expiresAt, nil
}

// Logout invalidates the Go-owned application session and clears its cookie.
func (a *Authenticator) Logout(w http.ResponseWriter, r *http.Request) (string, error) {
	var userID string
	if cookie, err := r.Cookie(a.cookieName); err == nil && cookie.Value != "" {
		err = a.pool.QueryRow(r.Context(), `DELETE FROM "Session" WHERE token=$1 RETURNING "userId"`, cookie.Value).Scan(&userID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return "", fmt.Errorf("delete application session: %w", err)
		}
	}
	a.clearSessionCookie(w)
	return userID, nil
}

func (a *Authenticator) setTemporaryCookie(w http.ResponseWriter, name, value string) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: value, Path: "/", Domain: a.cookieDomain, HttpOnly: true, Secure: a.secureCookie, SameSite: http.SameSiteLaxMode, MaxAge: int(loginLifetime.Seconds())})
}

func (a *Authenticator) clearTemporaryCookies(w http.ResponseWriter) {
	for _, name := range []string{stateCookieName, verifierCookieName, nonceCookieName} {
		http.SetCookie(w, &http.Cookie{Name: name, Path: "/", Domain: a.cookieDomain, HttpOnly: true, Secure: a.secureCookie, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	}
}

func (a *Authenticator) setSessionCookie(w http.ResponseWriter, value string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{Name: a.cookieName, Value: value, Path: "/", Domain: a.cookieDomain, HttpOnly: true, Secure: a.secureCookie, SameSite: http.SameSiteLaxMode, Expires: expiresAt, MaxAge: int(sessionLifetime.Seconds())})
}

func (a *Authenticator) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: a.cookieName, Path: "/", Domain: a.cookieDomain, HttpOnly: true, Secure: a.secureCookie, SameSite: http.SameSiteLaxMode, MaxAge: -1})
}

func randomToken(size int) (string, error) {
	value := make([]byte, size)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate secure token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func clientIP(r *http.Request) string {
	if forwarded := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0]); forwarded != "" {
		return forwarded
	}
	return r.RemoteAddr
}
