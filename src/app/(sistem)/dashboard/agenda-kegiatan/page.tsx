import { auth } from "@/auth";
import { KegiatanList } from "@/components/features/agenda-kegiatan/kegiatan-list";
import { KegiatanStats } from "@/components/features/agenda-kegiatan/kegiatan-stats";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getAgendaKegiatanList,
  getAgendaKegiatanStats,
} from "@/app/actions/agenda-kegiatan-actions";
import prisma from "@/lib/prisma";
import { Suspense } from "react";
import { KegiatanListSkeleton } from "@/components/features/agenda-kegiatan/kegiatan-skeleton";

export const metadata = {
  title: "Agenda Kegiatan | Laci Digital",
  description: "Manajemen jadwal dan agenda kegiatan organisasi.",
};

type SearchParams = Promise<{ query?: string; page?: string; sortKey?: string; sortDir?: string }>;

export default async function KegiatanPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (!session) redirect("/login");

  // Access control: Only SEKRETARIS_CABANG
  if (session.user.role !== "SEKRETARIS_CABANG") {
    redirect("/dashboard");
  }

  return (
    <Suspense fallback={<KegiatanListSkeleton />}>
      <KegiatanPageContent
        searchParams={searchParams}
        userRole={session.user.role}
        userId={session.user.id}
      />
    </Suspense>
  );
}

async function KegiatanPageContent({
  searchParams,
  userRole,
  userId,
}: {
  searchParams: SearchParams;
  userRole?: string;
  userId: string;
}) {
  const periodeAktif = await prisma.periode.findFirst({
    where: {
      userId: userId,
      isActive: true,
    },
  });

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
            <Calendar size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Agenda Kegiatan</h2>
            <p className="text-sm text-muted-foreground">
              {periodeAktif
                ? `Periode: ${periodeAktif.nama}`
                : "Tidak ada periode aktif"}
            </p>
          </div>
        </div>
        {periodeAktif && (
          <Button
            asChild
            className={`w-full sm:w-auto gap-2 text-white shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer ${
              userRole === "SEKRETARIS_CABANG"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <Link href="/dashboard/agenda-kegiatan/add">
              <Plus size={16} />
              Tambah Kegiatan
            </Link>
          </Button>
        )}
      </div>

      {!periodeAktif ? (
        <div className="rounded-lg border border-dashed p-8 text-center mt-4">
          <p className="text-muted-foreground">
            Silakan aktifkan periode terlebih dahulu untuk mengelola agenda
            kegiatan.
          </p>
          <Button
            asChild
            className={`mt-4 text-white shadow-md hover:shadow-xl transition-all duration-200 ${
              userRole === "SEKRETARIS_CABANG"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <Link href="/dashboard/periode">Kelola Periode</Link>
          </Button>
        </div>
      ) : (
        <KegiatanContent searchParams={searchParams} userRole={userRole} />
      )}
    </div>
  );
}

async function KegiatanContent({
  searchParams,
  userRole,
}: {
  searchParams: SearchParams;
  userRole?: string;
}) {
  const params = await searchParams;
  const query = params.query || "";
  const page = Number(params.page) || 1;
  const sortKey = (params.sortKey as string) || "tanggalMulai";
  const sortDir = (params.sortDir as "asc" | "desc") || "desc";

  const [{ data, totalPages, total }, stats] = await Promise.all([
    getAgendaKegiatanList(query, page, 10, undefined, sortKey, sortDir),
    getAgendaKegiatanStats(),
  ]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <KegiatanStats stats={stats} />
      <KegiatanList
        kegiatanList={data}
        userRole={userRole || "SEKRETARIS_PAC"}
        totalPages={totalPages}
        currentPage={page}
        totalItems={total}
      />
    </div>
  );
}
