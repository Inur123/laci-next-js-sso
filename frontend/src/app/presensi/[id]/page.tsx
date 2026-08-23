import { getPresensiDetail } from "@/app/actions/presensi-actions";
import { PresensiPublicContainer } from "@/components/features/presensi/presensi-public-container";
import { notFound } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Presensi | Laci Digital",
  description:
    "Formulir presensi digital untuk kegiatan PC IPNU IPPNU Kabupaten Magetan",
};

export default async function PublicPresensiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPresensiDetail(id);

  if (!data) {
    notFound();
  }

  // Hitung status buka/tutup secara realtime

  // VPS sudah di-setting timezone Asia/Jakarta, pakai date-fns langsung

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-0 sm:py-8 px-0 sm:px-4">
      <PresensiPublicContainer initialData={data} />
    </div>
  );
}
