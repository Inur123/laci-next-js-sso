import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getPersonalLogs,
  getGlobalLogs,
  getLogStats,
  getGlobalLogStats,
  getLogMonitoringData,
} from "@/app/actions/log-activity-actions";
import { LogActivityClient } from "@/components/features/log-activity/log-activity-client";
import { getApplicationActivePeriod, getApplicationUsers } from "@/lib/application-context";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { LogActivitySkeleton } from "@/components/features/log-activity/log-activity-skeleton";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Riwayat Aktivitas | Laci Digital",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function LogActivityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const role = session.user.role;

  return (
    <Suspense fallback={<LogActivitySkeleton userRole={role} />}>
      <LogActivityPageContent 
        userId={session.user.id} 
        role={role} 
        searchParams={searchParams}
      />
    </Suspense>
  );
}

async function LogActivityPageContent({
  userId,
  role,
  searchParams,
}: {
  userId: string;
  role: string;
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filteredUserId = (params.userId as string) || "ALL";

  // Check active period
  const periodeAktif = await getApplicationActivePeriod();

  const isCabang = role === "SEKRETARIS_CABANG";

  if (!periodeAktif) {
    return (
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Header - Mimicking LogActivityHeader but static for no-period state */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
              <History size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Riwayat Aktivitas
              </h2>
              <p className="text-sm text-slate-500">
                Tidak ada periode aktif
              </p>
            </div>
          </div>
        </div>

        {/* Empty State Style (Matching AnggotaPage) */}
        <div className="rounded-lg border border-dashed p-8 text-center bg-white/50">
          <p className="text-slate-500">
            Silakan aktifkan periode terlebih dahulu untuk melihat riwayat aktivitas.
          </p>
          <Button
            asChild
            className={`mt-4 text-white shadow-md hover:shadow-xl transition-all duration-200 ${
              isCabang
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <Link href="/dashboard/periode">Kelola Periode</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Pre-fetch initial data
  const [personalLogs, globalLogs, personalStats, globalStats, monitoringData] =
    await Promise.all([
      periodeAktif
        ? getPersonalLogs({}, 1, 20)
        : Promise.resolve({ data: [], total: 0, totalPages: 0 }),
      isCabang
        ? getGlobalLogs({ userId: filteredUserId }, 1, 20)
        : Promise.resolve({ data: [], total: 0, totalPages: 0 }),
      getLogStats(),
      isCabang ? getGlobalLogStats(filteredUserId) : Promise.resolve(null),
      isCabang ? getLogMonitoringData(filteredUserId) : Promise.resolve(null),
    ]);

  // Fetch PAC users for filter (only for Cabang)
  const pacUsers = isCabang ? await getApplicationUsers() : [];

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <LogActivityClient
        initialPersonalLogs={personalLogs}
        initialGlobalLogs={globalLogs}
        personalStats={personalStats}
        globalStats={globalStats}
        monitoringData={monitoringData}
        userRole={role}
        pacUsers={pacUsers}
      />
    </div>
  );
}
