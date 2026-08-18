"use client";

import { Card } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";
import { getAnggotaStats } from "@/app/actions/anggota-actions";
import {
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldPlus,
} from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";

type AnggotaStatsProps = {
  stats: {
    total: number;
    lakiLaki: number;
    perempuan: number;
    makesta: number;
    lakmud: number;
    latin: number;
    latpel: number;
    lakut: number;
  } | null;
  userId?: string;
};

export function AnggotaStats({
  stats: initialStats,
  userId,
}: AnggotaStatsProps) {
  const [stats, setStats] = useState(initialStats);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync with prop changes (e.g. from URL params or parent state)
  useEffect(() => {
    setStats(initialStats);
  }, [initialStats]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "Anggota") return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(async () => {
        realtimeTimerRef.current = null;
        const fresh = await getAnggotaStats(userId);
        if (fresh) setStats(fresh);
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
  }, [userId]);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Total Anggota */}
      <Card className="h-[82px] flex flex-col justify-between p-3 shadow-none border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            Total Anggota
          </span>
          <Users className="h-4 w-4 text-slate-400" />
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

      {/* Laki-laki */}
      <Card className="h-[82px] flex flex-col justify-between p-3 shadow-none border-emerald-100 bg-emerald-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-emerald-700 uppercase">
            Laki-laki (IPNU)
          </span>
          <Shield className="h-4 w-4 text-green-600" />
        </div>
        <div className="text-xl font-bold text-green-600 leading-none">
          <NumberTicker
            value={stats.lakiLaki}
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

      {/* Perempuan */}
      <Card className="h-[82px] flex flex-col justify-between p-3 shadow-none border-rose-100 bg-rose-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-rose-700 uppercase">
            Perempuan (IPPNU)
          </span>
          <ShieldAlert className="h-4 w-4 text-rose-500" />
        </div>
        <div className="text-xl font-bold text-rose-600 leading-none">
          <NumberTicker
            value={stats.perempuan}
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
      {/* Makesta */}
      <Card className="h-[82px] flex flex-col justify-between p-3 shadow-none border-blue-100 bg-blue-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-blue-700 uppercase">
            Makesta
          </span>
          <Shield className="h-4 w-4 text-blue-500" />
        </div>
        <div className="text-xl font-bold text-blue-600 leading-none">
          <NumberTicker
            value={stats.makesta}
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

      {/* Lakmud */}
      <Card className="h-[82px] flex flex-col justify-between p-3 shadow-none border-indigo-100 bg-indigo-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-indigo-700 uppercase">
            Lakmud
          </span>
          <ShieldAlert className="h-4 w-4 text-indigo-500" />
        </div>
        <div className="text-xl font-bold text-indigo-600 leading-none">
          <NumberTicker
            value={stats.lakmud}
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
      {/* Latin */}
      <Card className="h-[82px] flex flex-col justify-between p-3 shadow-none border-amber-100 bg-amber-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-amber-700 uppercase">
            Latin
          </span>
          <ShieldCheck className="h-4 w-4 text-amber-500" />
        </div>
        <div className="text-xl font-bold text-amber-600 leading-none">
          <NumberTicker
            value={stats.latin}
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

      {/* Latpel */}
      <Card className="h-[82px] flex flex-col justify-between p-3 shadow-none border-orange-100 bg-orange-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-orange-700 uppercase">
            Latpel
          </span>
          <ShieldCheck className="h-4 w-4 text-orange-500" />
        </div>
        <div className="text-xl font-bold text-orange-600 leading-none">
          <NumberTicker
            value={stats.latpel}
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

      {/* LAKUT */}
      <Card className="h-[82px] flex flex-col justify-between p-3 shadow-none border-violet-100 bg-violet-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-violet-700 uppercase">
            Lakut
          </span>
          <ShieldPlus className="h-4 w-4 text-violet-500" />
        </div>
        <div className="text-xl font-bold text-violet-600 leading-none">
          <NumberTicker
            value={stats.lakut}
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
