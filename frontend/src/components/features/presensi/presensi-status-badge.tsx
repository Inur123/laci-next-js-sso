"use client";

import { useEffect, useRef, useState } from "react";
import { getPresensiDetail } from "@/app/actions/presensi-actions";
import { isPresensiOpen } from "@/lib/presensi-utils";

export function PresensiStatusBadge({
  presensiId,
  initialPresensi,
}: {
  presensiId: string;
  initialPresensi: any;
}) {
  const [presensi, setPresensi] = useState(initialPresensi);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleRealtime = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail) return;

      const detailType = detail.type?.toLowerCase();
      const detailModel = detail.model?.toLowerCase();
      const detailModule = detail.module;

      // Refresh jika ada perubahan pada event Presensi (via Mutation atau Log)
      const isPresensiMutation =
        detailType === "mutation" && detailModel === "presensi";
      const isPresensiLog =
        detailType === "log" &&
        (detailModule === "PRESENSI" || detailModule === "AGENDA_KEGIATAN");

      if (isPresensiMutation || isPresensiLog) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
          timerRef.current = null;
          const fresh = await getPresensiDetail(presensiId);
          if (fresh) setPresensi(fresh);
        }, 400);
      }
    };

    window.addEventListener("laci-realtime", handleRealtime);

    return () => {
      window.removeEventListener("laci-realtime", handleRealtime);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [presensiId]);

  // Tick every second to handle automatic time-based closing without refreshing Page
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const isOpen = isPresensiOpen(presensi);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all duration-500 shadow-sm ${
        isOpen 
          ? "bg-white/20 text-white backdrop-blur-sm border border-white/10" 
          : "bg-red-600 text-white border border-red-500 shadow-red-900/40"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
          isOpen ? "bg-green-300 animate-pulse" : "bg-white"
        }`}
      />
      {isOpen ? "Dibuka" : "Ditutup"}
    </span>
  );
}
