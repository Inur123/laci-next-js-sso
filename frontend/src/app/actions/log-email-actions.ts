"use server";
import { actionError, goAPI, queryString } from "@/lib/go-api";
export type EmailLogFilters = {
  search?: string;
  type?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortKey?: string;
  sortDir?: "asc" | "desc";
};
export async function getEmailLogs(
  filters: EmailLogFilters = {},
  page = 1,
  perPage = 20,
) {
  try {
    const r = await goAPI<any>(
      `/email-logs${queryString({ ...filters, page, limit: perPage })}`,
    );
    return {
      data: r.data || [],
      total: r.pagination?.total || 0,
      totalPages: r.pagination?.totalPages || 0,
      currentPage: page,
    };
  } catch {
    return { data: [], total: 0, totalPages: 0, currentPage: page };
  }
}
export async function getEmailStats() {
  try {
    return (await goAPI<any>("/email-logs/stats")).data;
  } catch {
    return {
      totalAll: 0,
      totalToday: 0,
      totalSent: 0,
      totalFailed: 0,
      byType: {},
    };
  }
}
export async function retryEmail(id: string): Promise<any> {
  try {
    await goAPI(`/email-logs/${id}/retry`, { method: "POST" });
    return { success: true };
  } catch (e) {
    return { success: false, ...actionError(e) };
  }
}
export async function resendVerificationOTP(email: string) {
  void email;
  return { success: false, error: "Verifikasi identitas dikelola oleh SSO." };
}
