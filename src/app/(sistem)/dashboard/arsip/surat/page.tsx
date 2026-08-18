import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getArsipStats, getArsipSurats } from "@/app/actions/arsip-actions";
import { ArsipSuratList } from "@/components/features/arsip/arsip-surat-list";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { ArsipStats } from "@/components/features/arsip/arsip-stats";
import { Suspense } from "react";
import { ArsipSkeleton } from "@/components/features/arsip/arsip-skeleton";
import { DecryptedArsipSurat } from "@/types";

export const metadata = {
  title: "Arsip Surat | Laci Digital",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function ArsipSuratPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <Suspense fallback={<ArsipSkeleton />}>
      <ArsipPageContent searchParams={searchParams} userId={session.user.id} />
    </Suspense>
  );
}

async function ArsipPageContent({
  searchParams,
  userId,
}: {
  searchParams: SearchParams;
  userId: string;
}) {
  const session = await auth();
  const userRole = session?.user?.role;

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
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Arsip Surat</h2>
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
            className={`w-full sm:w-auto text-white shadow-md hover:shadow-xl transition-all duration-200 ${
              userRole === "SEKRETARIS_CABANG"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <Link href="/dashboard/arsip/surat/add">
              <Plus className="w-4 h-4 mr-2" />
              Tambah Arsip
            </Link>
          </Button>
        )}
      </div>

      {!periodeAktif ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Silakan aktifkan periode terlebih dahulu untuk mengelola arsip
            surat.
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
        <ArsipContent searchParams={searchParams} />
      )}
    </div>
  );
}

// Separate component for data fetching
async function ArsipContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (params.q as string) || "";
  const org = (params.org as string) || "ALL";
  const jenis = (params.jenis as string) || "ALL";
  const page = Number(params.page) || 1;
  const limit = 10;

  // Parallel data fetching for speed
  const [stats, arsipData, user] = await Promise.all([
    getArsipStats(),
    getArsipSurats(query, org, jenis, page, limit),
    auth().then((s) =>
      s?.user?.id
        ? prisma.user.findUnique({
            where: { id: s.user.id },
            select: { role: true },
          })
        : null,
    ),
  ]);

  return (
    <div className="space-y-4">
      {stats && <ArsipStats stats={stats} />}
      <ArsipSuratList
        arsipSurats={arsipData.data as DecryptedArsipSurat[]}
        userRole={user?.role || "SEKRETARIS_PAC"}
        totalPages={arsipData.totalPages}
        currentPage={page}
        totalItems={arsipData.total}
      />
    </div>
  );
}
