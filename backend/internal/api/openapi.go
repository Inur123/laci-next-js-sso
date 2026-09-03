package api

import (
	"net/http"

	"github.com/ipnu-ippnu/laci/backend/internal/httpx"
)

func (a *API) openapi(w http.ResponseWriter, r *http.Request) {
	paths := map[string]any{}
	for _, p := range []string{"/api/v1/auth/login", "/api/v1/auth/callback", "/api/v1/auth/logout", "/api/v1/me", "/api/v1/me/sync", "/api/v1/periods", "/api/v1/users", "/api/v1/wilayah", "/api/v1/anggota", "/api/v1/agenda-kegiatan", "/api/v1/arsip", "/api/v1/berkas-pimpinan", "/api/v1/berkas-sp", "/api/v1/pengajuan-berkas", "/api/v1/presensi", "/api/v1/activity-logs", "/api/v1/email-logs", "/api/v1/backups", "/api/v1/realtime", "/api/v1/public/stats", "/api/v1/public/agenda", "/api/v1/public/wilayah"} {
		paths[p] = map[string]any{"get": map[string]any{"responses": map[string]any{"200": map[string]string{"description": "Success"}}}}
	}
	paths["/api/v1/auth/mobile/login"] = map[string]any{
		"get": map[string]any{
			"summary": "Start native mobile SSO login",
			"parameters": []map[string]any{
				{"name": "redirect_uri", "in": "query", "required": true, "schema": map[string]string{"type": "string", "format": "uri"}},
				{"name": "state", "in": "query", "required": true, "schema": map[string]any{"type": "string", "minLength": 32, "maxLength": 128}},
				{"name": "code_challenge", "in": "query", "required": true, "schema": map[string]any{"type": "string", "minLength": 43, "maxLength": 43}},
				{"name": "code_challenge_method", "in": "query", "required": true, "schema": map[string]any{"type": "string", "enum": []string{"S256"}}},
			},
			"responses": map[string]any{
				"302": map[string]any{"description": "Redirect to the configured SSO authorization endpoint", "headers": map[string]any{"Location": map[string]any{"schema": map[string]string{"type": "string", "format": "uri"}}}},
				"400": map[string]string{"description": "Invalid state, PKCE challenge, or non-allowlisted redirect URI"},
				"503": map[string]string{"description": "Mobile authentication is not configured"},
			},
		},
	}
	paths["/api/v1/auth/mobile/exchange"] = map[string]any{
		"post": map[string]any{
			"summary": "Exchange a PKCE-bound one-time code for an application session",
			"requestBody": map[string]any{
				"required": true,
				"content": map[string]any{"application/json": map[string]any{"schema": map[string]any{
					"type": "object", "additionalProperties": false,
					"required": []string{"code", "codeVerifier", "redirectUri"},
					"properties": map[string]any{
						"code":         map[string]string{"type": "string"},
						"codeVerifier": map[string]any{"type": "string", "minLength": 43, "maxLength": 128},
						"redirectUri":  map[string]string{"type": "string", "format": "uri"},
					},
				}}},
			},
			"responses": map[string]any{
				"200": map[string]any{"description": "Six-hour opaque mobile session", "content": map[string]any{"application/json": map[string]any{"schema": map[string]string{"$ref": "#/components/schemas/MobileSessionResponse"}}}},
				"400": map[string]string{"description": "Invalid, expired, replayed, or PKCE-mismatched one-time code"},
			},
		},
	}
	paths["/api/v1/auth/mobile/logout"] = map[string]any{
		"post": map[string]any{
			"summary":  "Invalidate the presented mobile application session",
			"security": []map[string][]string{{"mobileBearer": {}}},
			"responses": map[string]any{
				"204": map[string]string{"description": "Session invalidated; the operation is idempotent"},
			},
		},
	}
	components := map[string]any{
		"securitySchemes": map[string]any{
			"session":      map[string]string{"type": "apiKey", "in": "cookie", "name": "laci_session"},
			"mobileBearer": map[string]string{"type": "http", "scheme": "bearer", "bearerFormat": "opaque application session"},
			"oidc":         map[string]string{"type": "openIdConnect", "openIdConnectUrl": a.cfg.SSOIssuer + "/.well-known/openid-configuration"},
		},
		"schemas": map[string]any{
			"MobileSessionResponse": map[string]any{
				"type":     "object",
				"required": []string{"data"},
				"properties": map[string]any{"data": map[string]any{
					"type":     "object",
					"required": []string{"accessToken", "tokenType", "expiresIn", "expiresAt", "user"},
					"properties": map[string]any{
						"accessToken": map[string]string{"type": "string"},
						"tokenType":   map[string]any{"type": "string", "enum": []string{"Bearer"}},
						"expiresIn":   map[string]any{"type": "integer", "example": 21600},
						"expiresAt":   map[string]string{"type": "string", "format": "date-time"},
						"user":        map[string]string{"type": "object"},
					},
				}},
			},
		},
	}
	httpx.JSON(w, 200, map[string]any{"openapi": "3.1.0", "info": map[string]string{"title": "Laci Digital Go API", "version": "1.0.0"}, "servers": []map[string]string{{"url": "/"}}, "paths": paths, "components": components})
}
