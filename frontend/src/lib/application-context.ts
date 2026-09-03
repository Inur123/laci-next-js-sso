import "server-only";
import { goAPI } from "@/lib/go-api";

export async function getApplicationUser(): Promise<any | null> {
  try { return (await goAPI<any>("/me")).data; } catch { return null; }
}
export async function getApplicationPeriods(): Promise<any[]> {
  try { return (await goAPI<any>("/periods?limit=100")).data || []; } catch { return []; }
}
export async function getApplicationActivePeriod(): Promise<any | null> {
  return (await getApplicationPeriods()).find((period) => period.isActive) || null;
}
export async function getApplicationPeriod(id: string): Promise<any | null> {
  try { return (await goAPI<any>(`/periods/${id}`)).data; } catch { return null; }
}
export async function getApplicationUsers(): Promise<any[]> {
  try { return (await goAPI<any>("/users?limit=100")).data || []; } catch { return []; }
}
