"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function AnggotaTabs({ 
  currentStatus, 
  onChange,
  userRole 
}: { 
  currentStatus: "PENDING" | "DITERIMA" | "DITOLAK"; 
  onChange: (val: "PENDING" | "DITERIMA" | "DITOLAK") => void;
  userRole?: string; 
}) {
  const handleTabChange = (status: "PENDING" | "DITERIMA" | "DITOLAK") => {
    onChange(status);
  };

  const isCabang = userRole === "SEKRETARIS_CABANG" || userRole === "CABANG";

  const getTabStyle = (tabStatus: string) => {
    const isActive = currentStatus === tabStatus;
    let style = "w-full rounded-md px-3 py-2 cursor-pointer select-none transition-all flex gap-2 items-center justify-center font-medium text-xs sm:text-sm ";
    if (isActive) {
      style += isCabang ? "bg-blue-600 text-white shadow-sm" : "bg-green-600 text-white shadow-sm";
    } else {
      style += isCabang ? "text-slate-500 hover:text-blue-600 hover:bg-blue-50" : "text-slate-500 hover:text-green-600 hover:bg-green-50";
    }
    return style;
  };

  return (
    <div className="grid w-full md:w-auto grid-cols-3 bg-slate-50 p-1 rounded-lg border border-slate-100">
      <button
        onClick={() => handleTabChange("PENDING")}
        className={getTabStyle("PENDING")}
      >
        Menunggu Verifikasi
      </button>
      <button
        onClick={() => handleTabChange("DITERIMA")}
        className={getTabStyle("DITERIMA")}
      >
        Anggota
      </button>
      <button
        onClick={() => handleTabChange("DITOLAK")}
        className={getTabStyle("DITOLAK")}
      >
        Ditolak
      </button>
    </div>
  );
}
