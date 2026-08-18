"use client";

import { useState, useEffect, useRef } from "react";
import { getDashboardStats } from "@/app/actions/dashboard-actions";
import { toast } from "sonner";
import { DashboardPersonal } from "./dashboard-personal";
import dynamic from "next/dynamic";

const DashboardMonitoring = dynamic(
  () => import("./dashboard-monitoring").then((mod) => mod.DashboardMonitoring),
  {
    loading: () => (
      <div className="h-[400px] w-full animate-pulse bg-slate-100/50 rounded-xl" />
    ), // Placeholder
    ssr: false, // Charts are client-only anyway
  },
);
import { LayoutDashboard, BarChart3 } from "lucide-react";

type DashboardClientData = {
  role: string;
  emailVerified: boolean;
  personal: {
    anggota: number;
    globalAnggota?: number;
    surat: number;
    berkasSP?: number;
    berkasPimpinan: number;
    pengajuan: number;
    userCount?: number;
    periode: number;
    kegiatan: number;
    presensi: number;
    trend?: { name: string; value: number }[];
  };
  monitoring: {
    global: {
      totalAnggota: number;
      totalSurat: number;
      totalPAC: number;
      verifikasiPending: number;
    };
    leaderboard: {
      id: string;
      name: string;
      image: string | null;
      score: number;
      stats: {
        anggotas: number;
        arsipSurats: number;
        pengajuanBerkass: number;
      };
    }[];
  } | null;
};

export default function DashboardClient({
  initialData,
  showLoginToast,
}: {
  initialData: DashboardClientData | null;
  showLoginToast?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"personal" | "monitoring">(
    "personal",
  );
  const [data, setData] = useState(initialData);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (showLoginToast) {
      toast.success("Login berhasil!", {
        description: "Selamat datang kembali di Laci Digital",
        duration: 3000,
      });

      // Cleanup: Hapus cookie dan bersihkan URL agar tidak muncul lagi saat refresh
      document.cookie =
        "login_success=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

      const url = new URL(window.location.href);
      url.searchParams.delete("login");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, [showLoginToast]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };

      // Listen for any mutation or log to refresh dashboard
      if (!detail || (detail.type !== "mutation" && detail.type !== "log"))
        return;
      if (realtimeTimerRef.current) return;

      realtimeTimerRef.current = setTimeout(async () => {
        realtimeTimerRef.current = null;
        const fresh = await getDashboardStats();
        if (fresh) setData(fresh);
      }, 300);
    };

    window.addEventListener("laci-realtime", handler as EventListener);

    return () => {
      window.removeEventListener("laci-realtime", handler as EventListener);
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
      }
    };
  }, []);

  if (!data) return null;

  const isCabang = data.role === "CABANG";

  // Helper styles for tabs
  const getTabStyle = (tabName: "personal" | "monitoring") => {
    const isActive = activeTab === tabName;

    // Base style
    let style =
      "w-full rounded-md px-3 py-2 cursor-pointer select-none transition-all flex gap-2 items-center justify-center font-medium text-xs sm:text-sm ";

    if (isActive) {
      // Active Style (Solid Color)
      style += isCabang
        ? "bg-blue-600 text-white shadow-sm"
        : "bg-green-600 text-white shadow-sm";
    } else {
      // Inactive Style (Ghost)
      style += isCabang
        ? "text-slate-500 hover:text-blue-600 hover:bg-blue-50"
        : "text-slate-500 hover:text-green-600 hover:bg-green-50";
    }
    return style;
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-4">
          <div
            className={`p-2.5 rounded-xl border-2 ${
              isCabang
                ? "bg-blue-50/50 border-blue-100 text-blue-600"
                : "bg-emerald-50/50 border-emerald-100 text-emerald-600"
            } hidden sm:block shadow-sm`}
          >
            <LayoutDashboard size={24} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1
              className={`text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${
                isCabang
                  ? "from-blue-700 to-blue-500"
                  : "from-emerald-800 to-emerald-600"
              } tracking-tight`}
            >
              Dashboard
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Pusat kontrol dan monitoring administrasi.
            </p>
          </div>
        </div>

        {/* Custom Tab Selector - Only if Cabang */}
        {isCabang && (
          <div className="grid w-full md:w-auto grid-cols-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
            <button
              onClick={() => setActiveTab("personal")}
              className={getTabStyle("personal")}
            >
              <LayoutDashboard size={16} />
              Data Saya
            </button>
            <button
              onClick={() => setActiveTab("monitoring")}
              className={getTabStyle("monitoring")}
            >
              <BarChart3 size={16} />
              Monitoring Wilayah
            </button>
          </div>
        )}
      </div>

      <div className="mt-0">
        {activeTab === "personal" ? (
          <div>
            <DashboardPersonal
              stats={data.personal}
              role={data.role}
              emailVerified={data.emailVerified}
            />
          </div>
        ) : (
          <div>
            {data.monitoring && <DashboardMonitoring data={data.monitoring} />}
          </div>
        )}
      </div>
    </div>
  );
}
