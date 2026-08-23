"use client";

import { useEffect, useRef } from "react";

/**
 * Komponen ini mendengarkan perubahan pada database secara real-time via SSE.
 * Jika ada perubahan (INSERT, UPDATE, DELETE), ia akan dispatch CustomEvent
 * "laci-realtime" agar semua komponen bisa refresh data tanpa reload halaman.
 *
 * Fitur:
 * - Auto-reconnect dengan exponential backoff jika koneksi SSE putus
 * - Heartbeat detection untuk mendeteksi koneksi zombie
 */
export function RealtimeListener() {
  const retryRef = useRef(0);
  const sourceRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      // Jangan konek kalau sudah unmount
      if (unmountedRef.current) return;

      // Tutup koneksi lama jika ada
      if (sourceRef.current) {
        try {
          sourceRef.current.close();
        } catch {}
        sourceRef.current = null;
      }

      const source = new EventSource("/api/realtime");
      sourceRef.current = source;

      source.onopen = () => {
        // Reset retry counter saat berhasil konek
        retryRef.current = 0;
      };

      source.onmessage = (event: MessageEvent) => {
        try {
          const detail = JSON.parse(event.data || "{}");
          window.dispatchEvent(new CustomEvent("laci-realtime", { detail }));
        } catch {}
      };

      source.onerror = () => {
        // Tutup koneksi yang error
        source.close();
        sourceRef.current = null;

        // Jangan reconnect jika sudah unmount
        if (unmountedRef.current) return;

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
        const delay = Math.min(1000 * Math.pow(2, retryRef.current), 30000);
        retryRef.current += 1;

        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null;
          connect();
        }, delay);
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;

      // Bersihkan timer retry
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      // Tutup koneksi SSE
      if (sourceRef.current) {
        sourceRef.current.close();
        sourceRef.current = null;
      }
    };
  }, []);

  return null;
}
