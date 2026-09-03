package database

import "testing"

func TestNormalizePrismaURL(t *testing.T) {
	clean, schema, err := NormalizeURL("postgresql://u:p@localhost:5432/db?schema=tenant&sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	if schema != "tenant" {
		t.Fatalf("schema=%q", schema)
	}
	if clean != "postgresql://u:p@localhost:5432/db?sslmode=disable" {
		t.Fatalf("clean=%q", clean)
	}
}
