import { auth } from "@/auth";
import HomeClient from "@/components/features/home/home-client";
import { getPublicStats } from "@/app/actions/dashboard-actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();

  //  Use cached stats
  const { anggotaCount, suratCount } = await getPublicStats();

  return (
    <HomeClient
      session={session}
      stats={{
        anggotaTerdaftar: anggotaCount,
        suratDiproses: suratCount,
      }}
    />
  );
}

/**
 *  OPTIONAL: Manual cache revalidation function
 *
 * Usage in server action:
 * import { revalidateTag } from 'next/cache';
 * revalidateTag('public-stats');
 */
