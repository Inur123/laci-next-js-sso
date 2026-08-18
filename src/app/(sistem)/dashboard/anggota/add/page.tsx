import { AnggotaForm } from "@/components/features/anggota/anggota-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";
import { Suspense } from "react";
import { AnggotaFormSkeleton } from "@/components/features/anggota/anggota-skeleton";

export const metadata: Metadata = {
  title: "Tambah Anggota",
};

export default async function AddAnggotaPage() {
  return (
    <Suspense fallback={<AnggotaFormSkeleton />}>
      <AddAnggotaContent />
    </Suspense>
  );
}

import { auth } from "@/auth";

async function AddAnggotaContent() {
  const session = await auth();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/anggota">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>

        <div>
          <h2 className="text-xl font-semibold">Tambah Anggota</h2>
          <p className="text-sm text-muted-foreground">
            Tambahkan anggota baru ke database organisasi
          </p>
        </div>
      </div>

      <AnggotaForm userRole={session?.user?.role} />
    </div>
  );
}
