"use client";

import { Card } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";
import { getUserStats } from "@/app/actions/auth-actions";
import { Users, UserCheck, UserX, MailCheck, MailX } from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";

type UserStatsProps = {
  stats: {
    total: number;
    aktif: number;
    nonaktif: number;
    terverifikasi: number;
    belumVerifikasi: number;
  };
};

export function UserStats({ stats: initialStats }: UserStatsProps) {
  const [stats, setStats] = useState(initialStats);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "User") return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(async () => {
        realtimeTimerRef.current = null;
        const fresh = await getUserStats();
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
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {/* Total User */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            Total User
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

      {/* Akun Aktif */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-emerald-100 bg-emerald-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-emerald-700 uppercase">
            Akun Aktif
          </span>
          <UserCheck className="h-4 w-4 text-green-600" />
        </div>
        <div className="text-xl font-bold text-green-600 leading-none">
          <NumberTicker
            value={stats.aktif}
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

      {/* Akun Nonaktif */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-rose-100 bg-rose-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-rose-700 uppercase">
            Akun Nonaktif
          </span>
          <UserX className="h-4 w-4 text-rose-500" />
        </div>
        <div className="text-xl font-bold text-rose-600 leading-none">
          <NumberTicker
            value={stats.nonaktif}
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

      {/* Email Terverifikasi */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-blue-100 bg-blue-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-blue-700 uppercase">
            Email Terverifikasi
          </span>
          <MailCheck className="h-4 w-4 text-blue-500" />
        </div>
        <div className="text-xl font-bold text-blue-600 leading-none">
          <NumberTicker
            value={stats.terverifikasi}
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

      {/* Belum Verifikasi */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-orange-100 bg-orange-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-orange-700 uppercase">
            Belum Verifikasi
          </span>
          <MailX className="h-4 w-4 text-orange-500" />
        </div>
        <div className="text-xl font-bold text-orange-600 leading-none">
          <NumberTicker
            value={stats.belumVerifikasi}
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
