"use server";
import type { LogModule } from "@/types/domain";
import { actionError, goAPI, queryString } from "@/lib/go-api";
export type LogActivityFilters = {
  action?: string;
  module?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  periodeId?: string;
  sortKey?: string;
  sortDir?: "asc" | "desc";
};
async function logs(
  filters: LogActivityFilters,
  page: number,
  pageSize: number,
  scope?: string,
) {
  try {
    const r = await goAPI<any>(
      `/activity-logs${queryString({ ...filters, page, limit: pageSize, scope })}`,
    );
    return {
      data: r.data || [],
      total: r.pagination?.total || 0,
      totalPages: r.pagination?.totalPages || 0,
    };
  } catch {
    return { data: [], total: 0, totalPages: 0 };
  }
}
export async function getPersonalLogs(
  filters: Omit<LogActivityFilters, "periodeId"> = {},
  page = 1,
  pageSize = 20,
) {
  return logs(filters, page, pageSize);
}
export async function getGlobalLogs(
  filters: Omit<LogActivityFilters, "periodeId"> = {},
  page = 1,
  pageSize = 20,
) {
  return logs(filters, page, pageSize, "global");
}
export async function getLogStats(): Promise<Record<string, number>> {
  try {
    return (await goAPI<any>("/activity-logs/stats")).data || {};
  } catch {
    return {};
  }
}
export async function getGlobalLogStats(
  userId?: string,
): Promise<Record<string, number> | null> {
  try {
    return (
      (
        await goAPI<any>(
          `/activity-logs/stats${queryString({ scope: "global", userId })}`,
        )
      ).data || {}
    );
  } catch {
    return null;
  }
}
export async function getLogMonitoringData(userId?: string): Promise<any> {
  try {
    return (
      await goAPI<any>(`/activity-logs/monitoring${queryString({ userId })}`)
    ).data;
  } catch {
    return null;
  }
}
export async function getLogActivityById(id: string): Promise<any> {
  try {
    return (await goAPI<any>(`/activity-logs/${id}`)).data;
  } catch {
    return null;
  }
}
export async function logExport(module: LogModule, fileName: string) {
  try {
    await goAPI("/exports/log", {
      method: "POST",
      body: JSON.stringify({ module, fileName }),
    });
    return { success: true };
  } catch (e) {
    return actionError(e);
  }
}
export async function logImport(
  module: LogModule,
  successCount: number,
  failedCount: number,
) {
  try {
    await goAPI("/exports/log", {
      method: "POST",
      body: JSON.stringify({
        module,
        fileName: `Import ${successCount} berhasil, ${failedCount} gagal`,
      }),
    });
    return { success: true };
  } catch (e) {
    return actionError(e);
  }
}
