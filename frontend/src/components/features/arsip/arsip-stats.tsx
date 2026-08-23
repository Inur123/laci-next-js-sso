"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { getArsipStats } from "@/app/actions/arsip-actions";
import {
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Shield,
  Users,
} from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";

type ArsipStatsProps = {
  stats: {
    total: number;
    masuk: number;
    keluar: number;
    ipnu: number;
    ippnu: number;
    bersama: number;
    cbpkpp: number;
  };
};

export function ArsipStats({ stats: initialStats }: ArsipStatsProps) {
  const [stats, setStats] = useState(initialStats);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "ArsipSurat") return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(async () => {
        realtimeTimerRef.current = null;
        const fresh = await getArsipStats();
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
    <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
      {/* Total Surat */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            Total Surat
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

      {/* Surat Masuk */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-emerald-100 bg-emerald-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-emerald-700 uppercase">
            Masuk
          </span>
          <ArrowDownLeft className="h-4 w-4 text-green-600" />
        </div>
        <div className="text-xl font-bold text-green-600 leading-none">
          <NumberTicker
            value={stats.masuk}
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

      {/* Surat Keluar */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-orange-100 bg-orange-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-orange-700 uppercase">
            Keluar
          </span>
          <ArrowUpRight className="h-4 w-4 text-orange-500" />
        </div>
        <div className="text-xl font-bold text-orange-600 leading-none">
          <NumberTicker
            value={stats.keluar}
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

      {/* Total IPNU */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-green-100 bg-green-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-green-700 uppercase">
            IPNU
          </span>
          <Shield className="h-4 w-4 text-green-600" />
        </div>
        <div className="text-xl font-bold text-green-700 leading-none">
          <NumberTicker
            value={stats.ipnu}
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

      {/* Total IPPNU */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-green-100 bg-green-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-green-600 uppercase">
            IPPNU
          </span>
          <Shield className="h-4 w-4 text-green-600" />
        </div>
        <div className="text-xl font-bold text-green-600 leading-none">
          <NumberTicker
            value={stats.ippnu}
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

      {/* Total BERSAMA */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-blue-100 bg-blue-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-blue-700 uppercase">
            Bersama
          </span>
          <Users className="h-4 w-4 text-blue-500" />
        </div>
        <div className="text-xl font-bold text-blue-600 leading-none">
          <NumberTicker
            value={stats.bersama}
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

      {/* Total CBP/KPP */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-orange-100 bg-orange-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-orange-700 uppercase">
            CBP/KPP
          </span>
          <Shield className="h-4 w-4 text-orange-600" />
        </div>
        <div className="text-xl font-bold text-orange-700 leading-none">
          <NumberTicker
            value={stats.cbpkpp}
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
