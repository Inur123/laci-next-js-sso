import { auth } from "@/auth";
import { KegiatanForm } from "@/components/features/agenda-kegiatan/kegiatan-form";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Suspense } from "react";
import { KegiatanFormSkeleton } from "@/components/features/agenda-kegiatan/kegiatan-skeleton";

export const metadata = {
  title: "Tambah Kegiatan | Laci Digital",
};

export default async function AddKegiatanPage() {
  return (
    <Suspense fallback={<KegiatanFormSkeleton />}>
      <AddKegiatanContent />
    </Suspense>
  );
}

async function AddKegiatanContent() {
  const session = await auth();

  if (!session) redirect("/");

  if (session.user.role !== "SEKRETARIS_CABANG") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/agenda-kegiatan">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>

        <div>
          <h2 className="text-xl font-semibold">Tambah Kegiatan</h2>
          <p className="text-sm text-muted-foreground">
            Jadwalkan kegiatan atau acara baru organisasi.
          </p>
        </div>
      </div>

      <KegiatanForm userRole={session.user.role} />
    </div>
  );
}
