"use client";

import { Periode } from "@prisma/client";
import {
  activatePeriode,
  deletePeriode,
  getPeriodes,
} from "@/app/actions/periode-actions";
import { setViewPeriode } from "@/app/actions/view-periode-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Trash2, CheckCircle, Edit, Info, Loader2, Eye } from "lucide-react";
import Link from "next/link";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function PeriodeList({ 
  periods, 
  userRole,
  activeViewId 
}: { 
  periods: Periode[]; 
  userRole?: string;
  activeViewId?: string;
}) {
  const [data, setData] = useState<Periode[]>(periods);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewLoadingId, setViewLoadingId] = useState<string | null>(null);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setData(periods);
  }, [periods]);

  const refreshData = async () => {
    const fresh = await getPeriodes();
    setData(fresh);
  };

  async function handleActivate(id: string) {
    setLoadingId(id);
    const result = await activatePeriode(id);
    setLoadingId(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Periode berhasil diaktifkan!");
      refreshData();
    }
  }

  async function handleView(id: string, name: string) {
    setViewLoadingId(id);
    try {
      const result = await setViewPeriode(id);
      if (result.success) {
        toast.success(`Berhasil beralih ke periode data ${name}!`);
        // Refresh halaman agar state server di-render ulang
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal beralih periode data");
    } finally {
      setViewLoadingId(null);
    }
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    // Don't close modal yet.
    setLoadingId(id);
    const result = await deletePeriode(id);
    setLoadingId(null);

    if (result.error) {
      toast.error(result.error);
    } else {
      setConfirmDeleteId(null);
      toast.success("Periode berhasil dihapus!");
      refreshData();
    }
  }

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "Periode") return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        refreshData();
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

  if (data.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Informasi</AlertTitle>
        <AlertDescription>Belum ada periode yang dibuat.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4">
      {data.map((periode) => {
        const isViewing = activeViewId ? activeViewId === periode.id : periode.isActive;

        return (
          <div
            key={periode.id}
            className={`p-4 sm:p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 ${
              periode.isActive
                ? "border-green-300 bg-green-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg text-slate-900">
                  {periode.nama}
                </h3>
                {periode.isActive && (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 shadow-none border-none pointer-events-none text-[10px] px-2 py-0">
                    Aktif
                  </Badge>
                )}
              </div>
              <span className="text-sm text-slate-500 block">
                Dibuat:{" "}
                {new Date(periode.createdAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={isViewing ? "default" : "outline"}
                className={
                  isViewing
                    ? userRole === "SEKRETARIS_CABANG"
                      ? "bg-blue-600 text-white opacity-60 pointer-events-none hover:bg-blue-600"
                      : "bg-green-600 text-white opacity-60 pointer-events-none hover:bg-green-600"
                    : ""
                }
                disabled={viewLoadingId === periode.id || isViewing}
                onClick={() => handleView(periode.id, periode.nama)}
              >
                {viewLoadingId === periode.id ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4 mr-1" />
                )}
                {isViewing ? "Sedang Ditampilkan" : "Tampilkan"}
              </Button>
            {!periode.isActive && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleActivate(periode.id)}
                disabled={loadingId === periode.id}
              >
                {loadingId === periode.id ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-1" />
                )}
                {loadingId === periode.id ? "Memproses..." : "Aktifkan"}
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link href={`/dashboard/periode/${periode.id}/edit`}>
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => setConfirmDeleteId(periode.id)}
              disabled={loadingId === periode.id || periode.isActive}
              title={
                periode.isActive
                  ? "Periode aktif tidak dapat dihapus"
                  : "Hapus periode"
              }
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      );
    })}


      <ConfirmModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Periode?"
        description="Apakah Anda yakin ingin menghapus periode ini? Tindakan ini tidak dapat dibatalkan."
        variant="destructive"
        loading={!!loadingId}
      />
    </div>
  );
}
