import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getPengajuanBerkasDetailForReferensi } from "@/app/actions/pengajuan-berkas-actions";
import { ReferensiPengajuanDetail } from "@/components/features/referensi-pengajuan/referensi-detail";

export const metadata = {
  title: "Detail Referensi Pengajuan",
};

async function ReferensiDetailContent({
  params,
  userRole,
}: {
  params: Promise<{ id: string }>;
  userRole: string;
}) {
  if (userRole !== "SEKRETARIS_PAC") redirect("/dashboard");

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
    <ReferensiDetailContent params={params} userRole={session.user.role} />
  );
}
