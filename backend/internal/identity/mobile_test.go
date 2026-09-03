package identity

import (
	"context"
	"encoding/base64"
	"errors"
	"net/url"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"golang.org/x/oauth2"
)

type queuedRowQuerier struct {
	rows []queuedRow
}

type queuedRow struct {
	values []any
	err    error
}

func (q *queuedRowQuerier) QueryRow(context.Context, string, ...any) pgx.Row {
	row := q.rows[0]
	q.rows = q.rows[1:]
	return row
}

func (r queuedRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	if len(dest) != len(r.values) {
		return errors.New("unexpected scan destination count")
	}
	for index, value := range r.values {
		switch destination := dest[index].(type) {
		case *string:
			*destination = value.(string)
		case *bool:
			*destination = value.(bool)
		default:
			return errors.New("unexpected scan destination type")
		}
	}
	return nil
}

func TestMobileRedirectAllowlistIsExactAndRejectsUnsafeURIs(t *testing.T) {
	t.Parallel()
	allowlist, err := mobileRedirectAllowlist([]string{" lacidigital://oauth/callback "})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := allowlist["lacidigital://oauth/callback"]; !ok {
		t.Fatal("expected trimmed mobile callback in allowlist")
	}
	for _, invalid := range []string{
		"http://example.org/callback",
		"lacidigital:///callback",
		"lacidigital://oauth/callback?next=https://attacker.example",
		"javascript://oauth/callback",
	} {
		if _, err := mobileRedirectAllowlist([]string{invalid}); err == nil {
			t.Fatalf("expected redirect URI %q to be rejected", invalid)
		}
	}
}

func TestValidateMobileLoginRequestRequiresExactRedirectStateAndS256(t *testing.T) {
	t.Parallel()
	auth := &Authenticator{mobileRedirectURIs: map[string]struct{}{"lacidigital://oauth/callback": {}}}
	verifier := oauth2.GenerateVerifier()
	challenge := oauth2.S256ChallengeFromVerifier(verifier)
	state := base64.RawURLEncoding.EncodeToString(make([]byte, 32))
	if err := auth.validateMobileLoginRequest("lacidigital://oauth/callback", state, challenge, "S256"); err != nil {
		t.Fatalf("valid mobile request rejected: %v", err)
	}
	for name, values := range map[string][4]string{
		"redirect":  {"lacidigital://oauth/other", state, challenge, "S256"},
		"state":     {"lacidigital://oauth/callback", "short", challenge, "S256"},
		"method":    {"lacidigital://oauth/callback", state, challenge, "plain"},
		"challenge": {"lacidigital://oauth/callback", state, "not-a-challenge", "S256"},
	} {
		if err := auth.validateMobileLoginRequest(values[0], values[1], values[2], values[3]); err == nil {
			t.Fatalf("expected invalid %s to be rejected", name)
		}
	}
}

func TestMobileCallbackContainsOnlyOneTimeCodeAndState(t *testing.T) {
	t.Parallel()
	callback, err := mobileCallbackURL("lacidigital://oauth/callback", "app-state", "laci_code_once", "")
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(callback)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Query().Get("state") != "app-state" || parsed.Query().Get("code") != "laci_code_once" {
		t.Fatalf("unexpected callback parameters: %s", callback)
	}
	for _, forbidden := range []string{"access_token", "id_token", "refresh_token"} {
		if parsed.Query().Has(forbidden) {
			t.Fatalf("callback leaked %s", forbidden)
		}
	}
}

func TestMobileSessionTokenIsRecognizedAndStoredAsHash(t *testing.T) {
	t.Parallel()
	randomPart := base64.RawURLEncoding.EncodeToString(make([]byte, 32))
	accessToken := MobileTokenPrefix + randomPart
	parsed, ok := mobileBearerToken("bearer " + accessToken)
	if !ok || parsed != accessToken {
		t.Fatal("mobile bearer token was not recognized")
	}
	if _, ok := mobileBearerToken("Bearer provider-access-token"); ok {
		t.Fatal("provider bearer must remain on the provider-token path")
	}
	stored := mobileSessionStorageKey(accessToken)
	if stored == accessToken || strings.Contains(stored, randomPart) || !strings.HasPrefix(stored, "mobile:sha256:") {
		t.Fatalf("mobile session token was not reduced to a one-way storage key: %q", stored)
	}
	if stored != mobileSessionStorageKey(accessToken) {
		t.Fatal("mobile session hash must be deterministic")
	}
}

func TestMobilePKCEAndExchangeCodeValidation(t *testing.T) {
	t.Parallel()
	verifier := oauth2.GenerateVerifier()
	if !validPKCEVerifier(verifier) || !validS256Challenge(oauth2.S256ChallengeFromVerifier(verifier)) {
		t.Fatal("standard S256 verifier/challenge must be accepted")
	}
	code := mobileExchangeCodePrefix + base64.RawURLEncoding.EncodeToString(make([]byte, 32))
	if !validMobileExchangeCode(code) {
		t.Fatal("well-formed one-time code must be accepted")
	}
	for _, invalid := range []string{"", "laci_code_short", "provider-code"} {
		if validMobileExchangeCode(invalid) {
			t.Fatalf("invalid exchange code %q was accepted", invalid)
		}
	}
}

func TestClaimMobileTransactionMarksOnlyReplayAsCompleted(t *testing.T) {
	t.Parallel()
	firstCallback := &queuedRowQuerier{rows: []queuedRow{{values: []any{
		"transaction-id", "provider-verifier", "nonce", "lacidigital://oauth/callback", "app-state", true,
	}}}}
	transaction, found, err := claimMobileTransaction(context.Background(), firstCallback, "state-hash")
	if err != nil || !found {
		t.Fatalf("first callback transaction not claimed: found=%v err=%v", found, err)
	}
	if transaction.AlreadyCompleted {
		t.Fatal("first callback was incorrectly classified as a replay")
	}
	if len(firstCallback.rows) != 0 {
		t.Fatal("first callback unexpectedly executed the replay query")
	}

	replay := &queuedRowQuerier{rows: []queuedRow{
		{err: pgx.ErrNoRows},
		{values: []any{"transaction-id", "lacidigital://oauth/callback", "app-state", true}},
	}}
	transaction, found, err = claimMobileTransaction(context.Background(), replay, "state-hash")
	if err != nil || !found {
		t.Fatalf("replayed callback transaction not found: found=%v err=%v", found, err)
	}
	if !transaction.AlreadyCompleted {
		t.Fatal("replayed callback was not classified as completed")
	}
}
