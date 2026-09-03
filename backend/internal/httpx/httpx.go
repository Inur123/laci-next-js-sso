package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

type ErrorBody struct {
	Error ErrorDetail `json:"error"`
}
type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

func JSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func Error(w http.ResponseWriter, status int, code, message string, details ...any) {
	var d any
	if len(details) > 0 {
		d = details[0]
	}
	JSON(w, status, ErrorBody{Error: ErrorDetail{Code: code, Message: message, Details: d}})
}

func Decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		message := "Payload tidak valid"
		var max *http.MaxBytesError
		if errors.As(err, &max) {
			message = "Payload terlalu besar"
		} else if !errors.Is(err, io.EOF) {
			message = fmt.Sprintf("Payload tidak valid: %v", err)
		}
		Error(w, http.StatusBadRequest, "VALIDATION_ERROR", message)
		return false
	}
	return true
}

func Pagination(r *http.Request) (page, limit, offset int) {
	page, _ = strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ = strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}
	return page, limit, (page - 1) * limit
}

func Required(values map[string]string) map[string]string {
	err := map[string]string{}
	for field, value := range values {
		if strings.TrimSpace(value) == "" {
			err[field] = "Wajib diisi"
		}
	}
	return err
}
