import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BerkasPimpinanForm } from "@/components/features/berkas-pimpinan/berkas-pimpinan-form";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import prisma from "@/lib/prisma";

import { BerkasPimpinanFormSkeleton } from "@/components/features/berkas-pimpinan/berkas-pimpinan-skeleton";
import { Suspense } from "react";

export default async function AddBerkasPimpinanPage() {
  return (
    <Suspense fallback={<BerkasPimpinanFormSkeleton />}>
      <AddBerkasPimpinanContent />
    </Suspense>
  );
}

async function AddBerkasPimpinanContent() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const isCabang = user?.role === "SEKRETARIS_CABANG";
  const label = isCabang ? "Berkas Cabang" : "Berkas PAC";

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/berkas-pimpinan">
            <ChevronLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Tambah {label}</h2>
          <p className="text-sm text-muted-foreground">
            Lengkapi formulir di bawah untuk menambahkan berkas baru.
          </p>
        </div>
      </div>

      <BerkasPimpinanForm userRole={session.user.role} />
    </div>
  );
}
