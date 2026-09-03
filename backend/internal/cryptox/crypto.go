package cryptox

import (
	"bytes"
	"compress/gzip"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"golang.org/x/crypto/scrypt"
)

const salt = "laci-ipnu-ippnu-salt-2025"

type Service struct{ key []byte }

func New(secret string) (*Service, error) {
	key, err := scrypt.Key([]byte(secret), []byte(salt), 16384, 8, 1, 32)
	if err != nil {
		return nil, err
	}
	return &Service{key: key}, nil
}

func (s *Service) EncryptText(plain string) (string, error) {
	iv := make([]byte, aes.BlockSize)
	if _, err := rand.Read(iv); err != nil {
		return "", err
	}
	padded := pkcs7Pad([]byte(plain), aes.BlockSize)
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return "", err
	}
	out := make([]byte, len(padded))
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(out, padded)
	return hex.EncodeToString(iv) + ":" + hex.EncodeToString(out), nil
}

func (s *Service) DecryptText(value string) (string, error) {
	parts := strings.Split(value, ":")
	if len(parts) != 2 || len(parts[0]) != aes.BlockSize*2 {
		return value, nil
	}
	iv, err := hex.DecodeString(parts[0])
	if err != nil {
		return value, nil
	}
	data, err := hex.DecodeString(parts[1])
	if err != nil || len(data) == 0 || len(data)%aes.BlockSize != 0 {
		return value, nil
	}
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return "", err
	}
	plain := make([]byte, len(data))
	cipher.NewCBCDecrypter(block, iv).CryptBlocks(plain, data)
	plain, err = pkcs7Unpad(plain, aes.BlockSize)
	if err != nil {
		return "", fmt.Errorf("decrypt text: %w", err)
	}
	return string(plain), nil
}

func (s *Service) EncryptFile(data []byte) ([]byte, error) {
	var compressed bytes.Buffer
	zw := gzip.NewWriter(&compressed)
	if _, err := zw.Write(data); err != nil {
		return nil, err
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	iv := make([]byte, aes.BlockSize)
	if _, err := rand.Read(iv); err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return nil, err
	}
	padded := pkcs7Pad(compressed.Bytes(), aes.BlockSize)
	out := make([]byte, aes.BlockSize+len(padded))
	copy(out, iv)
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(out[aes.BlockSize:], padded)
	return out, nil
}

func (s *Service) DecryptFile(data []byte) ([]byte, error) {
	if len(data) <= aes.BlockSize || (len(data)-aes.BlockSize)%aes.BlockSize != 0 {
		return nil, errors.New("invalid encrypted file")
	}
	iv, encrypted := data[:aes.BlockSize], data[aes.BlockSize:]
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return nil, err
	}
	plain := make([]byte, len(encrypted))
	cipher.NewCBCDecrypter(block, iv).CryptBlocks(plain, encrypted)
	plain, err = pkcs7Unpad(plain, aes.BlockSize)
	if err != nil {
		return nil, err
	}
	zr, err := gzip.NewReader(bytes.NewReader(plain))
	if err != nil {
		return nil, err
	}
	defer zr.Close()
	return io.ReadAll(zr)
}

func (s *Service) DownloadToken(id string, ttl time.Duration) (string, error) {
	return s.EncryptText(fmt.Sprintf("%s:%d", id, time.Now().Add(ttl).UnixMilli()))
}

func (s *Service) VerifyDownloadToken(token string) (string, bool) {
	plain, err := s.DecryptText(token)
	if err != nil {
		return "", false
	}
	i := strings.LastIndex(plain, ":")
	if i < 1 {
		return "", false
	}
	var expiry int64
	if _, err := fmt.Sscan(plain[i+1:], &expiry); err != nil || time.Now().UnixMilli() > expiry {
		return "", false
	}
	return plain[:i], true
}

func HashNormalized(value string) string {
	sum := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(value))))
	return hex.EncodeToString(sum[:])
}

func pkcs7Pad(data []byte, size int) []byte {
	padding := size - len(data)%size
	return append(data, bytes.Repeat([]byte{byte(padding)}, padding)...)
}

func pkcs7Unpad(data []byte, size int) ([]byte, error) {
	if len(data) == 0 || len(data)%size != 0 {
		return nil, errors.New("invalid padding")
	}
	n := int(data[len(data)-1])
	if n == 0 || n > size || n > len(data) {
		return nil, errors.New("invalid padding")
	}
	for _, b := range data[len(data)-n:] {
		if int(b) != n {
			return nil, errors.New("invalid padding")
		}
	}
	return data[:len(data)-n], nil
}
