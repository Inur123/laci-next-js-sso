import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getPengajuanBerkass,
  getVerifikasiPengajuanForCabang,
  getActivePacUsers,
  getPengajuanBerkasStats,
} from "@/app/actions/pengajuan-berkas-actions";
import { PengajuanBerkasList } from "@/components/features/pengajuan-berkas/pengajuan-berkas-list";
import { PengajuanBerkasStats } from "@/components/features/pengajuan-berkas/pengajuan-berkas-stats";
import { PengajuanBerkasSkeleton } from "@/components/features/pengajuan-berkas/pengajuan-berkas-skeleton";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { Suspense } from "react";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export const metadata = {
  title: "Pengajuan Berkas | Laci Digital",
};

export default async function PengajuanBerkasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userRole = session.user.role;
  const isCabang = userRole === "SEKRETARIS_CABANG";
  const pageTitle = "Pengajuan Berkas";

  return (
    <Suspense fallback={<PengajuanBerkasSkeleton isCabang={isCabang} />}>

      <PengajuanBerkasPageContent
        searchParams={searchParams}
        userId={session.user.id}
        pageTitle={pageTitle}
      />
    </Suspense>
  );
}

async function PengajuanBerkasPageContent({
  searchParams,
  userId,
  pageTitle,
}: {
  searchParams: SearchParams;
  userId: string;
  pageTitle: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const isCabang = user?.role === "SEKRETARIS_CABANG";
  const isPAC = user?.role === "SEKRETARIS_PAC";

  // For PAC, check if they have active periode
  const periodeAktif = isPAC
    ? await prisma.periode.findFirst({
        where: { userId: userId, isActive: true },
      })
    : null;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{pageTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {isCabang
                ? "Kelola dan verifikasi pengajuan surat dari Sekretaris PAC"
                : periodeAktif
                  ? `Periode: ${periodeAktif.nama}`
                  : "Tidak ada periode aktif"}
            </p>
          </div>
        </div>
        {isPAC && periodeAktif && (
          <Button
            asChild
            className={`w-full sm:w-auto text-white shadow-md hover:shadow-xl transition-all duration-200 ${
              user?.role === "SEKRETARIS_CABANG"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <Link href="/dashboard/pengajuan-berkas/add">
              <Plus className="w-4 h-4 mr-2" />
              Buat Pengajuan
            </Link>
          </Button>
        )}
      </div>

      {isPAC && !periodeAktif ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Silakan aktifkan periode terlebih dahulu untuk membuat pengajuan.
          </p>
          <Button
            asChild
            className={`mt-4 text-white shadow-md hover:shadow-xl transition-all duration-200 ${
              user?.role === "SEKRETARIS_CABANG"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <Link href="/dashboard/periode">Kelola Periode</Link>
          </Button>
        </div>
      ) : (
        <PengajuanContent
          searchParams={searchParams}
          isCabang={isCabang}
          isPAC={isPAC}
          userRole={user?.role}
        />
      )}
    </div>
  );
}

async function PengajuanContent({
  searchParams,
  isCabang,
  isPAC,
  userRole,
}: {
  searchParams: SearchParams;
  isCabang: boolean;
  isPAC: boolean;
  userRole?: string | null;
}) {
  const params = await searchParams;
  const q = (params.q as string) || "";
  const page = Number(params.page) || 1;
  const limit = 10;

  type PengajuanBerkasResult = Awaited<ReturnType<typeof getPengajuanBerkass>>;
  type PengajuanBerkasStatsData = Awaited<ReturnType<typeof getPengajuanBerkasStats>>;
  type PacUser = Awaited<ReturnType<typeof getActivePacUsers>>[number];

  let pengajuanData: PengajuanBerkasResult = {
    data: [],
    total: 0,
    totalPages: 0,
  };
  let pacUsers: PacUser[] = [];
  let stats: PengajuanBerkasStatsData = {
    total: 0,
    ipnu: 0,
    ippnu: 0,
    bersama: 0,
    cbpKpp: 0,
    pending: 0,
    diterima: 0,
    ditolak: 0,
  };

  const userIdParam = (params.userId as string) || "ALL";

  if (isCabang) {
    const [result, users, statsResult] = await Promise.all([
      getVerifikasiPengajuanForCabang(q, page, limit, "ALL", "ALL", userIdParam),
      getActivePacUsers(),
      getPengajuanBerkasStats(userIdParam),
    ]);
    pengajuanData = result;
    pacUsers = users;
    stats = statsResult;
  } else if (isPAC) {
    const [result, statsResult] = await Promise.all([
      getPengajuanBerkass(q, page, limit),
      getPengajuanBerkasStats(),
    ]);
    pengajuanData = result;
    stats = statsResult;
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PengajuanBerkasStats stats={stats} userId={userIdParam} />
      <PengajuanBerkasList
        pengajuanList={pengajuanData.data}
        userRole={userRole || "SEKRETARIS_PAC"}
        pacUsers={pacUsers}
        totalPages={pengajuanData.totalPages}
        currentPage={page}
        totalItems={pengajuanData.total}
      />
    </div>
  );
}
