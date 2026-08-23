import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getEmailStats, getEmailLogs } from "@/app/actions/log-email-actions";
import { EmailLogClient } from "@/components/features/log-email/email-log-client";
import { EmailLogSkeleton } from "@/components/features/log-email/email-log-skeleton";
import { Suspense } from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log Email | Laci Digital",
};

export default async function EmailLogPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  // Only Sekretaris Cabang can access this page
  if (session.user.role !== "SEKRETARIS_CABANG") {
    redirect("/dashboard");
  }

  return (
    <Suspense fallback={<EmailLogSkeleton />}>
      <EmailLogContent />
    </Suspense>
  );
}

async function EmailLogContent() {
  const [stats, initialLogs] = await Promise.all([
    getEmailStats(),
    getEmailLogs({}, 1, 20),
  ]);

  return <EmailLogClient initialStats={stats} initialLogs={initialLogs} />;
}
