"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X } from "lucide-react";
import { createPresensi, updatePresensi } from "@/app/actions/presensi-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";

const capitalizeName = (name: string) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

interface PresensiFormProps {
  presensi?: any;
  userRole?: string;
}

export function PresensiForm({
  presensi,
  userRole = "SEKRETARIS_PAC",
}: PresensiFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    presensi?.tanggal ? new Date(presensi.tanggal) : undefined,
  );

  const isEdit = !!presensi;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const namaKegiatan = formData.get("namaKegiatan");
    if (!namaKegiatan) {
      toast.error("Nama Kegiatan harus diisi");
      return;
    }

    if (!selectedDate) {
      toast.error("Tanggal kegiatan harus dipilih");
      return;
    }

    formData.set("tanggal", selectedDate.toISOString());

    setIsSubmitting(true);
    try {
      let result;
      if (isEdit) {
        result = await updatePresensi(presensi.id, formData);
      } else {
        result = await createPresensi(formData);
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        router.push("/dashboard/presensi");
        router.refresh();
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "Enter" && target.tagName !== "TEXTAREA") {
        if (formRef.current && !isSubmitting) {
          formRef.current.requestSubmit();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting]);

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="namaKegiatan">
                  Nama Kegiatan <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="namaKegiatan"
                  name="namaKegiatan"
                  placeholder="Contoh: Rapat Pleno I"
                  defaultValue={
                    presensi?.namaKegiatan
                      ? capitalizeName(presensi.namaKegiatan)
                      : ""
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="penyelenggara">
                  Penyelenggara <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="penyelenggara"
                  name="penyelenggara"
                  placeholder="Contoh: PC IPNU IPPNU Magetan"
                  defaultValue={
                    presensi?.penyelenggara
                      ? capitalizeName(presensi.penyelenggara)
                      : "PC IPNU IPPNU Magetan"
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tempat">
                  Lokasi / Tempat <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="tempat"
                  name="tempat"
                  placeholder="Contoh: Aula PCNU Magetan"
                  defaultValue={
                    presensi?.tempat ? capitalizeName(presensi.tempat) : ""
                  }
                  required
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tanggal">
                  Tanggal Kegiatan <span className="text-red-500">*</span>
                </Label>
                <DatePicker
                  date={selectedDate}
                  onDateChange={setSelectedDate}
                  placeholder="Pilih tanggal kegiatan"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jamMulai">
                    Jam Mulai <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="jamMulai"
                    name="jamMulai"
                    type="time"
                    defaultValue={presensi?.jamMulai || "08:00"}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jamSelesai">
                    Jam Selesai <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="jamSelesai"
                    name="jamSelesai"
                    type="time"
                    defaultValue={presensi?.jamSelesai || "12:00"}
                    required
                  />
                </div>
              </div>

              <div
                className={cn(
                  "p-4 rounded-lg border mt-2",
                  userRole === "SEKRETARIS_CABANG"
                    ? "bg-blue-50/50 border-blue-100"
                    : "bg-green-50/50 border-green-100",
                )}
              >
                <p
                  className={cn(
                    "text-xs leading-relaxed",
                    userRole === "SEKRETARIS_CABANG"
                      ? "text-blue-700"
                      : "text-green-600",
                  )}
                >
                  <strong>Informasi:</strong> Sesi presensi hanya dapat diakses
                  pada tanggal yang ditentukan. Pastikan data sudah benar
                  sebelum menyimpan.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-6 border-t font-semibold">
            <Button
              type="button"
              variant="outline"
              className="flex-1 hover:bg-slate-100 transition-all duration-200"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "flex-1 text-white shadow-md hover:shadow-xl transition-all duration-200",
                userRole === "SEKRETARIS_CABANG"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-green-600 hover:bg-green-700",
              )}
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Memproses...
                </>
              ) : (
                <>
                  {isEdit ? (
                    <Upload className="w-4 h-4 mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {isEdit ? "Simpan Perubahan" : "Buat Presensi"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
