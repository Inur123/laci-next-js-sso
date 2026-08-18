"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  createPengajuanBerkas,
  updatePengajuanBerkas,
} from "@/app/actions/pengajuan-berkas-actions";
import { Upload, X, FileText, AlertCircle, ExternalLink } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePicker } from "@/components/ui/date-picker";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getPengajuanDownloadToken } from "@/app/actions/pengajuan-berkas-actions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Smartphone } from "lucide-react";
import React, { useEffect } from "react";
import { isPdf, isImage } from "@/lib/encryption";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PenerimaSurat } from "@prisma/client";

type PengajuanBerkasFormProps = {
  pengajuan?: {
    id: string;
    noSurat: string;
    penerima: PenerimaSurat;
    tanggal: Date;
    keperluan: string;
    deskripsi: string | null;
    file: string | null;
    status: string;
  };
  userRole?: string;
};

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
];

export function PengajuanBerkasForm({
  pengajuan,
  userRole,
}: PengajuanBerkasFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [tanggal, setTanggal] = useState<Date | undefined>(
    pengajuan?.tanggal ? new Date(pengajuan.tanggal) : undefined,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(true);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const showPdfPreview = isPdf(pengajuan?.file) && !selectedFile;
  const showImagePreview = isImage(pengajuan?.file) && !selectedFile;
  const showAnyPreview = showPdfPreview || showImagePreview;

  // Fetch token for PDF preview/open
  useEffect(() => {
    if (pengajuan?.id && showPdfPreview) {
      getPengajuanDownloadToken(pengajuan.id)
        .then(setDownloadToken)
        .catch(console.error);
    }
  }, [pengajuan?.id, showPdfPreview]);

  const capitalizeName = (name: string) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return "Ukuran file maksimal 2MB";
    }

    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return "Format file harus PDF, Word, PowerPoint, atau Gambar (JPG/PNG/WebP)";
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type) && file.type !== "") {
      return "Format file harus PDF, Word, PowerPoint, atau Gambar (JPG/PNG/WebP)";
    }

    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);

    if (file) {
      const error = validateFile(file);
      if (error) {
        setFileError(error);
        setSelectedFile(null);
        e.target.value = "";
      } else {
        setSelectedFile(file);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError(null);
    const fileInput = document.getElementById("file") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    setFileError(null);

    if (file) {
      const error = validateFile(file);
      if (error) {
        setFileError(error);
        setSelectedFile(null);
      } else {
        setSelectedFile(file);
        // Sync with hidden input if possible, though creating a DataTransfer list for input.files is complex/optional for uncontrolled input but good for consistency
        const fileInput = document.getElementById("file") as HTMLInputElement;
        if (fileInput) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInput.files = dataTransfer.files;
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const noSurat = formData.get("noSurat");
    const penerima = formData.get("penerima");
    const keperluan = formData.get("keperluan");

    if (!noSurat) {
      toast.error("Nomor surat harus diisi");
      return;
    }

    if (!penerima) {
      toast.error("Penerima harus dipilih");
      return;
    }

    if (!tanggal) {
      toast.error("Tanggal harus diisi");
      return;
    }

    if (!keperluan) {
      toast.error("Keperluan harus diisi");
      return;
    }

    if (!pengajuan && !selectedFile) {
      toast.error("File harus diunggah");
      return;
    }

    if (selectedFile) {
      const error = validateFile(selectedFile);
      if (error) {
        setFileError(error);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      formData.set("tanggal", tanggal.toISOString());

      if (selectedFile) {
        formData.set("file", selectedFile);
      }

      let result;
      if (pengajuan) {
        result = await updatePengajuanBerkas(pengajuan.id, formData);
      } else {
        result = await createPengajuanBerkas(formData);
      }

      if (result.error) {
        toast.error(result.error);
        setIsSubmitting(false);
      } else {
        toast.success(result.success);
        router.push("/dashboard/pengajuan-berkas?confetti=true");
        router.refresh();
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Terjadi kesalahan saat menyimpan data");
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Main Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="noSurat">
                  Nomor Surat <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="noSurat"
                  name="noSurat"
                  defaultValue={pengajuan?.noSurat}
                  placeholder="Contoh: 001/PAC/I/2026"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="penerima">
                  Penerima <span className="text-red-500">*</span>
                </Label>
                <Select
                  name="penerima"
                  defaultValue={pengajuan?.penerima || undefined}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih Penerima" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IPNU">IPNU</SelectItem>
                    <SelectItem value="IPPNU">IPPNU</SelectItem>
                    <SelectItem value="BERSAMA">BERSAMA</SelectItem>
                    <SelectItem value="CBP_KPP">CBP KPP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tanggal">
                  Tanggal <span className="text-red-500">*</span>
                </Label>
                <DatePicker
                  date={tanggal}
                  onDateChange={setTanggal}
                  placeholder="Pilih tanggal"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="keperluan">
                  Keperluan <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="keperluan"
                  name="keperluan"
                  defaultValue={
                    pengajuan?.keperluan
                      ? capitalizeName(pengajuan.keperluan)
                      : ""
                  }
                  placeholder="Contoh: Permohonan Izin Kegiatan"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deskripsi">Deskripsi</Label>
                <Textarea
                  id="deskripsi"
                  name="deskripsi"
                  defaultValue={
                    pengajuan?.deskripsi
                      ? capitalizeName(pengajuan.deskripsi)
                      : ""
                  }
                  placeholder="Jelaskan detail pengajuan surat (opsional)"
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Right Column: File Upload & Preview */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">
                  File Lampiran <span className="text-red-500">*</span>
                </Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                    isDragging
                      ? userRole === "SEKRETARIS_CABANG"
                        ? "border-blue-500 bg-blue-50"
                        : "border-green-600 bg-green-50"
                      : "hover:border-slate-300"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {!selectedFile && !pengajuan?.file ? (
                    <div className="text-center py-4">
                      <Input
                        id="file"
                        name="file"
                        type="file"
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                      />
                      <label
                        htmlFor="file"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <div className="p-3 bg-slate-100 rounded-full">
                          <Upload className="w-6 h-6 text-slate-500" />
                        </div>
                        <div className="text-sm">
                          <span
                            className={`font-medium ${
                              userRole === "SEKRETARIS_CABANG"
                                ? "text-blue-600"
                                : "text-green-600"
                            }`}
                          >
                            Klik untuk upload
                          </span>
                          <span className="text-muted-foreground ml-1">
                            atau drag & drop
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Maksimal 2MB. Format: PDF, Word, PPT, atau Gambar.
                        </p>
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded">
                          <FileText className="w-5 h-5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {selectedFile?.name || "File Lampiran (Tersimpan)"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {selectedFile
                              ? formatFileSize(selectedFile.size)
                              : "File saat ini"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveFile}
                          className="text-red-500 hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      {!selectedFile && pengajuan?.file && (
                        <div className="flex items-center justify-between">
                          <Input
                            id="file"
                            name="file"
                            type="file"
                            onChange={handleFileChange}
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                            className="hidden"
                          />
                          <label
                            htmlFor="file"
                            className={`text-xs hover:underline cursor-pointer font-medium ${
                              userRole === "SEKRETARIS_CABANG"
                                ? "text-blue-600"
                                : "text-green-600"
                            }`}
                          >
                            Ganti file
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Integrated Previews */}
              {showAnyPreview && (
                <div className="mt-4 border rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                  <div className="p-2 border-b bg-slate-50/50 text-[10px] font-medium flex items-center justify-between px-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3 h-3 text-primary" />
                      Pratinjau {showPdfPreview ? "PDF" : "Gambar"}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[9px] text-primary"
                      asChild
                    >
                      <a
                        href={`/api/pengajuan-berkas/download/${pengajuan?.id}?preview=true${downloadToken ? `&token=${downloadToken}` : ""}`}
                        target="_blank"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Full
                      </a>
                    </Button>
                  </div>
                  <div
                    className={`w-full ${showPdfPreview ? (isMobile ? "min-h-[150px]" : "h-[500px]") : "min-h-[200px] flex justify-center bg-slate-50 p-4"} relative`}
                  >
                    {showPdfPreview &&
                      (isMobile ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 h-full w-full">
                          <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                            <Smartphone className="w-6 h-6 text-primary" />
                          </div>
                          <p className="text-[10px] font-medium text-slate-700 mb-1">
                            Pratinjau PDF di Mobile
                          </p>
                          <Button
                            asChild
                            size="sm"
                            className="h-7 px-3 text-[9px] shadow-sm mt-2"
                          >
                            <a
                              href={`/api/pengajuan-berkas/download/${pengajuan?.id}?preview=true${downloadToken ? `&token=${downloadToken}` : ""}`}
                              target="_blank"
                            >
                              <ExternalLink className="w-3 h-3 mr-1.5" />
                              Buka PDF
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <>
                          {isPdfLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 z-10">
                              <Spinner className="h-6 w-6 mb-2 text-primary" />
                              <p className="text-[10px] text-muted-foreground">
                                Memuat...
                              </p>
                            </div>
                          )}
                          <object
                            data={`/api/pengajuan-berkas/download/${pengajuan?.id}?preview=true${downloadToken ? `&token=${downloadToken}` : ""}#view=FitH`}
                            type="application/pdf"
                            width="100%"
                            height="100%"
                            className="w-full h-full"
                            onLoad={() => setIsPdfLoading(false)}
                          >
                            <iframe
                              src={`/api/pengajuan-berkas/download/${pengajuan?.id}?preview=true${downloadToken ? `&token=${downloadToken}` : ""}`}
                              className="w-full h-full border-none"
                              title="PDF Preview"
                            />
                          </object>
                        </>
                      ))}
                    {showImagePreview && (
                      <>
                        {isImageLoading && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 z-10">
                            <Spinner className="h-6 w-6 mb-2 text-primary" />
                            <p className="text-[10px] text-muted-foreground">
                              Memuat...
                            </p>
                          </div>
                        )}
                        <img
                          src={`/api/pengajuan-berkas/download/${pengajuan?.id}?preview=true`}
                          alt="Pratinjau Gambar"
                          className={`max-w-full max-h-[500px] rounded shadow-sm object-contain transition-opacity duration-300 ${isImageLoading ? "opacity-0" : "opacity-100"}`}
                          onLoad={() => setIsImageLoading(false)}
                        />
                      </>
                    )}
                  </div>
                </div>
              )}

              {fileError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{fileError}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          {/* Submit Buttons at the bottom of the card */}
          <div className="flex gap-3 mt-6 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              className="flex-1 hover:bg-slate-100 transition-all duration-200"
              onClick={() => window.history.back()}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !!fileError}
              className={`flex-1 text-white shadow-md hover:shadow-xl transition-all duration-200 ${
                userRole === "SEKRETARIS_CABANG"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Loading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {pengajuan ? "Update Pengajuan" : "Kirim Pengajuan"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
