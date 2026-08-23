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
import { getApplicationActivePeriod } from "@/lib/application-context";
import { auth } from "@/auth";
import { AnggotaClientWrapper } from "@/components/features/anggota/anggota-client-wrapper";

export const metadata: Metadata = {
  title: "Data Anggota | Laci Digital",
};

type SearchParams = Promise<{ q?: string; page?: string; userId?: string; sortKey?: string; sortDir?: string; status?: "PENDING" | "DITERIMA" | "DITOLAK" }>;

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
  const periodeAktif = userId ? await getApplicationActivePeriod() : null;

  const session = await auth();
  const userRole = session?.user?.role;
  const { q, page, userId: searchUserId, sortKey, sortDir } = await searchParams;
  const currentPage = Number(page) || 1;
  const sKey = (sortKey as string) || "namaLengkap";
  const sDir = (sortDir as "asc" | "desc") || "asc";
  
  // Ambil data untuk initial render (PENDING sebagai default awal agar bisa dimonitor)
  const [{ data, total, totalPages }, activeUsers, stats] = await Promise.all([
    getAnggotaList(q, currentPage, 10, searchUserId, undefined, sKey, sDir, "PENDING"),
    getActiveUsers(),
    getAnggotaStats(userId),
  ]);

  return (
    <AnggotaClientWrapper
      periodeAktif={periodeAktif}
      userRole={userRole}
      userId={userId}
      stats={stats}
      initialData={{ data, total, totalPages }}
      activeUsers={activeUsers}
    />
  );
}
