import "server-only";

import { cookies, headers } from "next/headers";

const API_URL = (process.env.GO_API_URL || "http://localhost:8080").replace(/\/$/, "");

class GoAPIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function goAPI<T = any>(
  path: string,
  init: RequestInit & { public?: boolean } = {},
): Promise<T> {
  const requestHeaders = new Headers(init.headers);
  if (!(init.body instanceof FormData) && init.body && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }
  const incoming = await headers();
  const incomingCookie = incoming.get("cookie");
  if (!init.public && incomingCookie) requestHeaders.set("Cookie", incomingCookie);
  const cookieStore = await cookies();
  const viewPeriod = cookieStore.get("view_periode_id")?.value;
  if (viewPeriod && !requestHeaders.has("X-View-Period")) requestHeaders.set("X-View-Period", viewPeriod);
  const userAgent = incoming.get("user-agent");
  const clientIP = incoming.get("x-forwarded-for")?.split(",")[0]?.trim() || incoming.get("x-real-ip");
  const latitude = cookieStore.get("user_lat")?.value;
  const longitude = cookieStore.get("user_lng")?.value;
  if (userAgent) requestHeaders.set("X-Client-User-Agent", userAgent);
  if (clientIP) requestHeaders.set("X-Client-IP", clientIP);
  if (latitude && longitude) requestHeaders.set("X-Client-Location", `${latitude}, ${longitude}`);
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: requestHeaders,
    cache: "no-store",
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.arrayBuffer();
  if (!response.ok) {
    const problem = (payload as any)?.error;
    // Dukungan key lowercase adalah kontrak baru Go. Key uppercase tetap
    // dibaca selama proses backend lama belum direstart.
    throw new GoAPIError(
      response.status,
      problem?.code || problem?.Code || "API_ERROR",
      problem?.message || problem?.Message || `Go API error ${response.status}`,
      problem?.details ?? problem?.Details,
    );
  }
  return payload as T;
}

async function uploadFromForm(formData: FormData, prefix: string): Promise<Record<string, any>> {
  const output: Record<string, any> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      if (value.size === 0) continue;
      const upload = new FormData();
      upload.set("file", value);
      upload.set("prefix", prefix);
      const response = await goAPI<{ data: { key: string } }>("/files", { method: "POST", body: upload });
      output[key] = response.data.key;
      if (key === "file") output.fileName = value.name;
    } else {
      output[key] = value;
    }
  }
  return output;
}

export function actionError(error: unknown): any {
  return { error: error instanceof Error ? error.message : "Terjadi kesalahan pada server" };
}

function listResult(response: any) {
  return {
    data: response?.data || [],
    total: response?.pagination?.total || 0,
    totalPages: response?.pagination?.totalPages || 0,
  };
}

export function queryString(values: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "" && value !== "ALL") params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export async function resourceList(path: string, values: Record<string, unknown>) {
  return listResult(await goAPI(`${path}${queryString(values)}`));
}

export async function formMutation(path: string, method: "POST" | "PATCH", formData: FormData, prefix: string) {
  const body = await uploadFromForm(formData, prefix);
  return goAPI<any>(path, { method, body: JSON.stringify(body) });
}
