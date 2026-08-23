import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getArsipSuratById } from "@/app/actions/arsip-actions";
import { ArsipSuratForm } from "@/components/features/arsip/arsip-surat-form";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArsipFormSkeleton } from "@/components/features/arsip/arsip-skeleton";
import { Suspense } from "react";

export default async function EditArsipSuratPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ArsipFormSkeleton />}>
      <EditArsipSuratContent params={params} />
    </Suspense>
  );
}

async function EditArsipSuratContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const { id } = await params;
  const arsipSurat = await getArsipSuratById(id);

  if (!arsipSurat) {
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
          <h2 className="text-xl font-semibold">Edit Arsip Surat</h2>
          <p className="text-sm text-muted-foreground">
            Edit data arsip surat {arsipSurat.noSurat}
          </p>
        </div>
      </div>

      <ArsipSuratForm arsipSurat={arsipSurat} userRole={session.user.role} />
    </div>
  );
}
