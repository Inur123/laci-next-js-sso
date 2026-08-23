import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AddPeriodeForm } from "@/components/features/periode/add-periode-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PeriodeFormSkeleton } from "@/components/features/periode/periode-skeleton";

export default function AddPeriodePage() {
  return (
    <Suspense fallback={<PeriodeFormSkeleton />}>
      <AddPeriodeContent />
    </Suspense>
  );
}

async function AddPeriodeContent() {
  const session = await auth();
  if (!session?.user) redirect("/");

  return (
    <div className="max-w-xl space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/periode">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Tambah Periode Baru</h2>
          <p className="text-sm text-muted-foreground">
            Buat periode baru untuk mengelompokkan data masa khidmat Anda.
          </p>
        </div>
      </div>
      <AddPeriodeForm userRole={session.user.role} />
    </div>
  );
}
