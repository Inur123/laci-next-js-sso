import nodemailer from "nodemailer";
import { decryptFile } from "./encryption";
import { downloadFromR2 } from "./storage-r2";
import prisma from "@/lib/prisma";
import { notifyRealtime } from "./realtime";

// Create SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL =
  process.env.MAIL_FROM_ADDRESS || "noreply@laci.pelajarnumagetan.or.id";
const FROM_NAME =
  process.env.MAIL_FROM_NAME || "Laci Digital PC IPNU IPPNU Magetan";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: {
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }[];
  /** Type for logging purpose */
  emailType?: "VERIFICATION" | "VERIFIED_SUCCESS" | "PENGAJUAN_USER" | "PENGAJUAN_ADMIN" | "PENGAJUAN_STATUS";
  /** Extra metadata to store in log (JSON serializable) */
  emailMetadata?: Record<string, unknown>;
  /** Update an existing log instead of creating a new one */
  existingLogId?: string;
}

/**
 * Send email using Nodemailer (SMTP) with automatic logging
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
  emailType,
  emailMetadata,
  existingLogId,
}: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  // Create log entry first (PENDING)
  let logId: string | null = null;
  if (emailType) {
    try {
      const log = await prisma.logEmail.create({
        data: {
          to,
          subject,
          type: emailType,
          status: "PENDING",
          metadata: emailMetadata ? JSON.stringify(emailMetadata) : null,
        },
      });
      logId = log.id;
      // Realtime: Notif ada log baru (PENDING)
      notifyRealtime({ model: "LogEmail", type: "mutation", id: log.id });
    } catch (logError) {
      console.error("[EMAIL-LOG] Failed to create log entry:", logError);
    }
  } else if (existingLogId) {
    logId = existingLogId;
  }

  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      text: text || "",
      attachments:
        attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })) || [],
    });

    // Update log to SENT
    if (logId) {
      try {
        await prisma.logEmail.update({
          where: { id: logId },
          data: { status: "SENT" },
        });
        // Realtime: Notif status berubah jadi SENT
        notifyRealtime({ model: "LogEmail", type: "mutation", id: logId });
      } catch (updateErr) {
        console.error("[EMAIL-LOG] Failed to update log:", updateErr);
      }
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send email";
    console.error("[EMAIL] Error sending email (SMTP):", error);

    // Update log to FAILED
    if (logId) {
      try {
        await prisma.logEmail.update({
          where: { id: logId },
          data: { status: "FAILED", errorMessage },
        });
        // Realtime: Notif status berubah jadi FAILED
        notifyRealtime({ model: "LogEmail", type: "mutation", id: logId });
      } catch (updateErr) {
        console.error("[EMAIL-LOG] Failed to update log:", updateErr);
      }
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Generate 6-digit verification code (OTP)
 */
export function generateVerificationToken(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

import {
  verificationEmailTemplate,
  verificationEmailText,
} from "./email-templates/verification";

import {
  verifiedSuccessEmailTemplate,
  verifiedSuccessEmailText,
} from "./email-templates/verified-success";

import {
  pengajuanBerkasAdminTemplate,
  pengajuanBerkasAdminText,
  pengajuanBerkasUserTemplate,
  pengajuanBerkasUserText,
  PengajuanBerkasEmailProps,
} from "./email-templates/pengajuan-berkas";

import {
  pengajuanBerkasStatusTemplate,
  pengajuanBerkasStatusText,
  PengajuanBerkasStatusEmailProps,
} from "./email-templates/pengajuan-berkas-status";

const getBaseUrl = () => {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  return process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "https://laci.pelajarnumagetan.or.id";
};

/**
 * Send email verification
 * Now supports both OTP (for registration) and Link (for profile update)
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string,
  type: "otp" | "link" = "otp",
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = getBaseUrl();
  const verificationUrl =
    type === "link" && token.startsWith("http")
      ? token
      : `${baseUrl}/verify-email?token=${token}`;

  const props =
    type === "otp" ? { name, otp: token } : { name, verificationUrl };

  const html = verificationEmailTemplate(props);
  const text =
    type === "otp"
      ? verificationEmailText({ name, otp: token })
      : `Halo ${name},\n\nSilakan verifikasi email Anda dengan mengklik tautan berikut: ${verificationUrl}`;

  return sendEmail({
    to: email,
    subject: `Verifikasi Email: ${name} (Laci Digital)`,
    html,
    text,
    emailType: "VERIFICATION",
  });
}

/**
 * Send verified success email
 */
export async function sendVerifiedSuccessEmail(
  email: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  const html = verifiedSuccessEmailTemplate({ name });
  const text = verifiedSuccessEmailText({ name });

  return sendEmail({
    to: email,
    subject: `Status Akun: TERVERIFIKASI - ${name} (Laci Digital)`,
    html,
    text,
    emailType: "VERIFIED_SUCCESS",
  });
}

/**
 * Send PAC submission notification to both user and admin
 */
export async function sendPengajuanBerkasNotification(
  userEmail: string,
  props: Omit<PengajuanBerkasEmailProps, "submissionDate">,
  fileInfo?: { path: string; name: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    const dateStr = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const emailProps: PengajuanBerkasEmailProps = {
      ...props,
      submissionDate: dateStr,
    };

    // Prepare attachments if file exists
    const attachments: SendEmailOptions["attachments"] = [];
    if (fileInfo) {
      try {
        const encryptedBuffer = await downloadFromR2(fileInfo.path);
        const decryptedBuffer = decryptFile(encryptedBuffer);

        attachments.push({
          filename: fileInfo.name,
          content: decryptedBuffer,
        });
      } catch (fileError) {
        console.error("[EMAIL-ATTACH] Gagal memproses lampiran:", fileError);
      }
    }

    // 1. Send to User
    const userHtml = pengajuanBerkasUserTemplate(emailProps);
    const userText = pengajuanBerkasUserText(emailProps);
    await sendEmail({
      to: userEmail,
      subject: `Pengajuan Berhasil: ${props.pacName} - ${props.noSurat || "Laci Digital"}`,
      html: userHtml,
      text: userText,
      attachments,
      emailType: "PENGAJUAN_USER",
      emailMetadata: { pacName: props.pacName, noSurat: props.noSurat },
    });

    // 2. Send to Admin
    if (adminEmail) {
      const adminHtml = pengajuanBerkasAdminTemplate(emailProps);
      const adminText = pengajuanBerkasAdminText(emailProps);
      await sendEmail({
        to: adminEmail,
        subject: `[NOTIFIKASI] Pengajuan Baru: ${props.pacName} - ${props.noSurat || props.userName}`,
        html: adminHtml,
        text: adminText,
        attachments,
        emailType: "PENGAJUAN_ADMIN",
        emailMetadata: { pacName: props.pacName, noSurat: props.noSurat, userName: props.userName },
      });
    } else {
      console.error("[EMAIL] ADMIN_NOTIFICATION_EMAIL is not set");
    }

    return { success: true };
  } catch (error) {
    console.error("[EMAIL] Error sending pengajuan notification:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to send notification",
    };
  }
}

/**
 * Send PAC status update notification to user
 */
export async function sendPengajuanBerkasStatusUpdate(
  userEmail: string,
  props: PengajuanBerkasStatusEmailProps,
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = pengajuanBerkasStatusTemplate(props);
    const text = pengajuanBerkasStatusText(props);
    const statusLabel = props.status === "DITERIMA" ? "DITERIMA" : "DITOLAK";

    return sendEmail({
      to: userEmail,
      subject: `Update Pengajuan: ${statusLabel} - ${props.pacName} (${props.noSurat || ""})`,
      html,
      text,
      emailType: "PENGAJUAN_STATUS",
      emailMetadata: { pacName: props.pacName, status: props.status, noSurat: props.noSurat },
    });
  } catch (error) {
    console.error("[EMAIL] Error sending status update notification:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to send notification",
    };
  }
}
