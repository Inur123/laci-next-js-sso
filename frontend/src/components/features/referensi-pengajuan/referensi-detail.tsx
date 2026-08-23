import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PengajuanBerkasDetail } from "@/components/features/pengajuan-berkas/pengajuan-berkas-detail";

type PengajuanDetail = {
  id: string;
  noSurat: string;
  penerima: string;
  tanggal: Date;
  keperluan: string;
  deskripsi: string | null;
  status: string;
  alasanPenolakan: string | null;
  createdAt: Date;
  file: string | null;
  user: {
    name: string;
    email: string;
  };
  periodePac: {
    nama: string;
  };
};

export function ReferensiPengajuanDetail({
  pengajuan,
}: {
  pengajuan: PengajuanDetail;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/referensi-pengajuan">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Detail Pengajuan Surat</h2>
          <p className="text-sm text-muted-foreground">
            Detail informasi pengajuan surat
          </p>
        </div>
      </div>

      <PengajuanBerkasDetail
        pengajuan={pengajuan as any}
        isCabang={false}
        showSubmitterInfo={true}
        showActions={false}
      />
    </div>
  );
}
