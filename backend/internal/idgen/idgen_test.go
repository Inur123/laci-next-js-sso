package idgen

import (
	"regexp"
	"testing"
)

func TestNewShapeAndUniqueness(t *testing.T) {
	t.Parallel()
	pattern := regexp.MustCompile(`^c[0-9a-z]{24}$`)
	seen := map[string]bool{}
	for index := 0; index < 1000; index++ {
		id := New()
		if !pattern.MatchString(id) {
			t.Fatalf("invalid CUID shape: %q", id)
		}
		if seen[id] {
			t.Fatalf("duplicate ID: %q", id)
		}
		seen[id] = true
	}
}
