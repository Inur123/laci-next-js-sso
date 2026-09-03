package identity

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ipnu-ippnu/laci/backend/internal/idgen"
	"github.com/jackc/pgx/v5"
	"golang.org/x/oauth2"
)

const (
	// MobileTokenPrefix lets the API distinguish a Go-owned application session
	// from an access token issued by the upstream SSO provider.
	MobileTokenPrefix        = "laci_mob_"
	mobileExchangeCodePrefix = "laci_code_"
	mobileCodeLifetime       = 2 * time.Minute
)

var (
	ErrMobileAuthDisabled       = errors.New("mobile authentication is disabled")
	ErrInvalidMobileAuthRequest = errors.New("invalid mobile authentication request")
	ErrInvalidMobileGrant       = errors.New("invalid or expired mobile authorization grant")
)

// MobileCallbackResult is returned after the upstream SSO callback has been
// converted into a short-lived application authorization code. The URL never
// contains an SSO token or an application session token.
type MobileCallbackResult struct {
	RedirectURL string
}

type MobileSession struct {
	AccessToken string    `json:"accessToken"`
	TokenType   string    `json:"tokenType"`
	ExpiresIn   int64     `json:"expiresIn"`
	ExpiresAt   time.Time `json:"expiresAt"`
	User        User      `json:"user"`
}

type mobileTransaction struct {
	ID               string
	ProviderVerifier string
	Nonce            string
	RedirectURI      string
	AppState         string
	IsValid          bool
	AlreadyCompleted bool
}

func mobileRedirectAllowlist(values []string) (map[string]struct{}, error) {
	result := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		parsed, err := url.Parse(value)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" || parsed.User != nil || parsed.Fragment != "" || parsed.RawQuery != "" {
			return nil, fmt.Errorf("invalid MOBILE_REDIRECT_URIS entry %q", value)
		}
		switch strings.ToLower(parsed.Scheme) {
		case "http", "javascript", "data", "file":
			return nil, fmt.Errorf("insecure MOBILE_REDIRECT_URIS entry %q", value)
		}
		result[value] = struct{}{}
	}
	return result, nil
}

// BeginMobileLogin starts a backend-owned OIDC Authorization Code flow. The
// mobile app supplies a second PKCE challenge which binds the later one-time
// code exchange to that app instance.
func (a *Authenticator) BeginMobileLogin(w http.ResponseWriter, r *http.Request) error {
	redirectURI := strings.TrimSpace(r.URL.Query().Get("redirect_uri"))
	appState := strings.TrimSpace(r.URL.Query().Get("state"))
	codeChallenge := strings.TrimSpace(r.URL.Query().Get("code_challenge"))
	method := r.URL.Query().Get("code_challenge_method")
	if err := a.validateMobileLoginRequest(redirectURI, appState, codeChallenge, method); err != nil {
		return err
	}

	providerState, err := randomToken(32)
	if err != nil {
		return err
	}
	providerVerifier := oauth2.GenerateVerifier()
	nonce, err := randomToken(32)
	if err != nil {
		return err
	}
	// Keep the table small without deleting a just-expired transaction before
	// its callback can be redirected back to the app with a useful error.
	_, _ = a.pool.Exec(r.Context(), `DELETE FROM "MobileAuthTransaction" WHERE "expiresAt" < now() - interval '10 minutes'`)
	_, err = a.pool.Exec(r.Context(), `
		INSERT INTO "MobileAuthTransaction"
			(id,"providerStateHash","providerCodeVerifier",nonce,"redirectUri","appState","codeChallenge","expiresAt","createdAt","updatedAt")
		VALUES ($1,$2,$3,$4,$5,$6,$7,now()+($8::bigint*interval '1 second'),now(),now())`,
		idgen.New(), opaqueHash(providerState), providerVerifier, nonce, redirectURI, appState, codeChallenge, int64(loginLifetime/time.Second))
	if err != nil {
		return fmt.Errorf("persist mobile OAuth transaction: %w", err)
	}

	authorizationURL := a.oauth.AuthCodeURL(
		providerState,
		oauth2.AccessTypeOffline,
		oauth2.S256ChallengeOption(providerVerifier),
		oauth2.SetAuthURLParam("nonce", nonce),
		oauth2.SetAuthURLParam("prompt", "consent"),
	)
	http.Redirect(w, r, authorizationURL, http.StatusFound)
	return nil
}

func (a *Authenticator) validateMobileLoginRequest(redirectURI, appState, codeChallenge, method string) error {
	if len(a.mobileRedirectURIs) == 0 {
		return ErrMobileAuthDisabled
	}
	if _, allowed := a.mobileRedirectURIs[redirectURI]; !allowed {
		return fmt.Errorf("%w: redirect_uri is not allowed", ErrInvalidMobileAuthRequest)
	}
	if !validURLSafeSecret(appState, 32, 128) {
		return fmt.Errorf("%w: state must be 32-128 URL-safe characters", ErrInvalidMobileAuthRequest)
	}
	if method != "S256" || !validS256Challenge(codeChallenge) {
		return fmt.Errorf("%w: a valid S256 code challenge is required", ErrInvalidMobileAuthRequest)
	}
	return nil
}

// CompleteMobileLogin handles a callback only when its provider state belongs
// to a server-side mobile transaction. A non-mobile state returns handled=false
// so the caller can preserve the existing web cookie callback flow.
func (a *Authenticator) CompleteMobileLogin(r *http.Request) (result MobileCallbackResult, handled bool, err error) {
	providerState := strings.TrimSpace(r.URL.Query().Get("state"))
	if providerState == "" {
		return MobileCallbackResult{}, false, nil
	}

	transaction, found, err := a.claimMobileTransaction(r.Context(), opaqueHash(providerState))
	if err != nil {
		return MobileCallbackResult{}, false, err
	}
	if !found {
		return MobileCallbackResult{}, false, nil
	}
	handled = true
	if transaction.AlreadyCompleted {
		redirectURL, buildErr := mobileCallbackURL(transaction.RedirectURI, transaction.AppState, "", "invalid_request")
		if buildErr != nil {
			return MobileCallbackResult{}, true, buildErr
		}
		return MobileCallbackResult{RedirectURL: redirectURL}, true, ErrInvalidMobileGrant
	}

	callbackError := func(code string, cause error) (MobileCallbackResult, bool, error) {
		_, _ = a.pool.Exec(r.Context(), `DELETE FROM "MobileAuthTransaction" WHERE id=$1`, transaction.ID)
		redirectURL, buildErr := mobileCallbackURL(transaction.RedirectURI, transaction.AppState, "", code)
		if buildErr != nil {
			return MobileCallbackResult{}, true, buildErr
		}
		return MobileCallbackResult{RedirectURL: redirectURL}, true, cause
	}

	if !transaction.IsValid {
		return callbackError("login_expired", ErrInvalidMobileGrant)
	}
	if providerError := strings.TrimSpace(r.URL.Query().Get("error")); providerError != "" {
		if providerError == "access_denied" {
			return callbackError("access_denied", ErrAuthorizationDenied)
		}
		return callbackError("server_error", fmt.Errorf("SSO rejected mobile login: %s", providerError))
	}
	providerCode := strings.TrimSpace(r.URL.Query().Get("code"))
	if providerCode == "" {
		return callbackError("server_error", errors.New("mobile OAuth authorization code is missing"))
	}

	token, err := a.oauth.Exchange(r.Context(), providerCode, oauth2.VerifierOption(transaction.ProviderVerifier))
	if err != nil {
		return callbackError("server_error", fmt.Errorf("exchange mobile SSO code: %w", err))
	}
	identityClaims, idToken, err := a.claimsFromOAuthToken(r.Context(), token, transaction.Nonce)
	if err != nil {
		return callbackError("server_error", err)
	}
	user, err := a.linkAccount(r.Context(), identityClaims, token, idToken)
	if err != nil {
		if errors.Is(err, ErrAccountInactive) {
			return callbackError("account_inactive", ErrAccountInactive)
		}
		return callbackError("server_error", err)
	}

	exchangeCodeValue, err := randomToken(32)
	if err != nil {
		return callbackError("server_error", err)
	}
	exchangeCode := mobileExchangeCodePrefix + exchangeCodeValue
	command, err := a.pool.Exec(r.Context(), `
		UPDATE "MobileAuthTransaction"
		SET "exchangeCodeHash"=$2,"userId"=$3,"expiresAt"=now()+($4::bigint*interval '1 second'),"updatedAt"=now()
		WHERE id=$1 AND "providerCompletedAt" IS NOT NULL AND "exchangeCodeHash" IS NULL`,
		transaction.ID, opaqueHash(exchangeCode), user.ID, int64(mobileCodeLifetime/time.Second))
	if err != nil {
		return callbackError("server_error", fmt.Errorf("persist mobile exchange code: %w", err))
	}
	if command.RowsAffected() != 1 {
		return callbackError("server_error", errors.New("mobile OAuth transaction was already completed"))
	}
	redirectURL, err := mobileCallbackURL(transaction.RedirectURI, transaction.AppState, exchangeCode, "")
	if err != nil {
		return callbackError("server_error", err)
	}
	return MobileCallbackResult{RedirectURL: redirectURL}, true, nil
}

func (a *Authenticator) claimMobileTransaction(ctx context.Context, providerStateHash string) (mobileTransaction, bool, error) {
	return claimMobileTransaction(ctx, a.pool, providerStateHash)
}

func claimMobileTransaction(ctx context.Context, query interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, providerStateHash string) (mobileTransaction, bool, error) {
	var transaction mobileTransaction
	err := query.QueryRow(ctx, `
		UPDATE "MobileAuthTransaction"
		SET "providerCompletedAt"=now(),"updatedAt"=now()
		WHERE "providerStateHash"=$1 AND "providerCompletedAt" IS NULL
		RETURNING id,"providerCodeVerifier",nonce,"redirectUri","appState",("expiresAt">now())`, providerStateHash).
		Scan(&transaction.ID, &transaction.ProviderVerifier, &transaction.Nonce, &transaction.RedirectURI, &transaction.AppState, &transaction.IsValid)
	if err == nil {
		return transaction, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return mobileTransaction{}, false, fmt.Errorf("claim mobile OAuth transaction: %w", err)
	}

	// A matching completed state is a mobile callback replay. Return its safe,
	// pre-validated callback target instead of falling through to the web flow.
	err = query.QueryRow(ctx, `SELECT id,"redirectUri","appState",("expiresAt">now()) FROM "MobileAuthTransaction" WHERE "providerStateHash"=$1`, providerStateHash).
		Scan(&transaction.ID, &transaction.RedirectURI, &transaction.AppState, &transaction.IsValid)
	if err == nil {
		transaction.AlreadyCompleted = true
		return transaction, true, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return mobileTransaction{}, false, nil
	}
	return mobileTransaction{}, false, fmt.Errorf("read mobile OAuth transaction: %w", err)
}

// ExchangeMobileCode consumes the one-time code and creates a six-hour opaque
// application session. The database stores only a SHA-256 representation of
// the returned bearer token.
func (a *Authenticator) ExchangeMobileCode(ctx context.Context, code, codeVerifier, redirectURI string, r *http.Request) (MobileSession, error) {
	code = strings.TrimSpace(code)
	codeVerifier = strings.TrimSpace(codeVerifier)
	redirectURI = strings.TrimSpace(redirectURI)
	if _, allowed := a.mobileRedirectURIs[redirectURI]; !allowed || !validMobileExchangeCode(code) || !validPKCEVerifier(codeVerifier) {
		return MobileSession{}, ErrInvalidMobileGrant
	}
	challenge := oauth2.S256ChallengeFromVerifier(codeVerifier)

	tx, err := a.pool.Begin(ctx)
	if err != nil {
		return MobileSession{}, fmt.Errorf("begin mobile code exchange: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID string
	err = tx.QueryRow(ctx, `
		DELETE FROM "MobileAuthTransaction"
		WHERE "exchangeCodeHash"=$1 AND "codeChallenge"=$2 AND "redirectUri"=$3
			AND "providerCompletedAt" IS NOT NULL AND "userId" IS NOT NULL AND "expiresAt">now()
		RETURNING "userId"`, opaqueHash(code), challenge, redirectURI).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return MobileSession{}, ErrInvalidMobileGrant
	}
	if err != nil {
		return MobileSession{}, fmt.Errorf("consume mobile exchange code: %w", err)
	}

	user, err := userByID(ctx, tx, userID, a.providerID)
	if err != nil {
		return MobileSession{}, err
	}
	if !user.IsActive {
		return MobileSession{}, ErrAccountInactive
	}

	randomPart, err := randomToken(32)
	if err != nil {
		return MobileSession{}, err
	}
	accessToken := MobileTokenPrefix + randomPart
	expiresAt := time.Now().UTC().Add(sessionLifetime)
	_, _ = tx.Exec(ctx, `DELETE FROM "Session" WHERE "expiresAt"<=now()`)
	_, err = tx.Exec(ctx, `
		INSERT INTO "Session" (id,"userId","expiresAt",token,"ipAddress","userAgent","createdAt","updatedAt")
		VALUES ($1,$2,now()+($3::bigint*interval '1 second'),$4,$5,$6,now(),now())`,
		idgen.New(), userID, int64(sessionLifetime/time.Second), mobileSessionStorageKey(accessToken), clientIP(r), r.UserAgent())
	if err != nil {
		return MobileSession{}, fmt.Errorf("create mobile application session: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return MobileSession{}, fmt.Errorf("commit mobile code exchange: %w", err)
	}
	return MobileSession{
		AccessToken: accessToken,
		TokenType:   "Bearer",
		ExpiresIn:   int64(sessionLifetime / time.Second),
		ExpiresAt:   expiresAt.UTC(),
		User:        user,
	}, nil
}

// LogoutMobile invalidates only the presented Go-owned mobile session. It is
// intentionally idempotent and never revokes or exposes upstream SSO tokens.
func (a *Authenticator) LogoutMobile(ctx context.Context, authorization string) (string, error) {
	token, ok := mobileBearerToken(authorization)
	if !ok {
		return "", nil
	}
	var userID string
	err := a.pool.QueryRow(ctx, `DELETE FROM "Session" WHERE token=$1 RETURNING "userId"`, mobileSessionStorageKey(token)).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("delete mobile application session: %w", err)
	}
	return userID, nil
}

func userByID(ctx context.Context, query interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, userID, providerID string) (User, error) {
	var user User
	err := query.QueryRow(ctx, `
		SELECT u.id,COALESCE(a."accountId",''),u.email,u.name,u.image,
			u.role::text,u."isActive",u."emailVerified",u."periodeAktifId"
		FROM "User" u
		LEFT JOIN "Account" a ON a."userId"=u.id AND a."providerId"=$2
		WHERE u.id=$1
		ORDER BY a."updatedAt" DESC NULLS LAST
		LIMIT 1`, userID, providerID).Scan(
		&user.ID, &user.Subject, &user.Email, &user.Name, &user.Image,
		&user.Role, &user.IsActive, &user.EmailVerified, &user.ActivePeriodID,
	)
	if err != nil {
		return User{}, fmt.Errorf("load mobile session user: %w", err)
	}
	return user, nil
}

func mobileCallbackURL(redirectURI, appState, code, errorCode string) (string, error) {
	callback, err := url.Parse(redirectURI)
	if err != nil || callback.Scheme == "" || callback.Host == "" {
		return "", errors.New("invalid stored mobile callback URI")
	}
	query := callback.Query()
	query.Set("state", appState)
	if code != "" {
		query.Set("code", code)
	}
	if errorCode != "" {
		query.Set("error", errorCode)
	}
	callback.RawQuery = query.Encode()
	return callback.String(), nil
}

func mobileBearerToken(authorization string) (string, bool) {
	parts := strings.Fields(authorization)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || !strings.HasPrefix(parts[1], MobileTokenPrefix) {
		return "", false
	}
	return parts[1], true
}

func mobileSessionStorageKey(accessToken string) string {
	return "mobile:sha256:" + opaqueHash(accessToken)
}

func opaqueHash(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func validS256Challenge(challenge string) bool {
	decoded, err := base64.RawURLEncoding.DecodeString(challenge)
	return err == nil && len(challenge) == 43 && len(decoded) == sha256.Size
}

func validPKCEVerifier(verifier string) bool {
	return validURLSafeSecret(verifier, 43, 128)
}

func validMobileExchangeCode(code string) bool {
	if !strings.HasPrefix(code, mobileExchangeCodePrefix) {
		return false
	}
	decoded, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(code, mobileExchangeCodePrefix))
	return err == nil && len(decoded) == 32
}

func validURLSafeSecret(value string, minLength, maxLength int) bool {
	if len(value) < minLength || len(value) > maxLength {
		return false
	}
	for _, character := range value {
		if (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z') ||
			(character >= '0' && character <= '9') || character == '-' || character == '_' || character == '.' || character == '~' {
			continue
		}
		return false
	}
	return true
}
