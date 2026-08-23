import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getPengajuanBerkasById } from "@/app/actions/pengajuan-berkas-actions";
import { PengajuanBerkasForm } from "@/components/features/pengajuan-berkas/pengajuan-berkas-form";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PengajuanBerkasFormSkeleton } from "@/components/features/pengajuan-berkas/pengajuan-berkas-skeleton";
import { Suspense } from "react";

export default async function EditPengajuanBerkasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PengajuanBerkasFormSkeleton />}>
      <EditPengajuanBerkasContent params={params} />
    </Suspense>
  );
}

async function EditPengajuanBerkasContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  if (session.user.role !== "SEKRETARIS_PAC") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const pengajuan = await getPengajuanBerkasById(id);

  if (!pengajuan) notFound();

  if (pengajuan.status !== "PENDING") {
    redirect("/dashboard/pengajuan-berkas");
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/pengajuan-berkas">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Edit Pengajuan Surat</h2>
          <p className="text-sm text-muted-foreground">
            Perbarui pengajuan surat (hanya untuk status PENDING)
          </p>
        </div>
      </div>

      <PengajuanBerkasForm pengajuan={pengajuan} userRole={session.user.role} />
    </div>
  );
}
