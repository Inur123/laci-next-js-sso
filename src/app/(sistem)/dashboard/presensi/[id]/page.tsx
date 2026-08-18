import { getPresensiDetail } from "@/app/actions/presensi-actions";
import { PresensiDetail } from "@/components/features/presensi/presensi-detail";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import { auth } from "@/auth";
import { Suspense } from "react";
import { PresensiDetailSkeleton } from "@/components/features/presensi/presensi-skeleton";

export const metadata: Metadata = {
  title: "Detail Presensi",
};

export default async function PresensiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PresensiDetailSkeleton />}>
      <PresensiDetailContent params={params} />
    </Suspense>
  );
}

async function PresensiDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, session] = await Promise.all([getPresensiDetail(id), auth()]);

  if (!session) redirect("/login");

  if (!data) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PresensiDetail
        presensi={data}
        userRole={session?.user?.role ?? "SEKRETARIS_PAC"}
      />
    </div>
  );
}
