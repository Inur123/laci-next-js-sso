package cryptox

import (
	"bytes"
	"testing"
	"time"
)

func TestTextAndPlaintextCompatibility(t *testing.T) {
	s, err := New("test-secret")
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Nomor 001/PC", "Unicode — أعضاء", ""} {
		gotEncrypted, err := s.EncryptText(want)
		if err != nil {
			t.Fatal(err)
		}
		got, err := s.DecryptText(gotEncrypted)
		if err != nil || got != want {
			t.Fatalf("round trip: got %q err=%v", got, err)
		}
	}
	got, err := s.DecryptText("legacy plaintext")
	if err != nil || got != "legacy plaintext" {
		t.Fatalf("plaintext fallback: %q %v", got, err)
	}
}

func TestFileCompatibility(t *testing.T) {
	s, _ := New("test-secret")
	want := bytes.Repeat([]byte("pdf-ish-data\x00"), 100)
	encrypted, err := s.EncryptFile(want)
	if err != nil {
		t.Fatal(err)
	}
	got, err := s.DecryptFile(encrypted)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want) {
		t.Fatal("file mismatch")
	}
}

func TestHashAndToken(t *testing.T) {
	if HashNormalized(" User@Example.COM ") != HashNormalized("user@example.com") {
		t.Fatal("normalization mismatch")
	}
	s, _ := New("test-secret")
	token, err := s.DownloadToken("abc", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if id, ok := s.VerifyDownloadToken(token); !ok || id != "abc" {
		t.Fatalf("token: %q %v", id, ok)
	}
}
