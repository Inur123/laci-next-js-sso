import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBerkasSPById } from "@/app/actions/berkas-sp-actions";
import { auth } from "@/auth";
import { BerkasSPDetail } from "@/components/features/berkas-sp/berkas-sp-detail";

export const metadata: Metadata = {
  title: "Detail Berkas SP | Laci Digital",
};

import { BerkasSPDetailSkeleton } from "@/components/features/berkas-sp/berkas-sp-skeleton";
import { Suspense } from "react";

async function getBerkasSP(id: string) {
  return getBerkasSPById(id);
}

export default async function BerkasSPDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<BerkasSPDetailSkeleton />}>
      <BerkasSPDetailContent params={params} />
    </Suspense>
  );
}

async function BerkasSPDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) return null;

  const { id } = await params;
  const berkas = await getBerkasSP(id);

  if (!berkas) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <BerkasSPDetail berkasSP={berkas as any} />
    </div>
  );
}
