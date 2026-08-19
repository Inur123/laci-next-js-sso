import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BerkasSPForm } from "@/components/features/berkas-sp/berkas-sp-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";

import { BerkasSPFormSkeleton } from "@/components/features/berkas-sp/berkas-sp-skeleton";
import { Suspense } from "react";

export default async function AddBerkasSPPage() {
  return (
    <Suspense fallback={<BerkasSPFormSkeleton />}>
      <AddBerkasSPContent />
    </Suspense>
  );
}

async function AddBerkasSPContent() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  // Role Check
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "SEKRETARIS_CABANG") {
    redirect("/dashboard/arsip/surat");
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/berkas-sp">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Tambah Berkas SP</h2>
          <p className="text-sm text-muted-foreground">
            Formulir penambahan berkas Surat Pengesahan (SP)
          </p>
        </div>
      </div>
      <BerkasSPForm userRole={session.user.role} />
    </div>
  );
}
