"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check, Eye, X } from "lucide-react";
import { verifikasiAnggota } from "@/app/actions/anggota-actions";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export function VerifikasiDialog({
  anggota,
  onVerified,
}: {
  anggota: any;
  onVerified: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [alasan, setAlasan] = useState("");

  const handleVerifikasi = async (status: "DITERIMA" | "DITOLAK") => {
    if (status === "DITOLAK" && !alasan.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }

    setLoading(true);
    const res = await verifikasiAnggota(
      anggota.id,
      status,
      status === "DITOLAK" ? alasan : undefined
    );
    setLoading(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(res.success);
      setOpen(false);
      onVerified();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) {
        setRejectMode(false);
        setAlasan("");
      }
    }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-8 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          title="Tinjau dan Verifikasi"
        >
          <Check className="w-4 h-4 mr-1.5" />
          Verifikasi
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Verifikasi Data Anggota</DialogTitle>
          <DialogDescription>
            Tinjau data pendaftar ini sebelum mengesahkannya menjadi anggota.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 text-sm">
          <div className="grid grid-cols-3 items-center gap-4">
            <span className="font-medium text-slate-500">Nama Lengkap</span>
            <span className="col-span-2 font-semibold text-slate-900">{anggota.namaLengkap}</span>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <span className="font-medium text-slate-500">Jenis Kelamin</span>
            <span className="col-span-2">
              {anggota.jenisKelamin === "LAKI_LAKI" ? "Laki-Laki" : "Perempuan"}
            </span>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <span className="font-medium text-slate-500">NIK</span>
            <span className="col-span-2">{anggota.nik || "-"}</span>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <span className="font-medium text-slate-500">Alamat Lengkap</span>
            <span className="col-span-2">{anggota.alamatLengkap || "-"}</span>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <span className="font-medium text-slate-500">Tempat, Tanggal Lahir</span>
            <span className="col-span-2">
              {anggota.tempatLahir || "-"}, {anggota.tanggalLahir ? new Date(anggota.tanggalLahir).toLocaleDateString("id-ID") : "-"}
            </span>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <span className="font-medium text-slate-500">No. HP</span>
            <span className="col-span-2">{anggota.noHp || "-"}</span>
          </div>
          
          <div className="my-2 border-t pt-4">
            <h4 className="font-semibold text-slate-900 mb-2">Riwayat Pendidikan</h4>
            {anggota.pendidikans?.length > 0 ? (
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                {anggota.pendidikans.map((p: any, i: number) => (
                  <li key={i}>
                    <strong>{p.jenjang}:</strong> {p.namaSekolah}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 italic">Belum ada data pendidikan</p>
            )}
          </div>

          <div className="my-2 border-t pt-4">
            <h4 className="font-semibold text-slate-900 mb-2">Riwayat Kaderisasi</h4>
            {anggota.perkaderans?.length > 0 ? (
              <ul className="list-disc pl-5 text-slate-700 space-y-1">
                {anggota.perkaderans.map((p: any, i: number) => (
                  <li key={i}>
                    <strong>{p.namaPerkaderan}:</strong> {new Date(p.tanggal).toLocaleDateString("id-ID")} ({p.tempat})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 italic">Belum ada data kaderisasi</p>
            )}
          </div>
        </div>

        {rejectMode && (
          <div className="border-t pt-4 space-y-3">
            <label className="text-sm font-medium text-red-600">
              Alasan Penolakan (Wajib)
            </label>
            <Textarea 
              placeholder="Tuliskan alasan mengapa pendaftar ini ditolak..." 
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              className="border-red-200 focus-visible:ring-red-500"
            />
          </div>
        )}

        <DialogFooter className="border-t pt-4 mt-2 sm:justify-between flex-row">
          {rejectMode ? (
            <>
              <Button 
                variant="ghost" 
                onClick={() => setRejectMode(false)}
                disabled={loading}
              >
                Batal Tolak
              </Button>
              <Button 
                variant="destructive"
                onClick={() => handleVerifikasi("DITOLAK")}
                disabled={loading || !alasan.trim()}
              >
                {loading ? "Memproses..." : "Konfirmasi Tolak"}
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => setRejectMode(true)}
                disabled={loading}
              >
                <X className="w-4 h-4 mr-2" />
                Tolak Pendaftar
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleVerifikasi("DITERIMA")}
                disabled={loading}
              >
                <Check className="w-4 h-4 mr-2" />
                {loading ? "Memproses..." : "Terima Anggota Sah"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
