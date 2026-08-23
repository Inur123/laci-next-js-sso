import { auth } from "@/auth";
import { getBackupList } from "@/app/actions/backup-actions";
import { BackupClient } from "@/components/features/backup/backup-client";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Backup Database | Laci Digital",
};

export default async function BackupPage() {
  const session = await auth();
  
  if (!session?.user?.id || session.user.role !== "SEKRETARIS_CABANG") {
    redirect("/dashboard");
  }

  const initialBackups = await getBackupList();

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <BackupClient initialBackups={initialBackups} />
    </div>
  );
}
