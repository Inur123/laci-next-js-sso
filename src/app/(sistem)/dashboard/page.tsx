import { getDashboardStats } from "@/app/actions/dashboard-actions";
import DashboardClient from "@/components/features/dashboard/dashboard-client";

import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/features/dashboard/dashboard-skeleton";
import { cookies } from "next/headers";

export default async function DashboardPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const stats = await getDashboardStats();

  // Cek login via cookie (untuk email) atau search param (untuk google)
  const cookieStore = await cookies();
  const hasLoginCookie = cookieStore.get("login_success")?.value === "true";
  const hasLoginParam = searchParams.login === "success";

  const showLoginToast = hasLoginCookie || hasLoginParam;

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient initialData={stats} showLoginToast={showLoginToast} />
    </Suspense>
  );
}
