import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getPengajuanBerkasDetailForReferensi } from "@/app/actions/pengajuan-berkas-actions";
import { ReferensiPengajuanDetail } from "@/components/features/referensi-pengajuan/referensi-detail";

export const metadata = {
  title: "Detail Referensi Pengajuan",
};

async function ReferensiDetailContent({
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

  if (user?.role !== "SEKRETARIS_PAC") redirect("/dashboard");

  const { id } = await params;
  const pengajuan = await getPengajuanBerkasDetailForReferensi(id);

  if (!pengajuan) notFound();

  return <ReferensiPengajuanDetail pengajuan={pengajuan} />;
}

export default async function ReferensiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  return (
    <ReferensiDetailContent params={params} sessionId={session.user.id} />
  );
}
