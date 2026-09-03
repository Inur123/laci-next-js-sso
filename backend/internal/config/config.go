package config

import (
	"bufio"
	"errors"
	"os"
	"strings"
	"time"
)

type Config struct {
	Environment, HTTPAddr, FrontendURL, DatabaseURL             string
	SSOIssuer, SSOClientID, SSOClientSecret, SSORedirectURL     string
	SessionCookieDomain                                         string
	MobileRedirectURIs                                          []string
	EncryptionKey, APIKey, CronSecret                           string
	R2AccountID, R2AccessKeyID, R2SecretAccessKey, R2BucketName string
	SMTPHost, SMTPPort, SMTPUser, SMTPPass, MailFromAddress     string
	MailFromName, AdminNotificationEmail                        string
	TrustedProxyHeaders                                         bool
	ShutdownTimeout                                             time.Duration
}

func Load() (Config, error) {
	_ = loadDotEnv(".env")
	c := Config{
		Environment:         getenv("APP_ENV", "development"),
		HTTPAddr:            getenv("HTTP_ADDR", ":8080"),
		FrontendURL:         strings.TrimRight(getenv("FRONTEND_URL", "http://localhost:3000"), "/"),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		SSOIssuer:           strings.TrimRight(os.Getenv("SSO_ISSUER"), "/"),
		SSOClientID:         os.Getenv("SSO_CLIENT_ID"),
		SSOClientSecret:     os.Getenv("SSO_CLIENT_SECRET"),
		SSORedirectURL:      os.Getenv("SSO_REDIRECT_URL"),
		SessionCookieDomain: os.Getenv("SESSION_COOKIE_DOMAIN"),
		MobileRedirectURIs:  splitCSV(os.Getenv("MOBILE_REDIRECT_URIS")),
		EncryptionKey:       os.Getenv("ENCRYPTION_KEY"),
		APIKey:              os.Getenv("API_KEY"), CronSecret: os.Getenv("CRON_SECRET"),
		R2AccountID: os.Getenv("R2_ACCOUNT_ID"), R2AccessKeyID: os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"), R2BucketName: os.Getenv("R2_BUCKET_NAME"),
		SMTPHost: os.Getenv("SMTP_HOST"), SMTPPort: getenv("SMTP_PORT", "587"),
		SMTPUser: os.Getenv("SMTP_USER"), SMTPPass: os.Getenv("SMTP_PASS"),
		MailFromAddress: os.Getenv("MAIL_FROM_ADDRESS"), MailFromName: getenv("MAIL_FROM_NAME", "Laci Digital"),
		AdminNotificationEmail: os.Getenv("ADMIN_NOTIFICATION_EMAIL"),
		TrustedProxyHeaders:    os.Getenv("TRUSTED_PROXY_HEADERS") == "true",
		ShutdownTimeout:        15 * time.Second,
	}
	if c.SSORedirectURL == "" {
		c.SSORedirectURL = c.FrontendURL + "/api/auth/oauth2/callback/sso-ipnu"
	}
	var missing []string
	for key, value := range map[string]string{
		"DATABASE_URL": c.DatabaseURL, "SSO_ISSUER": c.SSOIssuer,
		"SSO_CLIENT_ID": c.SSOClientID, "SSO_CLIENT_SECRET": c.SSOClientSecret,
		"ENCRYPTION_KEY": c.EncryptionKey,
	} {
		if value == "" {
			missing = append(missing, key)
		}
	}
	if len(missing) > 0 {
		return Config{}, errors.New("missing required environment: " + strings.Join(missing, ", "))
	}
	return c, nil
}

func loadDotEnv(path string) error {
	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		key = strings.TrimSpace(key)
		if !ok || key == "" {
			continue
		}
		value = strings.TrimSpace(value)
		if len(value) >= 2 && ((value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'')) {
			value = value[1 : len(value)-1]
		}
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, value)
		}
	}
	return scanner.Err()
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func splitCSV(value string) []string {
	var result []string
	for _, item := range strings.Split(value, ",") {
		if item = strings.TrimSpace(item); item != "" {
			result = append(result, item)
		}
	}
	return result
}
