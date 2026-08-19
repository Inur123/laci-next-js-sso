import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PengajuanBerkasForm } from "@/components/features/pengajuan-berkas/pengajuan-berkas-form";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { PengajuanBerkasFormSkeleton } from "@/components/features/pengajuan-berkas/pengajuan-berkas-skeleton";
import { Suspense } from "react";

export default async function AddPengajuanBerkasPage() {
  return (
    <Suspense fallback={<PengajuanBerkasFormSkeleton />}>
      <AddPengajuanBerkasContent />
    </Suspense>
  );
}

async function AddPengajuanBerkasContent() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "SEKRETARIS_PAC") {
    redirect("/dashboard");
  }

  const periodeAktif = await prisma.periode.findFirst({
    where: { userId: session.user.id, isActive: true },
  });

  if (!periodeAktif) {
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
          <h2 className="text-xl font-semibold">Buat Pengajuan Surat</h2>
          <p className="text-sm text-muted-foreground">
            Formulir pengajuan surat ke Sekretaris Cabang
          </p>
        </div>
      </div>

      <PengajuanBerkasForm userRole={user?.role} />
    </div>
  );
}
