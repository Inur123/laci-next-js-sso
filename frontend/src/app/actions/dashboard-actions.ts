"use server";
import { goAPI } from "@/lib/go-api";
export async function getDashboardStats() {
  try {
    return (await goAPI<any>("/dashboard")).data;
  } catch {
    return null;
  }
}
export async function getPublicStats() {
  try {
    const d = (await goAPI<any>("/public/stats", { public: true })).data;
    return { anggotaCount: d.anggota || 0, suratCount: d.pengajuan || 0 };
  } catch {
    return { anggotaCount: 0, suratCount: 0 };
  }
}
