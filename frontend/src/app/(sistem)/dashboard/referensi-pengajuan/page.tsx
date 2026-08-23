import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getPengajuanForReferensiPac,
  getActivePacUsersForReferensi,
} from "@/app/actions/pengajuan-berkas-actions";
import { ReferensiPengajuanList } from "@/components/features/referensi-pengajuan/referensi-list";
import { ReferensiSkeleton } from "@/components/features/referensi-pengajuan/referensi-skeleton";
import { FileText } from "lucide-react";
import { Suspense } from "react";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export const metadata = {
  title: "Referensi Pengajuan | Laci Digital",
};

export default async function ReferensiPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  if (session.user.role !== "SEKRETARIS_PAC") redirect("/dashboard");

  return (
    <Suspense fallback={<ReferensiSkeleton />}>
      <ReferensiContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReferensiContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = (params.q as string) || "";
  const page = Number(params.page) || 1;
  const limit = 10;

  const sortKey = (params.sortKey as string) || "tanggal";
  const sortDir = (params.sortDir as "asc" | "desc") || "desc";
  const userIdParam = (params.userId as string) || "ALL";

  const [result, users] = await Promise.all([
    getPengajuanForReferensiPac(q, page, limit, "ALL", "ALL", userIdParam, sortKey, sortDir),
    getActivePacUsersForReferensi(),
  ]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Referensi Pengajuan</h2>
            <p className="text-sm text-muted-foreground">
              Lihat daftar pengajuan dari semua PAC untuk referensi
            </p>
          </div>
        </div>
      </div>

      <ReferensiPengajuanList
        pengajuanList={result.data}
        pacUsers={users}
        totalPages={result.totalPages}
        currentPage={page}
        totalItems={result.total}
      />
    </div>
  );
}
