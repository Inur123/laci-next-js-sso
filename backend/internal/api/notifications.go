package api

import (
	"context"
	"fmt"
	"github.com/ipnu-ippnu/laci/backend/internal/identity"
	"github.com/ipnu-ippnu/laci/backend/internal/mailer"
)

func (a *API) notifyApplicationCreated(user identity.User, item map[string]any) {
	subject := "Pengajuan berkas baru"
	body := "Pengajuan Anda telah diterima sistem dan menunggu verifikasi Cabang."
	var attachment *mailer.Attachment
	if key, ok := item["file"].(string); ok && key != "" {
		if encrypted, _, err := a.storage.Get(context.Background(), key); err == nil {
			if data, decryptErr := a.crypto.DecryptFile(encrypted); decryptErr == nil {
				name := fmt.Sprint(item["originalFileName"])
				if name == "" || name == "<nil>" {
					name = displayFileName(key)
				}
				attachment = &mailer.Attachment{Name: name, ContentType: detectContentType(key, data), Data: data}
			}
		}
	}
	send := func(to, message, emailType string) {
		if attachment != nil {
			_ = a.mailer.SendWithAttachment(context.Background(), newID(), to, subject, message, emailType, *attachment)
			return
		}
		_ = a.mailer.Send(context.Background(), newID(), to, subject, message, emailType)
	}
	send(user.Email, body, "PENGAJUAN_USER")
	if a.cfg.AdminNotificationEmail != "" {
		send(a.cfg.AdminNotificationEmail, "Terdapat pengajuan berkas baru yang perlu diverifikasi.", "PENGAJUAN_ADMIN")
	}
}

func (a *API) notifyApplicationStatus(id, status string) {
	var email string
	if err := a.pool.QueryRow(context.Background(), `SELECT u.email FROM "PengajuanBerkas" p JOIN "User" u ON u.id=p."userId" WHERE p.id=$1`, id).Scan(&email); err != nil {
		return
	}
	_ = a.mailer.Send(context.Background(), newID(), email, "Status pengajuan diperbarui", "Status pengajuan Anda: "+status, "PENGAJUAN_STATUS")
}
