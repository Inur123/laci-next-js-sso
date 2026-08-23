import { getArsipSuratById } from "@/app/actions/arsip-actions";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { ArsipSuratDetail } from "@/components/features/arsip/arsip-surat-detail";
import { ArsipDetailSkeleton } from "@/components/features/arsip/arsip-skeleton";
import { Suspense } from "react";

export default async function DetailArsipSuratPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ArsipDetailSkeleton />}>
      <DetailArsipSuratContent params={params} />
    </Suspense>
  );
}

async function DetailArsipSuratContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/");

  const arsipSurat = await getArsipSuratById(id);

  if (!arsipSurat) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <ArsipSuratDetail arsipSurat={arsipSurat} />
    </div>
  );
}
