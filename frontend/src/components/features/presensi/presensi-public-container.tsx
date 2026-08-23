"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import Image from "next/image";
import { isPresensiOpen } from "@/lib/presensi-utils";
import { getPresensiDetail } from "@/app/actions/presensi-actions";
import { AttendanceForm } from "./attendance-form";
import { PresensiStatusBadge } from "./presensi-status-badge";

interface PresensiPublicContainerProps {
  initialData: any;
}

const capitalizeName = (name: string) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export function PresensiPublicContainer({
  initialData,
}: PresensiPublicContainerProps) {
  const [data, setData] = useState(initialData);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const refreshData = async () => {
      try {
        const fresh = await getPresensiDetail(initialData.id);
        if (fresh) {
          setData(fresh);
        }
      } catch {}
    };

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
        if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = setTimeout(refreshData, 500);
      }
    };

    window.addEventListener("laci-realtime", handleRealtime);
    return () => {
      window.removeEventListener("laci-realtime", handleRealtime);
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
    };
  }, [initialData.id]);

  const isOpen = isPresensiOpen(data);
  const tanggalFormatted = format(
    new Date(data.tanggal),
    "EEEE, dd MMMM yyyy",
    {
      locale: idLocale,
    },
  );

  return (
    <div className="w-full max-w-md bg-white sm:rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col">
      {/* ── Top green header ── */}
      <div className="bg-green-600 text-white px-6 pt-6 pb-5">
        {/* Brand bar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative w-10 h-10 shrink-0 bg-white rounded-full p-0.5 shadow-sm">
            <Image
              src="/images/logo-laci.webp"
              alt="Laci Digital"
              fill
              sizes="40px"
              className="object-contain rounded-full"
              priority
            />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Laci Digital</p>
            <p className="text-green-200 text-[10px] mt-0.5 leading-none">
              PC IPNU IPPNU Kab. Magetan
            </p>
          </div>
          <div className="ml-auto">
            <PresensiStatusBadge presensiId={data.id} initialPresensi={data} />
          </div>
        </div>

        {/* Event info */}
        <div className="space-y-4">
          <h1 className="text-2xl font-black leading-tight tracking-tight">
            {capitalizeName(data.namaKegiatan)}
          </h1>
          <div className="grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
            <div>
              <p className="text-green-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                Penyelenggara
              </p>
              <p className="text-white font-bold text-xs leading-tight">
                {capitalizeName(data.penyelenggara)}
              </p>
            </div>
            <div>
              <p className="text-green-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                Tempat
              </p>
              <p className="text-white font-bold text-xs leading-tight">
                {capitalizeName(data.tempat)}
              </p>
            </div>
            <div className="col-span-2 flex items-center gap-2 text-white/90 text-[11px] font-bold">
              <span>{tanggalFormatted}</span>
              <span className="opacity-40">•</span>
              <span>
                {data.jamMulai} – {data.jamSelesai} WIB
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Form area ── */}
      <div className="px-6 py-6 bg-white">
        <AttendanceForm presensi={{ ...data, statusOpen: isOpen }} />
      </div>
    </div>
  );
}
