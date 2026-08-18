"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { EmailType, EmailStatus } from "@prisma/client";

// ============================================
// HELPERS
// ============================================

async function requireSekretarisCabang() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.role !== "SEKRETARIS_CABANG")
    throw new Error("Forbidden: Hanya Sekretaris Cabang");
  return session;
}

// ============================================
// STATISTICS
// ============================================

export async function getEmailStats() {
  await requireSekretarisCabang();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalAll, totalToday, totalSent, totalFailed, byType] =
    await Promise.all([
      prisma.logEmail.count(),
      prisma.logEmail.count({
        where: { createdAt: { gte: startOfDay } },
      }),
      prisma.logEmail.count({
        where: { status: "SENT" },
      }),
      prisma.logEmail.count({
        where: { status: "FAILED" },
      }),
      prisma.logEmail.groupBy({
        by: ["type"],
        _count: { type: true },
      }),
    ]);

  const typeStats = byType.reduce(
    (
      acc: Record<string, number>,
      item: { type: string; _count: { type: number } },
    ) => {
      acc[item.type] = item._count.type;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    totalAll,
    totalToday,
    totalSent,
    totalFailed,
    byType: typeStats,
  };
}

// ============================================
// LIST EMAILS (with pagination & filters)
// ============================================

export interface EmailLogFilters {
  type?: string;
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortKey?: string | null;
  sortDir?: "asc" | "desc";
}

export async function getEmailLogs(
  filters: EmailLogFilters = {},
  page: number = 1,
  perPage: number = 20,
) {
  await requireSekretarisCabang();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (filters.type && filters.type !== "ALL") {
    where.type = filters.type;
  } else {
    where.type = { in: ["PENGAJUAN_USER", "PENGAJUAN_ADMIN", "PENGAJUAN_STATUS"] };
  }
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { to: { contains: filters.search, mode: "insensitive" } },
      { subject: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = endDate;
    }
  }

  const orderBy: any = {};
  if (filters.sortKey) {
    orderBy[filters.sortKey] = filters.sortDir || "asc";
  } else {
    orderBy.createdAt = "desc";
  }

  const [data, total] = await Promise.all([
    prisma.logEmail.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.logEmail.count({ where }),
  ]);

  // Get unique emails from data to check their verification status
  const emails = Array.from(new Set(data.map((log) => log.to)));
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true, emailVerified: true },
  });

  const verificationMap = users.reduce(
    (acc, user) => {
      acc[user.email] = !!user.emailVerified;
      return acc;
    },
    {} as Record<string, boolean>,
  );

  return {
    data: data.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
      updatedAt: log.updatedAt.toISOString(),
      isVerified: verificationMap[log.to] || false,
    })),
    total,
    totalPages: Math.ceil(total / perPage),
    currentPage: page,
  };
}

// ============================================
// RETRY FAILED EMAIL
// ============================================

export async function retryEmail(logId: string) {
  await requireSekretarisCabang();

  const log = await prisma.logEmail.findUnique({
    where: { id: logId },
  });

  if (!log) return { success: false, error: "Log tidak ditemukan" };
  if (log.status === "SENT")
    return { success: false, error: "Email sudah terkirim" };

  // Import sendEmail dynamically to avoid circular dependency issues
  const { sendEmail } = await import("@/lib/email");

  // We need to rebuild the email content based on the type
  try {
    // Update status to PENDING and increment retry count
    await prisma.logEmail.update({
      where: { id: logId },
      data: {
        status: "PENDING",
        retryCount: { increment: 1 },
        errorMessage: null,
      },
    });

    // Realtime: Update status ke PENDING di UI
    const { notifyRealtime } = await import("@/lib/realtime");
    notifyRealtime({ model: "LogEmail", type: "mutation", id: logId });

    // Rebuild and send email (Now waiting for it instead of background)
    const result = await rebuildAndSendEmail(log, logId);

    return {
      success: result.success,
      message: result.success
        ? "Email berhasil dikirim ulang"
        : "Gagal mengirim ulang",
      error: result.error,
    };
  } catch (error) {
    await prisma.logEmail.update({
      where: { id: logId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Retry failed",
      },
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Retry failed",
    };
  }
}

/**
 * Rebuild and resend email based on logged type
 * Now supports existingLogId to update the original log
 */
async function rebuildAndSendEmail(
  log: {
    to: string;
    subject: string;
    type: EmailType;
    metadata: string | null;
    createdAt: Date;
  },
  existingLogId?: string,
): Promise<{ success: boolean; error?: string }> {
  const { sendEmail } = await import("@/lib/email");
  const metadata = log.metadata ? JSON.parse(log.metadata) : {};

  const commonOptions = {
    to: log.to,
    existingLogId, // Mastiin log lama yang diupdate
  };

  switch (log.type) {
    case "VERIFICATION": {
      // For verification, we need to generate a new OTP
      const { verificationEmailTemplate, verificationEmailText } =
        await import("@/lib/email-templates/verification");
      const { generateVerificationToken } = await import("@/lib/email");

      const newOtp = generateVerificationToken();
      const name = log.to.split("@")[0]; // fallback name

      const html = verificationEmailTemplate({ name, otp: newOtp });
      const text = verificationEmailText({ name, otp: newOtp });

      return sendEmail({
        ...commonOptions,
        subject: log.subject,
        html,
        text,
      });
    }

    case "VERIFIED_SUCCESS": {
      const { verifiedSuccessEmailTemplate, verifiedSuccessEmailText } =
        await import("@/lib/email-templates/verified-success");

      // Try to get user name from database
      const user = await prisma.user.findUnique({
        where: { email: log.to },
        select: { name: true },
      });
      const name = user?.name || "Rekan/Rekanita";

      const html = verifiedSuccessEmailTemplate({ name });
      const text = verifiedSuccessEmailText({ name });

      return sendEmail({
        ...commonOptions,
        subject: log.subject,
        html,
        text,
      });
    }

    case "PENGAJUAN_USER": {
      const { pengajuanBerkasUserTemplate, pengajuanBerkasUserText } =
        await import("@/lib/email-templates/pengajuan-berkas");

      const submissionDate = new Date(log.createdAt).toLocaleDateString(
        "id-ID",
        {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      );

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.BETTER_AUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://laci.pelajarnumagetan.or.id";
      // Metadata might contain original submission ID, if not we fallback or use a safe link
      const submissionId = metadata.submissionId || metadata.id || "";
      const detailUrl = `${baseUrl}/dashboard/pengajuan-berkas/${submissionId}`;

      const props = {
        pacName: metadata.pacName || "PAC",
        userName: metadata.userName || "Rekan/Rekanita",
        noSurat: metadata.noSurat || "-",
        email: log.to,
        submissionDate,
        detailUrl,
      };

      return sendEmail({
        ...commonOptions,
        subject: log.subject,
        html: pengajuanBerkasUserTemplate(props),
        text: pengajuanBerkasUserText(props),
      });
    }

    case "PENGAJUAN_ADMIN": {
      const { pengajuanBerkasAdminTemplate, pengajuanBerkasAdminText } =
        await import("@/lib/email-templates/pengajuan-berkas");

      const submissionDate = new Date(log.createdAt).toLocaleDateString(
        "id-ID",
        {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      );

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.BETTER_AUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://laci.pelajarnumagetan.or.id";
      const submissionId = metadata.submissionId || metadata.id || "";
      const detailUrl = `${baseUrl}/dashboard/pengajuan-berkas/${submissionId}`;

      const props = {
        pacName: metadata.pacName || "PAC",
        userName: metadata.userName || "Pimpinan",
        noSurat: metadata.noSurat || "-",
        email: metadata.userEmail || log.to,
        submissionDate,
        detailUrl,
      };

      return sendEmail({
        ...commonOptions,
        subject: log.subject,
        html: pengajuanBerkasAdminTemplate(props),
        text: pengajuanBerkasAdminText(props),
      });
    }

    case "PENGAJUAN_STATUS": {
      const { pengajuanBerkasStatusTemplate, pengajuanBerkasStatusText } =
        await import("@/lib/email-templates/pengajuan-berkas-status");

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.BETTER_AUTH_URL ||
        "https://laci.pelajarnumagetan.or.id";
      const submissionId = metadata.submissionId || metadata.id || "";
      const detailUrl = `${baseUrl}/dashboard/pengajuan-berkas/${submissionId}`;

      const props = {
        userName: metadata.userName || "Rekan/Rekanita",
        pacName: metadata.pacName || "PAC",
        noSurat: metadata.noSurat || "-",
        status: (metadata.status === "DITERIMA" ? "DITERIMA" : "DITOLAK") as
          | "DITERIMA"
          | "DITOLAK",
        alasanPenolakan:
          metadata.alasanPenolakan || metadata.keterangan || undefined,
        detailUrl,
      };

      return sendEmail({
        ...commonOptions,
        subject: log.subject,
        html: pengajuanBerkasStatusTemplate(props),
        text: pengajuanBerkasStatusText(props),
      });
    }

    default:
      return { success: false, error: "Tipe email tidak dikenali" };
  }
}

// ============================================
// RESEND VERIFICATION OTP
// ============================================

export async function resendVerificationOTP(email: string) {
  await requireSekretarisCabang();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { name: true, emailVerified: true },
  });

  if (!user) return { success: false, error: "User tidak ditemukan" };
  if (user.emailVerified)
    return { success: false, error: "Email sudah terverifikasi" };

  const { auth } = await import("@/lib/auth");
  const { headers } = await import("next/headers");

  // Use Better Auth's official API to generate OTP
  // This ensures it's correctly stored in their internal tables with correct format
  try {
    const result = await (auth.api as any).sendVerificationOTP({
      headers: await headers(),
      body: {
        email,
        type: "email-verification",
      },
    });

    if (!result) {
      return { success: false, error: "Gagal membuat kode OTP dari sistem" };
    }

    // After calling generateEmailOTP, Better Auth will automatically
    // trigger our sendVerificationOTP hook in lib/auth.ts, which will
    // send the email and log it. So we don't need to call sendVerificationEmail here.

    return { success: true, message: "OTP baru telah dikirim oleh sistem" };
  } catch (err) {
    console.error("[RESEND-OTP-AUTH] Failed to trigger BA OTP:", err);
    return { success: false, error: "Gagal memicu pengiriman OTP sistem" };
  }
}
