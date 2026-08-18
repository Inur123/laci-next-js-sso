import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getBerkasSPById } from "@/app/actions/berkas-sp-actions";
import { BerkasSPForm } from "@/components/features/berkas-sp/berkas-sp-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { BerkasSPFormSkeleton } from "@/components/features/berkas-sp/berkas-sp-skeleton";
import { Suspense } from "react";

export default async function EditBerkasSPPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<BerkasSPFormSkeleton />}>
      <EditBerkasSPContent params={params} />
    </Suspense>
  );
}

async function EditBerkasSPContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Role Check
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "SEKRETARIS_CABANG") {
    redirect("/dashboard/arsip/surat");
  }

  const { id } = await params;
  const berkas = await getBerkasSPById(id);

  if (!berkas) {
    notFound();
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
          <h2 className="text-xl font-semibold">Edit Berkas SP</h2>
          <p className="text-sm text-muted-foreground">
            Formulir perubahan data berkas SP
          </p>
        </div>
      </div>

      <BerkasSPForm berkasSP={berkas} userRole={session.user.role} />
    </div>
  );
}
