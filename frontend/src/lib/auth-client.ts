"use client";

import { useEffect, useState } from "react";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

export function loginWithSSO() {
  window.location.assign(`${API_URL}/api/v1/auth/login`);
}

export function logoutFromSSO() {
  window.location.assign(`${API_URL}/api/v1/auth/logout`);
}

export function useSession() {
  const [data, setData] = useState<any>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/api/v1/me`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json();
        return payload?.data ? { user: payload.data } : null;
      })
      .then(setData)
      .catch(() => undefined)
      .finally(() => setIsPending(false));
    return () => controller.abort();
  }, []);

  return { data, isPending };
}
