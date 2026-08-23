import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Activity,
  FileText,
  Users,
  Briefcase,
  Calendar,
  Send,
  Shield,
  Layers,
  Lock,
  User,
  type LucideIcon,
} from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { useEffect, useRef, useState } from "react";
import {
  getLogStats,
  getGlobalLogStats,
} from "@/app/actions/log-activity-actions";

type LogStatsProps = {
  stats: Record<string, number> | null;
  currentView: string;
  userRole: string;
  userId?: string;
};

const moduleConfig: Record<
  string,
  { label: string; color: string; icon: LucideIcon }
> = {
  TOTAL: { label: "Semua", color: "slate", icon: Activity },
  ARSIP_SURAT: { label: "Arsip Surat", color: "blue", icon: FileText },
  ANGGOTA: { label: "Anggota", color: "green", icon: Users },
  BERKAS_PIMPINAN: {
    label: "Berkas Pimpinan",
    color: "purple",
    icon: Briefcase,
  },
  BERKAS_SP: { label: "Berkas SP", color: "indigo", icon: Shield },
  AGENDA_KEGIATAN: { label: "Kegiatan", color: "amber", icon: Calendar },
  PENGAJUAN_BERKAS: { label: "Pengajuan PAC", color: "rose", icon: Send },
  PERIODE: { label: "Periode", color: "cyan", icon: Layers },
  AUTH: { label: "Autentikasi", color: "slate", icon: Lock },
  USER: { label: "Update Profil", color: "slate", icon: User },
  PRESENSI: { label: "Presensi", color: "emerald", icon: Activity },
  WILAYAH: { label: "Wilayah", color: "teal", icon: Activity },
};

export function LogActivityStats({
  stats: initialStats,
  currentView,
  userRole,
  userId,
}: LogStatsProps) {
  const [stats, setStats] = useState(initialStats);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync with props if they change
  useEffect(() => {
    setStats(initialStats);
  }, [initialStats]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as any).detail as {
        type?: string;
        model?: string;
      };

      const isLogEvent =
        detail?.type === "log" ||
        (detail?.type === "mutation" && detail.model === "LogActivity");

      if (!isLogEvent) return;
      if (timerRef.current) return;

      timerRef.current = setTimeout(async () => {
        timerRef.current = null;

        // Give extra time for server revalidation to settle
        await new Promise((resolve) => setTimeout(resolve, 300));

        const fresh =
          currentView === "global"
            ? await getGlobalLogStats(userId)
            : await getLogStats();

        if (fresh) setStats(fresh);
      }, 500);
    };

    window.addEventListener("laci-realtime", handler as EventListener);
    return () => {
      window.removeEventListener("laci-realtime", handler as EventListener);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentView, userId]);

  if (!stats) return null;

  const isCabang = userRole === "SEKRETARIS_CABANG";

  // Filter modules based on role as requested
  // PAC: total log, total arsip surat, total berkas pompinan, total pengajuan pac, total anggota, periode, auth, update profile
  const modulesToShow = isCabang
    ? [
        "TOTAL",
        "ARSIP_SURAT",
        "ANGGOTA",
        "BERKAS_PIMPINAN",
        "BERKAS_SP",
        "AGENDA_KEGIATAN",
        "PENGAJUAN_BERKAS",
        "PERIODE",
        "AUTH",
        "WILAYAH",
        "PRESENSI",
      ]
    : [
        "TOTAL",
        "ARSIP_SURAT",
        "BERKAS_PIMPINAN",
        "PENGAJUAN_BERKAS",
        "ANGGOTA",
        "PERIODE",
        "AUTH",
        "WILAYAH",
        "PRESENSI",
      ];

  return (
    <div
      className={cn(
        "grid gap-3",
        isCabang
          ? "grid-cols-2 md:grid-cols-5 lg:grid-cols-5"
          : "grid-cols-2 md:grid-cols-4 lg:grid-cols-4",
      )}
    >
      {modulesToShow.map((module) => {
        const config = moduleConfig[module] || {
          label: module,
          color: "slate",
          icon: Activity,
        };
        const Icon = config.icon;
        let color = config.color;

        // Differentiate TOTAL based on view
        if (module === "TOTAL") {
          color = currentView === "global" ? "blue" : "green";
        }

        const count = stats[module] || 0;

        const iconColorClasses: Record<string, string> = {
          slate: "text-slate-400",
          blue: "text-blue-600",
          green: "text-green-600",
          purple: "text-purple-600",
          indigo: "text-indigo-600",
          amber: "text-amber-600",
          rose: "text-rose-600",
          cyan: "text-cyan-600",
        };

        const iconClass = iconColorClasses[color] || iconColorClasses.slate;

        return (
          <Card
            key={module}
            className="h-[85px] flex flex-col justify-between p-3 shadow-none border-slate-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-500 truncate pr-1">
                {config.label}
              </span>
              <Icon className={cn("h-4 w-4 shrink-0", iconClass)} />
            </div>
            <div className="text-xl font-bold text-slate-900 leading-none">
              <NumberTicker
                value={count}
                formatter={(val) =>
                  new Intl.NumberFormat("id-ID", {
                    notation: "compact",
                    compactDisplay: "short",
                    maximumFractionDigits: 1,
                  }).format(val)
                }
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
