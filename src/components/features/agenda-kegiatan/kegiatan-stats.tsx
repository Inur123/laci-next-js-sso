"use client";

import { Card } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";
import { getAgendaKegiatanStats } from "@/app/actions/agenda-kegiatan-actions";
import { Calendar, Clock, CheckCircle2 } from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";

type KegiatanStatsProps = {
  stats: {
    total: number;
    mendatang: number;
    selesai: number;
  };
};

export function KegiatanStats({ stats: initialStats }: KegiatanStatsProps) {
  const [stats, setStats] = useState(initialStats);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "AgendaKegiatan") return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(async () => {
        realtimeTimerRef.current = null;
        const fresh = await getAgendaKegiatanStats();
        setStats(fresh);
      }, 300);
    };
    window.addEventListener("laci-realtime", handler as EventListener);
    return () => {
      window.removeEventListener("laci-realtime", handler as EventListener);
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Total Kegiatan */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            Total Kegiatan
          </span>
          <Calendar className="h-4 w-4 text-slate-400" />
        </div>
        <div className="text-xl font-bold text-slate-900 leading-none">
          <NumberTicker
            value={stats.total}
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

      {/* Kegiatan Mendatang */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-blue-100 bg-blue-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-blue-700 uppercase">
            Mendatang
          </span>
          <Clock className="h-4 w-4 text-blue-500" />
        </div>
        <div className="text-xl font-bold text-blue-600 leading-none">
          <NumberTicker
            value={stats.mendatang}
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

      {/* Kegiatan Selesai */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-emerald-100 bg-emerald-50/10">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-emerald-700 uppercase">
            Selesai
          </span>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </div>
        <div className="text-xl font-bold text-green-600 leading-none">
          <NumberTicker
            value={stats.selesai}
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
    </div>
  );
}
