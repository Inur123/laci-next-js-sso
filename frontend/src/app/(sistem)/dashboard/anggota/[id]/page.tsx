import { getAnggotaById } from "@/app/actions/anggota-actions";
import AnggotaDetailClient from "@/components/features/anggota/anggota-detail-client";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { Suspense } from "react";
import { AnggotaDetailSkeleton } from "@/components/features/anggota/anggota-skeleton";
import { auth } from "@/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const anggota = await getAnggotaById(id);
  return {
    title: anggota
      ? `Detail: ${anggota.namaLengkap}`
      : "Anggota Tidak Ditemukan",
  };
}

export default async function AnggotaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<AnggotaDetailSkeleton />}>
      <AnggotaDetailContent params={params} />
    </Suspense>
  );
}

async function AnggotaDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [anggota, session] = await Promise.all([getAnggotaById(id), auth()]);

  if (!anggota) {
    return notFound();
  }

  return (
    <AnggotaDetailClient
      anggota={anggota}
      userRole={session?.user?.role || "SEKRETARIS_PAC"}
    />
  );
}
