"use server";
import { actionError, formMutation, goAPI, resourceList } from "@/lib/go-api";
export async function getAgendaKegiatanList(
  query?: string,
  page = 1,
  limit = 10,
  statusFilter?: string,
  sortKey?: string | null,
  sortDir?: "asc" | "desc",
) {
  return resourceList("/agenda-kegiatan", {
    search: query,
    page,
    limit,
    status: statusFilter,
    sortKey,
    sortDir,
  });
}
export async function getKegiatanById(id: string) {
  try {
    return (await goAPI<any>(`/agenda-kegiatan/${id}`)).data;
  } catch {
    return null;
  }
}
export async function createKegiatan(data: FormData) {
  try {
    await formMutation("/agenda-kegiatan", "POST", data, "documents");
    return { success: "Kegiatan berhasil ditambahkan!" };
  } catch (e) {
    return actionError(e);
  }
}
export async function updateKegiatan(id: string, data: FormData) {
  try {
    await formMutation(`/agenda-kegiatan/${id}`, "PATCH", data, "documents");
    return { success: "Kegiatan berhasil diperbarui!" };
  } catch (e) {
    return actionError(e);
  }
}
export async function deleteKegiatan(id: string) {
  try {
    await goAPI(`/agenda-kegiatan/${id}`, { method: "DELETE" });
    return { success: "Kegiatan berhasil dihapus!" };
  } catch (e) {
    return actionError(e);
  }
}
export async function getAgendaKegiatanStats() {
  try {
    return (await goAPI<any>("/agenda-kegiatan/stats")).data;
  } catch {
    return { total: 0, mendatang: 0, berlangsung: 0, selesai: 0 };
  }
}
