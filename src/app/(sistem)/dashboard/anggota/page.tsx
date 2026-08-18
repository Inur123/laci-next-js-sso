import {
  getAnggotaList,
  getActiveUsers,
  getAnggotaStats,
} from "@/app/actions/anggota-actions";
import { AnggotaList } from "@/components/features/anggota/anggota-list";
import { AnggotaStats } from "@/components/features/anggota/anggota-stats";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";
import { Suspense } from "react";
import { AnggotaSkeleton } from "@/components/features/anggota/anggota-skeleton";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { CopyMemberDialog } from "@/components/features/anggota/copy-member-dialog";

export const metadata: Metadata = {
  title: "Data Anggota | Laci Digital",
};

type SearchParams = Promise<{ q?: string; page?: string; userId?: string; sortKey?: string; sortDir?: string }>;

export default async function AnggotaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  return (
    <Suspense fallback={<AnggotaSkeleton />}>
      <AnggotaPageContent
        searchParams={searchParams}
        userId={session?.user?.id}
      />
    </Suspense>
  );
}

async function AnggotaPageContent({
  searchParams,
  userId,
}: {
  searchParams: SearchParams;
  userId?: string;
}) {
  const periodeAktif = userId
    ? await prisma.periode.findFirst({
        where: {
          userId: userId,
          isActive: true,
        },
      })
    : null;

  const session = await auth();
  const userRole = session?.user?.role;

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
            <CopyMemberDialog userRole={userRole || "SEKRETARIS_PAC"} />
            <Button
              asChild
              className={`w-full sm:w-auto text-white shadow-md hover:shadow-xl transition-all duration-200 ${
                userRole === "SEKRETARIS_CABANG"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              <Link href="/dashboard/anggota/add">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Anggota
              </Link>
            </Button>
          </div>
        )}
      </div>

      {!periodeAktif ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Silakan aktifkan periode terlebih dahulu untuk mengelola data data
            anggota.
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
        <AnggotaContent searchParams={searchParams} userRole={userRole} />
      )}
    </div>
  );
}

async function AnggotaContent({
  searchParams,
  userRole,
}: {
  searchParams: SearchParams;
  userRole?: string;
}) {
  const { q, page, userId, sortKey, sortDir } = await searchParams;
  const currentPage = Number(page) || 1;
  const sKey = (sortKey as string) || "namaLengkap";
  const sDir = (sortDir as "asc" | "desc") || "asc";
  const [{ data, total, totalPages }, activeUsers, stats] = await Promise.all([
    getAnggotaList(q, currentPage, 10, userId, undefined, sKey, sDir),
    getActiveUsers(),
    getAnggotaStats(userId),
  ]);

  return (
    <div className="space-y-6">
      <AnggotaStats stats={stats} userId={userId} />
      <AnggotaList
        anggotaList={data}
        userRole={userRole || "SEKRETARIS_PAC"}
        totalPages={totalPages}
        currentPage={currentPage}
        totalItems={total}
        activeUsers={activeUsers}
        initialSearchTerm={q || ""}
        initialSelectedUser={userId || "ALL"}
        initialSortKey={sKey}
        initialSortDir={sDir}
      />
    </div>
  );
}
