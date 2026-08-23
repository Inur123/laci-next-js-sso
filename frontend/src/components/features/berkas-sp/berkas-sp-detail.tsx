"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  FileText,
  Download,
  Pencil,
  Trash2,
  Eye,
  AlertCircle,
  Calendar,
  User,
  Archive,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteBerkasSP } from "@/app/actions/berkas-sp-actions";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-utils";
import { getBerkasSPDownloadToken } from "@/app/actions/berkas-sp-actions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Smartphone } from "lucide-react";

interface BerkasSP {
  id: string;
  nama: string;
  organisasi: string | null;
  tanggalMulai: Date;
  tanggalBerakhir: Date;
  catatan: string | null;
  file: string | null;
  periode: { nama: string };
}

interface BerkasSPDetailProps {
  berkasSP: BerkasSP;
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

const getStatusBadge = (tanggalBerakhir: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(tanggalBerakhir);
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <Badge
        variant="outline"
        className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] leading-3 h-5 px-1.5 font-medium whitespace-nowrap"
      >
        Kedaluwarsa (Lewat {Math.abs(diffDays)} Hari)
      </Badge>
    );
  } else if (diffDays === 0) {
    return (
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] leading-3 h-5 px-1.5 font-semibold whitespace-nowrap animate-pulse"
      >
        Berakhir Hari Ini!
      </Badge>
    );
  } else if (diffDays <= 30) {
    return (
      <Badge
        variant="outline"
        className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] leading-3 h-5 px-1.5 whitespace-nowrap"
      >
        Hampir Habis (Sisa {diffDays} Hari)
      </Badge>
    );
  } else {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] leading-3 h-5 px-1.5 whitespace-nowrap"
      >
        Aktif (Sisa {diffDays} Hari)
      </Badge>
    );
  }
};

export function BerkasSPDetail({ berkasSP }: BerkasSPDetailProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(true);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const getOriginalExtension = (filename: string | null) => {
    if (!filename) return "";
    const base = filename.split("/").pop() || "";
    const nameWithoutEnc = base.replace(/\.enc$/, "");
    const parts = nameWithoutEnc.split("-");
    if (parts.length > 2) {
      return parts[parts.length - 1].toLowerCase();
    }
    const dotParts = nameWithoutEnc.split(".");
    if (dotParts.length > 1) {
      return dotParts[dotParts.length - 1].toLowerCase();
    }
    return "bin";
  };

  const isPdfFile = getOriginalExtension(berkasSP.file) === "pdf";
  const isImageFile = ["jpg", "jpeg", "png", "webp"].includes(
    getOriginalExtension(berkasSP.file),
  );

  // Fetch token for PDF preview/open
  React.useEffect(() => {
    if (berkasSP.id && isPdfFile) {
      getBerkasSPDownloadToken(berkasSP.id)
        .then(setDownloadToken)
        .catch(console.error);
    }
  }, [berkasSP.id, isPdfFile]);



  const capitalizeName = (name: string) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteBerkasSP(berkasSP.id);
    setIsDeleting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Berkas SP berhasil dihapus");
      router.push("/dashboard/berkas-sp");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/berkas-sp">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">
              Detail Berkas SP
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              Lihat informasi lengkap berkas kepengurusan
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" asChild className="flex-1 sm:flex-initial">
            <Link href={`/dashboard/berkas-sp/${berkasSP.id}/edit`}>
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
            <CardTitle>Informasi Berkas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Organisasi</p>
                {berkasSP.organisasi ? (
                  <Badge
                    variant="outline"
                    className={
                      organisasiConfig[berkasSP.organisasi]?.className ||
                      "bg-slate-50 text-slate-700 border-slate-200 shadow-none"
                    }
                  >
                    {organisasiConfig[berkasSP.organisasi]?.label ||
                      berkasSP.organisasi}
                  </Badge>
                ) : (
                  <p className="mt-1 font-medium">-</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" /> Nama Pimpinan / Pengaju
                </p>
                <p className="font-medium mt-1 text-lg">
                  {capitalizeName(berkasSP.nama)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Tanggal Mulai
                </p>
                <p className="font-medium mt-1">
                  {formatDate(new Date(berkasSP.tanggalMulai), "PPPP")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Tanggal Berakhir
                </p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2 mt-1">
                  <p className="font-medium">
                    {formatDate(new Date(berkasSP.tanggalBerakhir), "PPPP")}
                  </p>
                  {getStatusBadge(berkasSP.tanggalBerakhir)}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Archive className="w-3 h-3" /> Periode
                </p>
                <p className="font-medium mt-1">{berkasSP.periode.nama}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Catatan
                </p>
                <p className="font-medium mt-1 truncate max-w-full">
                  {berkasSP.catatan ? capitalizeName(berkasSP.catatan) : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {berkasSP.file ? (
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
                    <p className="font-medium">Berkas SP (Terenkripsi)</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <Button
                    variant="outline"
                    asChild
                    className="flex-1 md:flex-none"
                  >
                    <a
                      href={`/api/berkas-sp/download/${berkasSP.id}?preview=true${downloadToken ? `&token=${downloadToken}` : ""}`}
                      target="_blank"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Buka
                    </a>
                  </Button>
                  <Button asChild className="flex-1 md:flex-none">
                    <a
                      href={`/api/berkas-sp/download/${berkasSP.id}${downloadToken ? `?token=${downloadToken}` : ""}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
              </div>

              {/* PDF Preview Section */}
              {isPdfFile && (
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
                        href={`/api/berkas-sp/download/${berkasSP.id}?preview=true${downloadToken ? `&token=${downloadToken}` : ""}`}
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
                          Pratinjau PDF di Mobile
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
                            href={`/api/berkas-sp/download/${berkasSP.id}?preview=true${downloadToken ? `&token=${downloadToken}` : ""}`}
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
                          data={`/api/berkas-sp/download/${berkasSP.id}?preview=true${downloadToken ? `&token=${downloadToken}` : ""}#view=FitH`}
                          type="application/pdf"
                          width="100%"
                          height="100%"
                          className="w-full h-full"
                          onLoad={() => setIsPdfLoading(false)}
                        >
                          <iframe
                            src={`/api/berkas-sp/download/${berkasSP.id}?preview=true${downloadToken ? `&token=${downloadToken}` : ""}`}
                            className="w-full h-full border-none"
                            title="PDF Preview"
                          />
                        </object>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Image Preview Section */}
              {isImageFile && (
                <div className="mt-4 border rounded-lg overflow-hidden bg-white shadow-sm">
                  <div className="p-2 border-b bg-slate-50/50 text-xs font-medium px-3 flex items-center gap-2">
                    <FileText className="w-3 h-3 text-primary" />
                    Pratinjau Gambar
                  </div>
                  <div className="w-full flex justify-center bg-slate-50 p-4 relative min-h-[200px]">
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
                      src={`/api/berkas-sp/download/${berkasSP.id}?preview=true`}
                      alt="Pratinjau Berkas"
                      className="max-w-full h-auto rounded shadow-lg"
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
                  Berkas ini tidak memiliki lampiran file.
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
        title="Hapus Berkas SP?"
        description={`Apakah Anda yakin ingin menghapus berkas SP milik "${capitalizeName(berkasSP.nama)}"? Tindakan ini tidak dapat dibatalkan dan file terkait akan dihapus secara permanen.`}
        variant="destructive"
        loading={isDeleting}
      />
    </div>
  );
}
