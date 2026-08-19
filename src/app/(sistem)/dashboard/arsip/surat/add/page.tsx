import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ArsipSuratForm } from "@/components/features/arsip/arsip-surat-form";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import prisma from "@/lib/prisma";

import { ArsipFormSkeleton } from "@/components/features/arsip/arsip-skeleton";
import { Suspense } from "react";

export default async function AddArsipSuratPage() {
  return (
    <Suspense fallback={<ArsipFormSkeleton />}>
      <AddArsipSuratContent />
    </Suspense>
  );
}

async function AddArsipSuratContent() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  // Check if user has active periode
  const periodeAktif = await prisma.periode.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
  });

  if (!periodeAktif) {
    redirect("/dashboard/arsip/surat");
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/arsip/surat">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>

        <div>
          <h2 className="text-xl font-semibold">Tambah Arsip Surat</h2>
          <p className="text-sm text-muted-foreground">
            Tambahkan arsip surat baru ke periode {periodeAktif.nama}
          </p>
        </div>
      </div>

      <ArsipSuratForm userRole={session.user.role} />
    </div>
  );
}
