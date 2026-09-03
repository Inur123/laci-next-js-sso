"use server";
import { actionError, goAPI } from "@/lib/go-api";
export async function createPeriode(nama: string) {
  try {
    await goAPI("/periods", { method: "POST", body: JSON.stringify({ nama }) });
    return { success: "Periode berhasil dibuat" };
  } catch (e) {
    return actionError(e);
  }
}
export async function activatePeriode(id: string) {
  try {
    await goAPI(`/periods/${id}/activate`, { method: "POST" });
    return { success: "Periode berhasil diaktifkan" };
  } catch (e) {
    return actionError(e);
  }
}
export async function deletePeriode(id: string) {
  try {
    await goAPI(`/periods/${id}`, { method: "DELETE" });
    return { success: "Periode berhasil dihapus" };
  } catch (e) {
    return actionError(e);
  }
}
export async function getPeriode(id: string) {
  try {
    return (await goAPI<any>(`/periods/${id}`)).data;
  } catch {
    return null;
  }
}
export async function getPeriodes(page = 1, limit = 100): Promise<any[]> {
  try {
    return (
      (await goAPI<any>(`/periods?page=${page}&limit=${limit}`)).data || []
    );
  } catch {
    return [];
  }
}
export async function updatePeriode(id: string, nama: string) {
  try {
    await goAPI(`/periods/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ nama }),
    });
    return { success: "Periode berhasil diperbarui" };
  } catch (e) {
    return actionError(e);
  }
}
