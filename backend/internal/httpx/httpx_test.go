package httpx

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestErrorUsesLowercaseProblemFields(t *testing.T) {
	recorder := httptest.NewRecorder()
	Error(recorder, http.StatusConflict, "NO_ACTIVE_PERIOD", "Tidak ada periode aktif")

	var body map[string]map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	problem := body["error"]
	if problem["code"] != "NO_ACTIVE_PERIOD" || problem["message"] != "Tidak ada periode aktif" {
		t.Fatalf("unexpected problem response: %#v", body)
	}
	if _, legacy := problem["Code"]; legacy {
		t.Fatalf("legacy uppercase error field is still present: %#v", problem)
	}
}
