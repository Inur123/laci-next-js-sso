import { PresensiForm } from "@/components/features/presensi/presensi-form";
import { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PresensiFormSkeleton } from "@/components/features/presensi/presensi-skeleton";

export const metadata: Metadata = {
  title: "Buat Presensi Baru",
};

export default async function AddPresensiPage() {
  return (
    <Suspense fallback={<PresensiFormSkeleton />}>
      <AddPresensiContent />
    </Suspense>
  );
}

async function AddPresensiContent() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/presensi">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>

        <div>
          <h2 className="text-xl font-semibold">Buat Presensi</h2>
          <p className="text-sm text-muted-foreground">
            Silakan isi formulir di bawah untuk membuat sesi absensi baru.
          </p>
        </div>
      </div>

      <PresensiForm userRole={session?.user?.role ?? "SEKRETARIS_PAC"} />
    </div>
  );
}
