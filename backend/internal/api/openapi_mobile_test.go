package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ipnu-ippnu/laci/backend/internal/config"
)

func TestOpenAPIDescribesMobileAuthMethodsAndBearerScheme(t *testing.T) {
	t.Parallel()
	application := &API{cfg: config.Config{SSOIssuer: "https://sso.example.org"}}
	request := httptest.NewRequest(http.MethodGet, "/openapi.json", nil)
	recorder := httptest.NewRecorder()
	application.openapi(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected OpenAPI status %d", recorder.Code)
	}
	var document map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &document); err != nil {
		t.Fatal(err)
	}
	paths := document["paths"].(map[string]any)
	for path, method := range map[string]string{
		"/api/v1/auth/mobile/login":    "get",
		"/api/v1/auth/mobile/exchange": "post",
		"/api/v1/auth/mobile/logout":   "post",
	} {
		operation := paths[path].(map[string]any)
		if _, ok := operation[method]; !ok {
			t.Fatalf("OpenAPI path %s does not declare %s", path, method)
		}
	}
	components := document["components"].(map[string]any)
	security := components["securitySchemes"].(map[string]any)
	bearer := security["mobileBearer"].(map[string]any)
	if bearer["type"] != "http" || bearer["scheme"] != "bearer" {
		t.Fatalf("unexpected mobile bearer security scheme: %#v", bearer)
	}
}
