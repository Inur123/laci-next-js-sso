import { getPeriode } from "@/app/actions/periode-actions";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { EditPeriodeForm } from "@/components/features/periode/edit-periode-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PeriodeFormSkeleton } from "@/components/features/periode/periode-skeleton";

export default function EditPeriodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PeriodeFormSkeleton />}>
      <EditPeriodeContent params={params} />
    </Suspense>
  );
}

async function EditPeriodeContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const periode = await getPeriode(id);

  if (!periode) {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/periode">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Edit Periode</h2>
          <p className="text-sm text-muted-foreground">
            Perbarui informasi periode masa khidmat: {periode.nama}
          </p>
        </div>
      </div>
      <EditPeriodeForm periode={periode} userRole={session.user.role} />
    </div>
  );
}
