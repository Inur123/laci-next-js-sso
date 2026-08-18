import { getPresensiList } from "@/app/actions/presensi-actions";
import { PresensiList } from "@/components/features/presensi/presensi-list";
import { Metadata } from "next";
import { QrCode, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { auth } from "@/auth";
import { cn } from "@/lib/utils";
import prisma from "@/lib/prisma";
import { Suspense } from "react";
import { PresensiListSkeleton } from "@/components/features/presensi/presensi-skeleton";

export const metadata: Metadata = {
  title: "Presensi Kegiatan",
};

export default async function PresensiPage() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <Suspense fallback={<PresensiListSkeleton />}>
      <PresensiPageContent userId={session.user.id} userRole={session.user.role} />
    </Suspense>
  );
}

async function PresensiPageContent({
  userId,
  userRole,
}: {
  userId: string;
  userRole?: string;
}) {
  const [result, periodeAktif] = await Promise.all([
    getPresensiList(),
    prisma.periode.findFirst({
      where: {
        userId: userId,
        isActive: true,
      },
    }),
  ]);

  const isCabang = userRole === "SEKRETARIS_CABANG";

  return (
    <div className="flex flex-col gap-4 sm:gap-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
            <QrCode size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Presensi Kegiatan</h2>
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
            className={cn(
              "w-full sm:w-auto text-white shadow-md hover:shadow-xl transition-all duration-200",
              isCabang ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700",
            )}
          >
            <Link href="/dashboard/presensi/add">
              <Plus className="w-4 h-4 mr-2" />
              Buat Presensi Baru
            </Link>
          </Button>
        )}
      </div>

      {!periodeAktif ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Silakan aktifkan periode terlebih dahulu untuk mengelola presensi.
          </p>
          <Button
            asChild
            className={cn(
              "mt-4 text-white shadow-md hover:shadow-xl transition-all duration-200",
              isCabang ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700",
            )}
          >
            <Link href="/dashboard/periode">Kelola Periode</Link>
          </Button>
        </div>
      ) : (
        <PresensiList
          data={result.data}
          totalPages={result.totalPages}
          totalItems={result.total}
          userRole={userRole ?? "SEKRETARIS_PAC"}
        />
      )}
    </div>
  );
}


