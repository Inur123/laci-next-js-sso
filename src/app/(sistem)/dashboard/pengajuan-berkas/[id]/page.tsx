import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getPengajuanBerkasDetail } from "@/app/actions/pengajuan-berkas-actions";
import { PengajuanBerkasDetail } from "@/components/features/pengajuan-berkas/pengajuan-berkas-detail";
import prisma from "@/lib/prisma";
import { Suspense } from "react";
import { PengajuanBerkasDetailSkeleton } from "@/components/features/pengajuan-berkas/pengajuan-berkas-skeleton";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DetailPengajuanBerkasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const isCabang = session.user.role === "SEKRETARIS_CABANG";

  return (
    <Suspense fallback={<PengajuanBerkasDetailSkeleton isCabang={isCabang} />}>
      <PengajuanBerkasContent params={params} sessionId={session.user.id} />
    </Suspense>
  );
}

async function PengajuanBerkasContent({
  params,
  sessionId,
}: {
  params: Promise<{ id: string }>;
  sessionId: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: sessionId },
    select: { role: true },
  });

  const { id } = await params;
  const pengajuan = await getPengajuanBerkasDetail(id);

  if (!pengajuan) notFound();

  const isCabang = user?.role === "SEKRETARIS_CABANG";

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/pengajuan-berkas">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Detail Pengajuan Surat</h2>
          <p className="text-sm text-muted-foreground">
            Detail informasi pengajuan surat
          </p>
        </div>
      </div>

      <PengajuanBerkasDetail pengajuan={pengajuan} isCabang={isCabang} />
    </div>
  );
}
