"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { getBerkasPimpinanStats } from "@/app/actions/berkas-pimpinan-actions";
import {
  FileText,
  CalendarDays,
} from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";

type BerkasPimpinanStatsProps = {
  stats: {
    total: number;
    bulanIni: number;
  };
};

export function BerkasPimpinanStats({ stats: initialStats }: BerkasPimpinanStatsProps) {
  const [stats, setStats] = useState(initialStats);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "BerkasPimpinan") return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(async () => {
        realtimeTimerRef.current = null;
        const fresh = await getBerkasPimpinanStats();
        if (fresh) setStats(fresh);
      }, 300);
    };
    window.addEventListener("laci-realtime", handler);
    return () => {
      window.removeEventListener("laci-realtime", handler);
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
    };
  }, []);

  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 gap-3 md:w-1/2 lg:w-1/3">
      {/* Total Berkas */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            Total Berkas
          </span>
          <FileText className="h-4 w-4 text-slate-400" />
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

      {/* Bulan Ini */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-blue-100 bg-blue-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-blue-700 uppercase">
            Bulan Ini
          </span>
          <CalendarDays className="h-4 w-4 text-blue-500" />
        </div>
        <div className="text-xl font-bold text-blue-600 leading-none">
          <NumberTicker
            value={stats.bulanIni}
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
