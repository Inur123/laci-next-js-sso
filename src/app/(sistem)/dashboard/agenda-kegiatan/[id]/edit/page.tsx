import { auth } from "@/auth";
import { getKegiatanById } from "@/app/actions/agenda-kegiatan-actions";
import { KegiatanForm } from "@/components/features/agenda-kegiatan/kegiatan-form";
import { redirect, notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Suspense } from "react";
import { KegiatanFormSkeleton } from "@/components/features/agenda-kegiatan/kegiatan-skeleton";

export const metadata = {
  title: "Edit Kegiatan | Laci Digital",
};

export default async function EditKegiatanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<KegiatanFormSkeleton />}>
      <EditKegiatanContent params={params} />
    </Suspense>
  );
}

async function EditKegiatanContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session) redirect("/login");

  if (session.user.role !== "SEKRETARIS_CABANG") {
    redirect("/dashboard");
  }

  const id = (await params).id;
  const kegiatan = await getKegiatanById(id);

  if (!kegiatan) notFound();

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/agenda-kegiatan">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>

        <div>
          <h2 className="text-xl font-semibold">Edit Kegiatan</h2>
          <p className="text-sm text-muted-foreground">
            Perbarui informasi kegiatan acara.
          </p>
        </div>
      </div>

      <KegiatanForm kegiatan={kegiatan} userRole={session.user.role} />
    </div>
  );
}
