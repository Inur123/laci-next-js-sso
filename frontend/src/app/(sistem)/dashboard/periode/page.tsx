import { auth } from "@/auth";
import { getApplicationPeriods } from "@/lib/application-context";
import { PeriodeList } from "@/components/features/periode/periode-list";
import { Button } from "@/components/ui/button";
import { Plus, CalendarDays, Info } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PeriodeSkeleton } from "@/components/features/periode/periode-skeleton";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const metadata = {
  title: "Periode | Laci Digital",
};

export default function PeriodePage() {
  return (
    <Suspense fallback={<PeriodeSkeleton />}>
      <PeriodeContent />
    </Suspense>
  );
}

async function PeriodeContent() {
  const session = await auth();
  if (!session) redirect("/");
  const userId = session?.user?.id;

  const periods = await getApplicationPeriods();

  const userRole = session?.user?.role;
  const cookieStore = await cookies();
  const activeViewId = cookieStore.get("view_periode_id")?.value;

  // Cookie historis yang sudah tidak valid tidak boleh mengalahkan periode aktif.
  const activePeriode = periods.find(p => p.isActive);
  const validViewId = periods.some((period) => period.id === activeViewId)
    ? activeViewId
    : undefined;
  const targetActiveViewId = validViewId || activePeriode?.id;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
            <CalendarDays size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Daftar Periode</h2>
            <p className="text-sm text-muted-foreground">
              Kelola masa bakti dan periode kepengurusan Anda.
            </p>
          </div>
        </div>
        <Button
          asChild
          className={`w-full sm:w-auto text-white shadow-md hover:shadow-xl transition-all duration-200 ${
            userRole === "SEKRETARIS_CABANG"
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          <Link href="/dashboard/periode/add">
            <Plus className="w-4 h-4 mr-2" />
            Tambah Periode
          </Link>
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 flex gap-3 text-xs leading-relaxed">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-blue-900">Petunjuk Penggunaan Fitur Periode</span>
            <span className="bg-red-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
              Fitur Baru
            </span>
          </div>
          <ul className="list-disc pl-4 space-y-1 text-blue-800/90 mt-1">
            <li><strong>Tombol Tampilkan:</strong> Digunakan untuk menyaring visualisasi data. Menekan tombol ini akan mengubah tampilan seluruh data (Arsip Surat, Pengajuan, dll.) ke masa bakti terpilih tanpa mengganggu proses surat-menyurat yang sedang aktif di database.</li>
            <li><strong>Tombol Aktifkan:</strong> Digunakan khusus untuk mengubah periode kepengurusan resmi yang sedang berjalan saat ini. Pengajuan berkas/surat dari PAC akan otomatis masuk ke periode resmi yang aktif ini.</li>
          </ul>
        </div>
      </div>

      <PeriodeList periods={periods} userRole={userRole} activeViewId={targetActiveViewId} />
    </div>
  );
}
