import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getBerkasSPs,
  getBerkasSPStats,
} from "@/app/actions/berkas-sp-actions";
import { BerkasSPList } from "@/components/features/berkas-sp/berkas-sp-list";
import { BerkasSPStats } from "@/components/features/berkas-sp/berkas-sp-stats";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getApplicationActivePeriod } from "@/lib/application-context";
import { Suspense } from "react";

import { BerkasSPSkeleton } from "@/components/features/berkas-sp/berkas-sp-skeleton";

export const metadata = {
  title: "Berkas SP | Laci Digital",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function BerkasSPPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  // Check role
  const userRole = session.user;

  if (userRole?.role !== "SEKRETARIS_CABANG") {
    redirect("/dashboard/arsip/surat");
  }

  return (
    <Suspense fallback={<BerkasSPSkeleton />}>
      <BerkasSPPageContent
        searchParams={searchParams}
        userId={session.user.id}
        userRole={userRole?.role || "SEKRETARIS_CABANG"}
      />
    </Suspense>
  );
}

async function BerkasSPPageContent({
  searchParams,
  userId,
  userRole,
}: {
  searchParams: SearchParams;
  userId: string;
  userRole: string;
}) {
  const periodeAktif = await getApplicationActivePeriod();

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Berkas SP</h2>
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
            <Link href="/dashboard/berkas-sp/add">
              <Plus className="w-4 h-4 mr-2" />
              Tambah Berkas
            </Link>
          </Button>
        )}
      </div>

      {!periodeAktif ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Silakan aktifkan periode terlebih dahulu untuk mengelola berkas SP.
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
        <BerkasSPContent searchParams={searchParams} />
      )}
    </div>
  );
}

async function BerkasSPContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = (params.q as string) || "";
  const org = (params.org as string) || "ALL";
  const page = Number(params.page) || 1;
  const limit = 10;

  const session = await auth();
  const [result, stats, user] = await Promise.all([
    getBerkasSPs(q, org, page, limit),
    getBerkasSPStats(),
    Promise.resolve(session?.user || null),
  ]);

  return (
    <div className="space-y-4">
      <BerkasSPStats stats={stats} />
      <BerkasSPList
        berkasSPList={result.data}
        userRole={user?.role || "SEKRETARIS_CABANG"}
        totalPages={result.totalPages}
        currentPage={page}
        totalItems={result.total}
      />
    </div>
  );
}
