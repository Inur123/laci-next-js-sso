import { auth } from "@/auth";
import { getWilayahList } from "@/app/actions/wilayah-actions";
import { WilayahList } from "@/components/features/wilayah/wilayah-list";
import { WilayahSkeleton } from "@/components/features/wilayah/wilayah-skeleton";
import { Suspense } from "react";
import { MapPin } from "lucide-react";

export const metadata = {
  title: "Data PK | Laci Digital",
};

export default async function PKPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const session = await auth();
  const isCabang = session?.user?.role === "SEKRETARIS_CABANG";

  return (
    <Suspense fallback={<WilayahSkeleton isCabang={isCabang} />}>
      <PKContent searchParams={searchParams} isCabang={isCabang} />
    </Suspense>
  );
}

async function PKContent({
  searchParams,
  isCabang,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
  isCabang: boolean;
}) {
  
  const params = await searchParams;
  const q = params.q || "";
  const page = Number(params.page) || 1;
  const limit = 10;
  const userIdFilter = params.userId || "ALL";

  const wilayahData = await getWilayahList(
    "PK",
    q,
    page,
    limit,
    userIdFilter
  );

  return (
    <div className="h-full">

      <div className="flex-1 min-h-0">
        <WilayahList
          initialData={wilayahData.data}
          totalPages={wilayahData.totalPages}
          currentPage={page}
          totalItems={wilayahData.total}
          isCabang={isCabang}
          jenis="PK"
        />
      </div>
    </div>
  );
}
