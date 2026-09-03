"use server";
import { actionError, goAPI, queryString, resourceList } from "@/lib/go-api";
export async function getAnggotaList(
  query?: string,
  page = 1,
  limit = 10,
  userId?: string,
  periodeId?: string,
  sortKey?: string | null,
  sortDir?: "asc" | "desc",
  status?: "PENDING" | "DITERIMA" | "DITOLAK",
) {
  return resourceList("/anggota", {
    search: query,
    page,
    limit,
    userId,
    periodeId,
    sortKey,
    sortDir,
    status,
  });
}
export async function getActiveUsers() {
  try {
    return (
      (await goAPI<any>("/directory/users?role=SEKRETARIS_PAC")).data || []
    );
  } catch {
    return [];
  }
}
export async function getAnggotaById(id: string) {
  try {
    return (await goAPI<any>(`/anggota/${id}`)).data;
  } catch {
    return null;
  }
}
export async function verifikasiAnggota(
  id: string,
  status: "DITERIMA" | "DITOLAK",
  alasanPenolakan?: string,
) {
  try {
    await goAPI(`/anggota/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason: alasanPenolakan }),
    });
    return { success: "Status anggota berhasil diperbarui!" };
  } catch (e) {
    return actionError(e);
  }
}
export async function getAnggotaStats(userId?: string) {
  try {
    return (
      await goAPI<any>(
        `/anggota/stats${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`,
      )
    ).data;
  } catch {
    return {
      total: 0,
      lakiLaki: 0,
      perempuan: 0,
      makesta: 0,
      lakmud: 0,
      latin: 0,
      latpel: 0,
      lakut: 0,
    };
  }
}
export async function copyAnggotaToPeriode(
  anggotaIds: string[],
  sourcePeriodeId: string,
  targetPeriodeId: string,
) {
  try {
    await goAPI("/anggota/copy-period", {
      method: "POST",
      body: JSON.stringify({ anggotaIds, sourcePeriodeId, targetPeriodeId }),
    });
    return { success: "Anggota berhasil dimasukkan ke periode tujuan" };
  } catch (e) {
    return actionError(e);
  }
}
export async function getAnggotaForPeriod(periodeId: string, search = "") {
  try {
    return await (async () => {
      const response = await goAPI<any>(
        `/anggota${queryString({ search, limit: 3000 })}`,
        { headers: { "X-View-Period": periodeId } },
      );
      return {
        data: response.data || [],
        total: response.pagination?.total || 0,
      };
    })();
  } catch {
    return { data: [], total: 0 };
  }
}
