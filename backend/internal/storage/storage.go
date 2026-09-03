package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/ipnu-ippnu/laci/backend/internal/config"
)

type Service struct {
	client  *s3.Client
	presign *s3.PresignClient
	bucket  string
}

func New(ctx context.Context, cfg config.Config) (*Service, error) {
	if cfg.R2AccountID == "" || cfg.R2AccessKeyID == "" || cfg.R2SecretAccessKey == "" || cfg.R2BucketName == "" {
		return &Service{}, nil
	}
	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.R2AccountID)
	awscfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion("auto"), awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.R2AccessKeyID, cfg.R2SecretAccessKey, "")))
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(awscfg, func(o *s3.Options) { o.BaseEndpoint = aws.String(endpoint); o.UsePathStyle = true })
	return &Service{client: client, presign: s3.NewPresignClient(client), bucket: cfg.R2BucketName}, nil
}

func (s *Service) Enabled() bool { return s.client != nil }
func (s *Service) Put(ctx context.Context, key, contentType string, data []byte) error {
	if !s.Enabled() {
		return errors.New("R2 belum dikonfigurasi")
	}
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{Bucket: &s.bucket, Key: &key, Body: bytes.NewReader(data), ContentType: &contentType})
	return err
}
func (s *Service) Get(ctx context.Context, key string) ([]byte, string, error) {
	if !s.Enabled() {
		return nil, "", errors.New("R2 belum dikonfigurasi")
	}
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{Bucket: &s.bucket, Key: &key})
	if err != nil {
		return nil, "", err
	}
	defer out.Body.Close()
	data, err := io.ReadAll(out.Body)
	contentType := "application/octet-stream"
	if out.ContentType != nil {
		contentType = *out.ContentType
	}
	return data, contentType, err
}
func (s *Service) Delete(ctx context.Context, key string) error {
	if !s.Enabled() || strings.TrimSpace(key) == "" {
		return nil
	}
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &s.bucket, Key: &key})
	return err
}
func (s *Service) SignedURL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	if !s.Enabled() {
		return "", errors.New("R2 belum dikonfigurasi")
	}
	out, err := s.presign.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: &s.bucket, Key: &key}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", err
	}
	return out.URL, nil
}
func (s *Service) List(ctx context.Context, prefix string) ([]map[string]any, error) {
	if !s.Enabled() {
		return []map[string]any{}, nil
	}
	out, err := s.client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: &s.bucket, Prefix: &prefix})
	if err != nil {
		return nil, err
	}
	items := make([]map[string]any, 0, len(out.Contents))
	for _, item := range out.Contents {
		if item.Key == nil {
			continue
		}
		items = append(items, map[string]any{"key": *item.Key, "size": item.Size, "lastModified": item.LastModified})
	}
	return items, nil
}
