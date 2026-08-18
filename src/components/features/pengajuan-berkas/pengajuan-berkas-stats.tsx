"use client";

import { Card } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";
import { getPengajuanBerkasStats } from "@/app/actions/pengajuan-berkas-actions";
import {
  FileText,
  Shield,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";

type PengajuanBerkasStatsProps = {
  stats: {
    total: number;
    ipnu: number;
    ippnu: number;
    bersama: number;
    cbpKpp: number;
    pending: number;
    diterima: number;
    ditolak: number;
  };
  userId?: string;
};

export function PengajuanBerkasStats({
  stats: initialStats,
  userId,
}: PengajuanBerkasStatsProps) {
  const [stats, setStats] = useState(initialStats);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (detail.model !== "PengajuanBerkas") return;
      if (timerRef.current) return;
      timerRef.current = setTimeout(async () => {
        timerRef.current = null;
        const fresh = await getPengajuanBerkasStats(userId);
        setStats(fresh);
      }, 300);
    };
    window.addEventListener("laci-realtime", handler as EventListener);
    return () => {
      window.removeEventListener("laci-realtime", handler as EventListener);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [userId]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Total Pengajuan */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            Total
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

      {/* IPNU */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-emerald-100 bg-emerald-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-emerald-700 uppercase">
            IPNU
          </span>
          <Shield className="h-4 w-4 text-green-600" />
        </div>
        <div className="text-xl font-bold text-green-600 leading-none">
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

      {/* IPPNU */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-rose-100 bg-rose-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-rose-700 uppercase">
            IPPNU
          </span>
          <Shield className="h-4 w-4 text-rose-500" />
        </div>
        <div className="text-xl font-bold text-rose-600 leading-none">
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

      {/* Bersama */}
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

      {/* CBP KPP */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-amber-100 bg-amber-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-amber-700 uppercase">
            CBP KPP
          </span>
          <Shield className="h-4 w-4 text-amber-500" />
        </div>
        <div className="text-xl font-bold text-amber-600 leading-none">
          <NumberTicker
            value={stats.cbpKpp}
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

      {/* Pending */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-orange-100 bg-orange-50/10">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-orange-700 uppercase">
            Pending
          </span>
          <Clock className="h-4 w-4 text-orange-500" />
        </div>
        <div className="text-xl font-bold text-orange-600 leading-none">
          <NumberTicker
            value={stats.pending}
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

      {/* Diterima */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-emerald-100 bg-emerald-50/10">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-emerald-700 uppercase">
            Diterima
          </span>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        </div>
        <div className="text-xl font-bold text-green-600 leading-none">
          <NumberTicker
            value={stats.diterima}
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

      {/* Ditolak */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-rose-100 bg-rose-50/10">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-rose-700 uppercase">
            Ditolak
          </span>
          <XCircle className="h-4 w-4 text-rose-500" />
        </div>
        <div className="text-xl font-bold text-rose-600 leading-none">
          <NumberTicker
            value={stats.ditolak}
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
