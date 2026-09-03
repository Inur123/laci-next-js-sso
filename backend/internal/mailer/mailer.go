package mailer

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"mime"
	"mime/multipart"
	"net/smtp"
	"net/textproto"
	"strings"

	"github.com/ipnu-ippnu/laci/backend/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	cfg  config.Config
	pool *pgxpool.Pool
}
type Metadata struct {
	Body string `json:"body"`
}
type Attachment struct {
	Name        string
	ContentType string
	Data        []byte
}

func New(cfg config.Config, pool *pgxpool.Pool) *Service { return &Service{cfg: cfg, pool: pool} }
func (s *Service) Enabled() bool                         { return s.cfg.SMTPHost != "" && s.cfg.MailFromAddress != "" }
func (s *Service) Send(ctx context.Context, id, to, subject, body, emailType string) error {
	return s.send(ctx, id, to, subject, body, emailType, nil)
}
func (s *Service) SendWithAttachment(ctx context.Context, id, to, subject, body, emailType string, attachment Attachment) error {
	return s.send(ctx, id, to, subject, body, emailType, &attachment)
}
func (s *Service) send(ctx context.Context, id, to, subject, body, emailType string, attachment *Attachment) error {
	meta, _ := json.Marshal(Metadata{Body: body})
	_, err := s.pool.Exec(ctx, `INSERT INTO "LogEmail" (id,"to",subject,type,status,metadata,"createdAt","updatedAt") VALUES ($1,$2,$3,$4::"EmailType",'PENDING',$5,now(),now())`, id, to, subject, emailType, string(meta))
	if err != nil {
		return err
	}
	err = s.deliver(to, subject, body, attachment)
	status := "SENT"
	var message any
	if err != nil {
		status = "FAILED"
		message = err.Error()
	}
	_, _ = s.pool.Exec(context.Background(), `UPDATE "LogEmail" SET status=$1::"EmailStatus","errorMessage"=$2,"updatedAt"=now() WHERE id=$3`, status, message, id)
	return err
}
func (s *Service) Retry(ctx context.Context, id string) error {
	var to, subject, raw string
	if err := s.pool.QueryRow(ctx, `SELECT "to",subject,coalesce(metadata,'{}') FROM "LogEmail" WHERE id=$1 AND status='FAILED'`, id).Scan(&to, &subject, &raw); err != nil {
		return err
	}
	var m Metadata
	_ = json.Unmarshal([]byte(raw), &m)
	err := s.deliver(to, subject, m.Body, nil)
	status := "SENT"
	var message any
	if err != nil {
		status = "FAILED"
		message = err.Error()
	}
	_, dbErr := s.pool.Exec(ctx, `UPDATE "LogEmail" SET status=$1::"EmailStatus","errorMessage"=$2,"retryCount"="retryCount"+1,"updatedAt"=now() WHERE id=$3`, status, message, id)
	if dbErr != nil {
		return dbErr
	}
	return err
}
func (s *Service) deliver(to, subject, body string, attachment *Attachment) error {
	if !s.Enabled() {
		return fmt.Errorf("SMTP belum dikonfigurasi")
	}
	clean := func(value string) string { return strings.ReplaceAll(strings.ReplaceAll(value, "\r", ""), "\n", "") }
	from, to, subject := clean(s.cfg.MailFromAddress), clean(to), clean(subject)
	headers := []string{"From: " + clean(s.cfg.MailFromName) + " <" + from + ">", "To: " + to, "Subject: " + subject, "MIME-Version: 1.0"}
	var message []byte
	if attachment == nil {
		headers = append(headers, "Content-Type: text/plain; charset=UTF-8")
		message = []byte(strings.Join(headers, "\r\n") + "\r\n\r\n" + body)
	} else {
		var payload bytes.Buffer
		writer := multipart.NewWriter(&payload)
		headers = append(headers, `Content-Type: multipart/mixed; boundary="`+writer.Boundary()+`"`)
		textHeader := textproto.MIMEHeader{}
		textHeader.Set("Content-Type", "text/plain; charset=UTF-8")
		textPart, _ := writer.CreatePart(textHeader)
		_, _ = textPart.Write([]byte(body))
		attachmentHeader := textproto.MIMEHeader{}
		contentType := attachment.ContentType
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		attachmentHeader.Set("Content-Type", contentType)
		attachmentHeader.Set("Content-Disposition", `attachment; filename="`+mime.QEncoding.Encode("UTF-8", clean(attachment.Name))+`"`)
		attachmentHeader.Set("Content-Transfer-Encoding", "base64")
		part, _ := writer.CreatePart(attachmentHeader)
		encoder := base64.NewEncoder(base64.StdEncoding, part)
		_, _ = encoder.Write(attachment.Data)
		_ = encoder.Close()
		_ = writer.Close()
		message = append([]byte(strings.Join(headers, "\r\n")+"\r\n\r\n"), payload.Bytes()...)
	}
	auth := smtp.PlainAuth("", s.cfg.SMTPUser, s.cfg.SMTPPass, s.cfg.SMTPHost)
	return smtp.SendMail(s.cfg.SMTPHost+":"+s.cfg.SMTPPort, auth, from, []string{to}, message)
}
