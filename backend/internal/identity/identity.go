package identity

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/ipnu-ippnu/laci/backend/internal/config"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/oauth2"
)

type User struct {
	ID             string  `json:"id"`
	Subject        string  `json:"subject"`
	Email          string  `json:"email"`
	Name           string  `json:"name"`
	Image          *string `json:"image"`
	Role           string  `json:"role"`
	IsActive       bool    `json:"isActive"`
	EmailVerified  bool    `json:"emailVerified"`
	ActivePeriodID *string `json:"periodeAktifId"`
}

func (u User) IsCabang() bool { return u.Role == "SEKRETARIS_CABANG" }

type Authenticator struct {
	provider           *oidc.Provider
	verifier           *oidc.IDTokenVerifier
	oauth              oauth2.Config
	pool               *pgxpool.Pool
	providerID         string
	frontendURL        string
	cookieName         string
	cookieDomain       string
	secureCookie       bool
	mobileRedirectURIs map[string]struct{}
}

type claims struct {
	Subject string  `json:"sub"`
	Email   string  `json:"email"`
	Name    string  `json:"name"`
	Avatar  *string `json:"avatar"`
}

// normalizedSSOAvatar keeps the SSO profile authoritative without allowing an
// invalid or non-web URI to replace a previously usable profile picture. A
// present but empty claim intentionally clears the picture.
func normalizedSSOAvatar(raw *string) (avatar *string, present bool) {
	if raw == nil {
		return nil, false
	}
	value := strings.TrimSpace(*raw)
	if value == "" {
		return nil, true
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		return nil, false
	}
	return &value, true
}

func mergeClaims(base, profile claims) claims {
	if base.Subject == "" {
		base.Subject = profile.Subject
	}
	if base.Email == "" {
		base.Email = profile.Email
	}
	if strings.TrimSpace(base.Name) == "" {
		base.Name = profile.Name
	}
	if profile.Avatar != nil {
		base.Avatar = profile.Avatar
	}
	return base
}

// ErrAccountInactive is stable across callback, exchange, and API middleware
// so native clients can display the actual reason a session was rejected.
var ErrAccountInactive = errors.New("account inactive")

func New(ctx context.Context, cfg config.Config, pool *pgxpool.Pool) (*Authenticator, error) {
	provider, err := oidc.NewProvider(ctx, cfg.SSOIssuer)
	if err != nil {
		return nil, fmt.Errorf("discover SSO: %w", err)
	}
	mobileRedirectURIs, err := mobileRedirectAllowlist(cfg.MobileRedirectURIs)
	if err != nil {
		return nil, err
	}
	return &Authenticator{
		provider: provider,
		verifier: provider.Verifier(&oidc.Config{ClientID: cfg.SSOClientID}),
		oauth: oauth2.Config{
			ClientID:     cfg.SSOClientID,
			ClientSecret: cfg.SSOClientSecret,
			Endpoint:     provider.Endpoint(),
			RedirectURL:  cfg.SSORedirectURL,
			Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
		},
		pool:               pool,
		providerID:         "sso-ipnu",
		frontendURL:        cfg.FrontendURL,
		cookieName:         "laci_session",
		cookieDomain:       cfg.SessionCookieDomain,
		secureCookie:       strings.HasPrefix(cfg.SSORedirectURL, "https://"),
		mobileRedirectURIs: mobileRedirectURIs,
	}, nil
}

func (a *Authenticator) Authenticate(ctx context.Context, bearer string) (User, error) {
	bearer = strings.TrimSpace(strings.TrimPrefix(bearer, "Bearer "))
	if bearer == "" {
		return User{}, errors.New("missing bearer token")
	}
	var c claims
	if strings.Count(bearer, ".") == 2 {
		token, err := a.verifier.Verify(ctx, bearer)
		if err != nil {
			return User{}, fmt.Errorf("verify OIDC token: %w", err)
		}
		if err := token.Claims(&c); err != nil {
			return User{}, err
		}
	} else {
		info, err := a.provider.UserInfo(ctx, oauth2.StaticTokenSource(&oauth2.Token{AccessToken: bearer}))
		if err != nil {
			return User{}, fmt.Errorf("SSO userinfo: %w", err)
		}
		c.Subject, c.Email = info.Subject, info.Email
		_ = info.Claims(&c)
	}
	if c.Subject == "" {
		return User{}, errors.New("SSO subject is empty")
	}
	return a.applicationUser(ctx, c)
}

func (a *Authenticator) AuthenticateRequest(r *http.Request) (User, error) {
	if authorization := r.Header.Get("Authorization"); strings.TrimSpace(authorization) != "" {
		if token, ok := mobileBearerToken(authorization); ok {
			return a.authenticateApplicationSession(r.Context(), mobileSessionStorageKey(token))
		}
		return a.Authenticate(r.Context(), authorization)
	}
	cookie, err := r.Cookie(a.cookieName)
	if err != nil || cookie.Value == "" {
		return User{}, errors.New("missing session cookie")
	}
	return a.authenticateApplicationSession(r.Context(), cookie.Value)
}

func (a *Authenticator) authenticateApplicationSession(ctx context.Context, storedToken string) (User, error) {
	var u User
	err := a.pool.QueryRow(ctx, `
		SELECT u.id, COALESCE(a."accountId",''), u.email, u.name, u.image,
			u.role::text, u."isActive", u."emailVerified", u."periodeAktifId"
		FROM "Session" s
		JOIN "User" u ON u.id=s."userId"
		LEFT JOIN "Account" a ON a."userId"=u.id AND a."providerId"=$2
		WHERE s.token=$1 AND s."expiresAt">now()
		ORDER BY a."updatedAt" DESC NULLS LAST
		LIMIT 1`, storedToken, a.providerID).Scan(
		&u.ID, &u.Subject, &u.Email, &u.Name, &u.Image, &u.Role,
		&u.IsActive, &u.EmailVerified, &u.ActivePeriodID,
	)
	if err != nil {
		return User{}, fmt.Errorf("validate session: %w", err)
	}
	if !u.IsActive {
		return User{}, ErrAccountInactive
	}
	return u, nil
}

func (a *Authenticator) applicationUser(ctx context.Context, c claims) (User, error) {
	var u User
	err := a.pool.QueryRow(ctx, `
		SELECT u.id, $1, u.email, u.name, u.image, u.role::text, u."isActive", u."emailVerified", u."periodeAktifId"
		FROM "User" u
		JOIN "Account" a ON a."userId" = u.id
		WHERE a."providerId"=$2 AND a."accountId"=$1
		LIMIT 1`, c.Subject, a.providerID).Scan(&u.ID, &u.Subject, &u.Email, &u.Name, &u.Image, &u.Role, &u.IsActive, &u.EmailVerified, &u.ActivePeriodID)
	if errors.Is(err, pgx.ErrNoRows) && c.Email != "" {
		err = a.pool.QueryRow(ctx, `SELECT id,$1,email,name,image,role::text,"isActive","emailVerified","periodeAktifId" FROM "User" WHERE lower(email)=lower($2) LIMIT 1`, c.Subject, c.Email).
			Scan(&u.ID, &u.Subject, &u.Email, &u.Name, &u.Image, &u.Role, &u.IsActive, &u.EmailVerified, &u.ActivePeriodID)
	}
	if err != nil {
		return User{}, fmt.Errorf("map application user: %w", err)
	}
	if !u.IsActive {
		return User{}, ErrAccountInactive
	}
	return u, nil
}

type contextKey struct{}

func WithUser(ctx context.Context, u User) context.Context {
	return context.WithValue(ctx, contextKey{}, u)
}
func FromContext(ctx context.Context) (User, bool) {
	u, ok := ctx.Value(contextKey{}).(User)
	return u, ok
}

func (a *Authenticator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, err := a.AuthenticateRequest(r)
		if err != nil {
			if errors.Is(err, ErrAccountInactive) {
				writeAuthError(w, http.StatusUnauthorized, "ACCOUNT_INACTIVE", "Akun Anda dinonaktifkan oleh Sekretaris Cabang")
				return
			}
			writeAuthError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Sesi tidak valid atau telah berakhir")
			return
		}
		next.ServeHTTP(w, r.WithContext(WithUser(r.Context(), u)))
	})
}

func RequireCabang(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := FromContext(r.Context())
		if !ok || !u.IsCabang() {
			writeAuthError(w, http.StatusForbidden, "FORBIDDEN", "Akses hanya untuk Sekretaris Cabang")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireVerified mirrors the web/mobile product gate for internal features.
// Authentication alone still permits Dashboard and Profile routes, which are
// mounted outside this middleware by the API router.
func RequireVerified(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := FromContext(r.Context())
		if !ok || !u.EmailVerified {
			writeAuthError(w, http.StatusForbidden, "EMAIL_UNVERIFIED", "Fitur ini tersedia setelah email SSO terverifikasi")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeAuthError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = fmt.Fprintf(w, `{"error":{"code":%q,"message":%q}}`, code, message)
}
