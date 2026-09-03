"use server";
import { actionError, formMutation, goAPI, resourceList } from "@/lib/go-api";
export async function getBerkasSPs(
  query?: string,
  organisasiFilter?: string,
  page = 1,
  limit = 10,
  sortKey?: string | null,
  sortDir?: "asc" | "desc",
) {
  return resourceList("/berkas-sp", {
    search: query,
    organisasi: organisasiFilter,
    page,
    limit,
    sortKey,
    sortDir,
  });
}
export async function getBerkasSPStats() {
  try {
    return (await goAPI<any>("/berkas-sp/stats")).data;
  } catch {
    return { total: 0, ipnu: 0, ippnu: 0 };
  }
}
export async function getBerkasSPById(id: string) {
  try {
    return (await goAPI<any>(`/berkas-sp/${id}`)).data;
  } catch {
    return null;
  }
}
export async function createBerkasSP(data: FormData) {
  try {
    await formMutation("/berkas-sp", "POST", data, "berkas-sp");
    return { success: "Berkas SP berhasil ditambahkan!" };
  } catch (e) {
    return actionError(e);
  }
}
export async function updateBerkasSP(id: string, data: FormData) {
  try {
    await formMutation(`/berkas-sp/${id}`, "PATCH", data, "berkas-sp");
    return { success: "Berkas SP berhasil diperbarui!" };
  } catch (e) {
    return actionError(e);
  }
}
export async function deleteBerkasSP(id: string) {
  try {
    await goAPI(`/berkas-sp/${id}`, { method: "DELETE" });
    return { success: "Berkas SP berhasil dihapus!" };
  } catch (e) {
    return actionError(e);
  }
}
export async function bulkImportBerkasSP(
  rows: Array<Record<string, any>>,
): Promise<any> {
  try {
    const r = await goAPI<any>("/imports/berkas-sp", {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
    return { ...r, failedRows: r.errors || [] };
  } catch (e) {
    return actionError(e);
  }
}
export async function getBerkasSPDownloadToken(id: string) {
  return (
    await goAPI<{ token: string }>(`/berkas-sp/${id}/download-token`, {
      method: "POST",
    })
  ).token;
}
