"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  FileText,
  Download,
  Pencil,
  Trash2,
  Eye,
  AlertCircle,
  Calendar,
  Mail,
  User,
  Archive,
  ExternalLink,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteArsipSurat,
  getArsipDownloadToken,
} from "@/app/actions/arsip-actions";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { toast } from "sonner";
import { isPdf, isImage } from "@/lib/encryption";
import { formatDate } from "@/lib/date-utils";
import type { DecryptedArsipSurat } from "@/types";
import { useIsMobile } from "@/hooks/use-mobile";

interface ArsipSuratDetailProps {
  arsipSurat: DecryptedArsipSurat & { periode: { nama: string } };
}

const organisasiConfig: Record<string, { label: string; className: string }> = {
  IPNU: {
    label: "IPNU",
    className:
      "bg-emerald-100/80 text-emerald-700 border-emerald-200 hover:bg-emerald-200/80",
  },
  IPPNU: {
    label: "IPPNU",
    className:
      "bg-rose-100/80 text-rose-700 border-rose-200 hover:bg-rose-200/80",
  },
  BERSAMA: {
    label: "BERSAMA",
    className:
      "bg-indigo-100/80 text-indigo-700 border-indigo-200 hover:bg-indigo-200/80",
  },
};

const jenisSuratConfig: Record<string, { label: string; className: string }> = {
  MASUK: {
    label: "Surat Masuk",
    className:
      "bg-blue-100/80 text-blue-700 border-blue-200 hover:bg-blue-200/80",
  },
  KELUAR: {
    label: "Surat Keluar",
    className:
      "bg-amber-100/80 text-amber-700 border-amber-200 hover:bg-amber-200/80",
  },
};

export function ArsipSuratDetail({ arsipSurat }: ArsipSuratDetailProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(true);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Fetch token for PDF preview/open
  useEffect(() => {
    if (arsipSurat.id && isPdf(arsipSurat.file)) {
      getArsipDownloadToken(arsipSurat.id)
        .then(setDownloadToken)
        .catch(console.error);
    }
  }, [arsipSurat.id, arsipSurat.file]);

  const capitalizeName = (name: string) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteArsipSurat(arsipSurat.id);
    setIsDeleting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Arsip surat berhasil dihapus");
      router.push("/dashboard/arsip/surat");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/arsip/surat">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">
              Detail Arsip Surat
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              Lihat informasi lengkap dan lampiran surat
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" asChild className="flex-1 sm:flex-initial">
            <Link href={`/dashboard/arsip/surat/${arsipSurat.id}/edit`}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteModal(true)}
            className="flex-1 sm:flex-initial"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Hapus
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informasi Surat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Organisasi</p>
                {arsipSurat.organisasi ? (
                  <Badge
                    variant="outline"
                    className={
                      organisasiConfig[arsipSurat.organisasi]?.className ||
                      "bg-slate-50 text-slate-700 border-slate-200 shadow-none"
                    }
                  >
                    {organisasiConfig[arsipSurat.organisasi]?.label ||
                      arsipSurat.organisasi}
                  </Badge>
                ) : (
                  <p className="mt-1 font-medium">-</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Jenis Surat</p>
                <Badge
                  variant="outline"
                  className={
                    jenisSuratConfig[arsipSurat.jenisSurat]?.className ||
                    "bg-slate-50 text-slate-700 border-slate-200 shadow-none"
                  }
                >
                  {jenisSuratConfig[arsipSurat.jenisSurat]?.label ||
                    arsipSurat.jenisSurat}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" /> No. Surat
                </p>
                <p className="font-medium mt-1">{arsipSurat.noSurat}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Tanggal Surat
                </p>
                <p className="font-medium mt-1">
                  {formatDate(new Date(arsipSurat.tanggal), "PPPP")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {arsipSurat.jenisSurat === "MASUK" ? "Pengirim" : "Penerima"}
                </p>
                <p className="font-medium mt-1">
                  {capitalizeName(arsipSurat.pengirimPenerima)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Archive className="w-3 h-3" /> Periode
                </p>
                <p className="font-medium mt-1">{arsipSurat.periode.nama}</p>
              </div>

              {/* Perihal – kolom kiri, sejajar dengan Deskripsi */}
              <div>
                <p className="text-sm text-muted-foreground">Perihal</p>
                <p className="font-medium mt-1 text-lg">
                  {capitalizeName(arsipSurat.perihal)}
                </p>
              </div>

              {/* Deskripsi – kolom kanan, tepat di bawah Periode */}
              {arsipSurat.deskripsi && (
                <div className="md:col-start-2">
                  <p className="text-sm text-muted-foreground">
                    Deskripsi / Keterangan
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {arsipSurat.deskripsi}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {arsipSurat.file ? (
          <Card>
            <CardHeader>
              <CardTitle>File Lampiran</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center justify-between p-4 border rounded-lg gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-slate-100 rounded-full">
                    <FileText className="w-8 h-8 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-medium">File Surat (Terenkripsi)</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <Button
                    variant="outline"
                    asChild
                    className="flex-1 md:flex-none"
                  >
                    <a
                      href={`/api/arsip/download/${arsipSurat.id}?preview=true${downloadToken ? `&token=${downloadToken}` : ""}`}
                      target="_blank"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Buka
                    </a>
                  </Button>
                  <Button asChild className="flex-1 md:flex-none">
                    <a
                      href={`/api/arsip/download/${arsipSurat.id}${downloadToken ? `?token=${downloadToken}` : ""}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
              </div>

              {/* Preview Section */}
              {isPdf(arsipSurat.file) && (
                <div className="mt-4 border rounded-lg overflow-hidden bg-white shadow-sm">
                  <div className="p-2 border-b bg-slate-50/50 text-xs font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3 h-3 text-primary" />
                      Pratinjau PDF
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/5"
                      asChild
                    >
                      <a
                        href={`/api/arsip/download/${arsipSurat.id}?preview=true${downloadToken ? `&token=${downloadToken}` : ""}`}
                        target="_blank"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Layar Penuh
                      </a>
                    </Button>
                  </div>
                  <div className="w-full min-h-[200px] md:h-[750px] bg-white relative">
                    {isMobile ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 h-full">
                        <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                          <Smartphone className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-800 mb-2">
                          Pratinjau PDF di Perangkat Mobile
                        </h3>
                        <p className="text-xs text-slate-500 mb-6 max-w-[240px] leading-relaxed">
                          Browser mobile tidak dapat menampilkan PDF secara
                          langsung. Klik tombol di bawah untuk membuka file.
                        </p>
                        <Button
                          asChild
                          className="shadow-md hover:shadow-lg transition-all"
                        >
                          <a
                            href={`/api/arsip/download/${arsipSurat.id}?preview=true${downloadToken ? `&token=${downloadToken}` : ""}`}
                            target="_blank"
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Buka PDF Sekarang
                          </a>
                        </Button>
                      </div>
                    ) : (
                      <>
                        {isPdfLoading && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 z-10">
                            <Spinner className="h-8 w-8 mb-3 text-primary" />
                            <p className="text-sm text-muted-foreground animate-pulse">
                              Memuat...
                            </p>
                          </div>
                        )}
                        <object
                          data={`/api/arsip/download/${arsipSurat.id}?preview=true${downloadToken ? `&token=${downloadToken}` : ""}#view=FitH`}
                          type="application/pdf"
                          width="100%"
                          height="100%"
                          className="w-full h-full"
                          onLoad={() => setIsPdfLoading(false)}
                        >
                          <iframe
                            src={`/api/arsip/download/${arsipSurat.id}?preview=true${downloadToken ? `&token=${downloadToken}` : ""}`}
                            className="w-full h-full border-none"
                            title="PDF Preview"
                          />
                        </object>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Image Preview */}
              {isImage(arsipSurat.file) && (
                <div className="mt-4 border rounded-lg overflow-hidden bg-white shadow-sm">
                  <div className="p-2 border-b bg-slate-50/50 text-xs font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3 h-3 text-primary" />
                      Pratinjau Gambar
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/5"
                      asChild
                    >
                      <a
                        href={`/api/arsip/download/${arsipSurat.id}?preview=true`}
                        target="_blank"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Layar Penuh
                      </a>
                    </Button>
                  </div>
                  <div className="w-full bg-slate-50 flex justify-center p-4 relative min-h-[300px]">
                    {isImageLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 z-10">
                        <Spinner className="h-8 w-8 mb-3 text-primary" />
                        <p className="text-sm text-muted-foreground animate-pulse">
                          Memuat...
                        </p>
                      </div>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/arsip/download/${arsipSurat.id}?preview=true`}
                      alt="Pratinjau Lampiran"
                      className={`max-w-full max-h-[800px] object-contain rounded shadow-sm transition-opacity duration-300 ${isImageLoading ? "opacity-0" : "opacity-100"}`}
                      onLoad={() => setIsImageLoading(false)}
                    />
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                File siap diakses secara otomatis saat dibuka atau diunduh
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>File Lampiran</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg text-center bg-slate-50">
                <div className="p-4 bg-slate-100 rounded-full mb-3">
                  <FileText className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <h3 className="font-medium text-muted-foreground">
                  File tidak ada
                </h3>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Surat ini tidak memiliki lampiran file.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Hapus Arsip Surat?"
        description={`Apakah Anda yakin ingin menghapus arsip surat "${capitalizeName(arsipSurat.perihal)}"? Tindakan ini tidak dapat dibatalkan dan file terkait akan dihapus secara permanen.`}
        variant="destructive"
        loading={isDeleting}
      />
    </div>
  );
}
