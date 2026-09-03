package idgen

import (
	"crypto/rand"
	"fmt"
)

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"

// New returns a Prisma CUID-compatible identifier shape: lowercase, 25 chars,
// and prefixed with c. Existing IDs are never rewritten.
func New() string {
	random := make([]byte, 24)
	if _, err := rand.Read(random); err != nil {
		panic(fmt.Errorf("generate id: %w", err))
	}
	result := make([]byte, 25)
	result[0] = 'c'
	for index, value := range random {
		result[index+1] = alphabet[int(value)%len(alphabet)]
	}
	return string(result)
}
