"use server";
import { actionError, formMutation, goAPI, queryString } from "@/lib/go-api";
export async function resendVerificationAction(email: string) {
  void email;
  return { error: "Verifikasi identitas dikelola oleh SSO." };
}
export async function getPACUsers(
  query?: string,
  page = 1,
  limit = 10,
  status?: string,
  emailStatus?: string,
  sortKey?: string | null,
  sortDir: "asc" | "desc" = "asc",
) {
  try {
    const r = await goAPI<any>(
      `/users${queryString({ search: query, page, limit, status, emailStatus, sortKey, sortDir })}`,
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
export async function getUserStats() {
  try {
    return (await goAPI<any>("/users/stats")).data;
  } catch {
    return {
      total: 0,
      aktif: 0,
      nonaktif: 0,
      terverifikasi: 0,
      belumVerifikasi: 0,
    };
  }
}
export async function getUserDetail(id: string) {
  return (await goAPI<any>(`/users/${id}`)).data;
}
export async function toggleUserStatus(id: string): Promise<any> {
  try {
    const user = await getUserDetail(id);
    await goAPI(`/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    return { success: "Status pengguna berhasil diperbarui" };
  } catch (e) {
    return actionError(e);
  }
}
export async function deleteUser(id: string): Promise<any> {
  try {
    await goAPI(`/users/${id}`, { method: "DELETE" });
    return { success: "Pengguna berhasil dihapus" };
  } catch (e) {
    return actionError(e);
  }
}
export async function resetUserPassword(id: string): Promise<any> {
  void id;
  return {
    error: "Password dikelola oleh SSO dan tidak dapat direset dari aplikasi.",
  };
}
export async function updateProfile(data: FormData): Promise<any> {
  try {
    const body = await formMutation("/me", "PATCH", data, "profile");
    return { success: body.message || "Profil berhasil diperbarui" };
  } catch (e) {
    return actionError(e);
  }
}
