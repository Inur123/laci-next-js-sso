"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { AnggotaTabs } from "./anggota-tabs";
import { AnggotaStats } from "./anggota-stats";
import { AnggotaList } from "./anggota-list";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function AnggotaClientWrapper({
  periodeAktif,
  userRole,
  userId,
  stats,
  initialData,
  activeUsers,
}: any) {
  const [activeTab, setActiveTab] = useState<"PENDING" | "DITERIMA" | "DITOLAK">("PENDING");

  const isCabang = userRole === "SEKRETARIS_CABANG" || userRole === "CABANG";

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
            <Users size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Data Anggota</h2>
            <p className="text-sm text-muted-foreground">
              {periodeAktif
                ? "Kelola data anggota dan pengurus di tingkat organisasi Anda."
                : "Tidak ada periode aktif"}
            </p>
          </div>
        </div>
        {periodeAktif && (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <AnggotaTabs currentStatus={activeTab} onChange={setActiveTab} userRole={userRole} />
          </div>
        )}
      </div>

      {!periodeAktif ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Silakan aktifkan periode terlebih dahulu untuk mengelola data anggota.
          </p>
          <Button
            asChild
            className={`mt-4 text-white shadow-md hover:shadow-xl transition-all duration-200 ${
              isCabang ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <Link href="/dashboard/periode">Kelola Periode</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <AnggotaStats stats={stats} userId={userId} />
          <AnggotaList
            anggotaList={initialData.data}
            userRole={userRole || "SEKRETARIS_PAC"}
            totalPages={initialData.totalPages}
            currentPage={1}
            totalItems={initialData.total}
            activeUsers={activeUsers}
            initialSearchTerm=""
            initialSelectedUser={userId || "ALL"}
            initialSortKey="namaLengkap"
            initialSortDir="asc"
            initialStatus={activeTab}
          />
        </div>
      )}
    </div>
  );
}
