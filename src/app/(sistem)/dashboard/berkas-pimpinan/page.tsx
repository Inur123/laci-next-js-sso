import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getBerkasPimpinans } from "@/app/actions/berkas-pimpinan-actions";
import { BerkasPimpinanList } from "@/components/features/berkas-pimpinan/berkas-pimpinan-list";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import prisma from "@/lib/prisma";

export const metadata = {
  title: "Berkas Pimpinan | Laci Digital",
};

import { Suspense } from "react";
import { BerkasPimpinanSkeleton } from "@/components/features/berkas-pimpinan/berkas-pimpinan-skeleton";

export default async function BerkasPimpinanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <Suspense fallback={<BerkasPimpinanSkeleton />}>
      <BerkasPimpinanPageContent searchParams={searchParams} userId={session.user.id} />
    </Suspense>
  );
}

async function BerkasPimpinanPageContent({
  searchParams,
  userId,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  userId: string;
}) {
  const params = await searchParams;
  const q = (params.q as string) || "";
  const page = Number(params.page) || 1;
  const limit = 10;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const isCabang = user?.role === "SEKRETARIS_CABANG";
  const title = isCabang ? "Berkas Cabang" : "Berkas PAC";

  const periodeAktif = await prisma.periode.findFirst({
    where: { userId: userId, isActive: true },
  });

  const {
    data: berkasList,
    totalPages,
    total: totalItems,
  } = await getBerkasPimpinans(q, page, limit);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
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
              user?.role === "SEKRETARIS_CABANG"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <Link href="/dashboard/berkas-pimpinan/add">
              <Plus className="w-4 h-4 mr-2" />
              Tambah Berkas
            </Link>
          </Button>
        )}
      </div>

      {!periodeAktif ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Silakan aktifkan periode terlebih dahulu.
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
        <BerkasPimpinanList
          berkasList={berkasList}
          userRole={user?.role || "SEKRETARIS_PAC"}
          totalPages={totalPages}
          currentPage={page}
          totalItems={totalItems}
        />
      )}
    </div>
  );
}
