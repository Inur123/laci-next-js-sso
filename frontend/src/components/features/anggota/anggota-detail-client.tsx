"use client";

import React, { useState } from "react";
import { verifikasiAnggota } from "@/app/actions/anggota-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { SensitiveInfoItem } from "./sensitive-info-item";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Mail,
  Calendar,
  ArrowLeft,
  User as UserIcon,
  Phone,
  MapPin,
  Briefcase,
  IdCard,
  Heart,
  CreditCard,
  GraduationCap,
  School,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { cn } from "@/lib/utils";

type AnggotaDetail = {
  id: string;
  namaLengkap: string;
  jabatan?: string | null;
  foto?: string | null;
  updatedAt: Date | string;
  createdAt: Date | string;
  noHp?: string | null;
  email?: string | null;
  nik?: string | null;
  nia?: string | null;
  jenisKelamin?: string | null;
  tempatLahir?: string | null;
  tanggalLahir?: Date | string | null;
  noRfid?: string | null;
  alamatLengkap?: string | null;
  hobi?: string | null;
  pendidikans?: Array<{
    id: string;
    jenjang: string;
    namaSekolah: string;
  }>;
  perkaderans?: Array<{
    id: string;
    namaPerkaderan: string;
    tanggal: Date | string;
    tempat: string;
  }>;
  status?: "PENDING" | "DITERIMA" | "DITOLAK";
  alasanPenolakan?: string | null;
};

const memberStatusConfig = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  DITERIMA: {
    label: "Diterima",
    icon: CheckCircle,
    className: "bg-green-50 text-green-700 border-green-200",
  },
  DITOLAK: {
    label: "Ditolak",
    icon: XCircle,
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export default function AnggotaDetailClient({
  anggota,
  userRole,
}: {
  anggota: AnggotaDetail;
  userRole: string;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [alasanPenolakan, setAlasanPenolakan] = useState("");
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);
  const router = useRouter();
  const isCabang =
    userRole === "SEKRETARIS_CABANG" || userRole === "CABANG";
  const status = anggota.status || "PENDING";
  const statusInfo = memberStatusConfig[status];
  const StatusIcon = statusInfo.icon;

  const capitalizeName = (name: string) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  async function handleApprove() {
    setIsSubmitting(true);
    const result = await verifikasiAnggota(anggota.id, "DITERIMA");
    setIsSubmitting(false);
    setConfirmApproveOpen(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.success);
      router.refresh();
    }
  }

  async function handleReject() {
    if (!alasanPenolakan.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    setIsSubmitting(true);
    const result = await verifikasiAnggota(
      anggota.id,
      "DITOLAK",
      alasanPenolakan,
    );
    setIsSubmitting(false);
    setConfirmRejectOpen(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.success);
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild className="shadow-sm">
            <Link href="/dashboard/anggota">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">
              Detail Anggota
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              Informasi lengkap profil dan identitas anggota
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`w-fit gap-1.5 px-3 py-1.5 ${statusInfo.className}`}
        >
          <StatusIcon className="w-4 h-4" />
          {statusInfo.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] lg:grid-rows-[auto_1fr] gap-x-8 gap-y-6">
        {/* SIDEBAR TOP: Photo & Basic Info */}
        <div className="lg:col-start-1 lg:row-start-1 space-y-6">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <UserIcon size={16} className="text-primary" />
                Profil Anggota
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8 pb-6 flex flex-col items-center">
              <Avatar className="h-40 w-40 border-4 border-white shadow-xl">
                <AvatarImage
                  src={
                    anggota.foto
                      ? `/api/anggota/${anggota.id}/image?v=${anggota.updatedAt}`
                      : ""
                  }
                  className="object-cover"
                />
                <AvatarFallback className="text-4xl bg-slate-100 text-slate-400 font-bold">
                  {getInitials(anggota.namaLengkap)}
                </AvatarFallback>
              </Avatar>
              <div className="mt-6 text-center space-y-2">
                <h3 className="font-bold text-lg leading-tight">
                  {capitalizeName(anggota.namaLengkap)}
                </h3>
              </div>

              <div className="mt-6 w-full space-y-3 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3 text-slate-600">
                  <div className="p-1.5 bg-slate-50 rounded-md border text-slate-400">
                    <Phone size={14} />
                  </div>
                  <span className="text-xs font-medium">
                    {anggota.noHp || "-"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <div className="p-1.5 bg-slate-50 rounded-md border text-slate-400">
                    <Mail size={14} />
                  </div>
                  <span className="text-xs font-medium truncate">
                    {anggota.email || "-"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {isCabang && status === "PENDING" && (
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <CheckCircle size={16} className="text-primary" />
                  Tindakan Verifikasi
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                {!showRejectForm ? (
                  <div className="space-y-3">
                    <Button
                      onClick={() => setConfirmApproveOpen(true)}
                      disabled={isSubmitting}
                      className="w-full bg-primary hover:bg-primary/90 text-white shadow-md transition-all duration-200"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Verifikasi Anggota
                    </Button>
                    <Button
                      onClick={() => setShowRejectForm(true)}
                      disabled={isSubmitting}
                      className="w-full bg-red-600 hover:bg-red-700 text-white shadow-md transition-all duration-200"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Tolak Pendaftar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="alasan-penolakan-anggota">
                        Alasan Penolakan{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="alasan-penolakan-anggota"
                        value={alasanPenolakan}
                        onChange={(event) =>
                          setAlasanPenolakan(event.target.value)
                        }
                        placeholder="Jelaskan alasan penolakan..."
                        rows={4}
                        className="resize-none"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => setConfirmRejectOpen(true)}
                        disabled={isSubmitting || !alasanPenolakan.trim()}
                        className="w-full bg-red-600 hover:bg-red-700 text-white shadow-md transition-all duration-200"
                      >
                        Konfirmasi Penolakan
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowRejectForm(false);
                          setAlasanPenolakan("");
                        }}
                        disabled={isSubmitting}
                        className="w-full hover:bg-slate-100"
                      >
                        Batal
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {status === "DITOLAK" && anggota.alasanPenolakan && (
            <Card className="border-red-200 bg-red-50/40 shadow-sm">
              <CardContent className="pt-5">
                <div className="flex items-start gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Alasan Penolakan</p>
                    <p className="text-sm mt-1 text-red-700/80">
                      {anggota.alasanPenolakan}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* MAIN CONTENT Area */}
        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <IdCard size={16} className="text-primary" />
                Informasi Personal
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
              <SensitiveInfoItem
                label="NIK"
                value={anggota.nik || ""}
                icon={<CreditCard size={14} />}
              />
              <SensitiveInfoItem
                label="NIA"
                value={anggota.nia || ""}
                icon={<CreditCard size={14} />}
              />
              <InfoItem
                label="Jenis Kelamin"
                value={
                  anggota.jenisKelamin === "LAKI_LAKI"
                    ? "Laki-laki"
                    : "Perempuan"
                }
                icon={<UserIcon size={14} />}
              />
              <InfoItem
                label="Tempat, Tanggal Lahir"
                value={
                  anggota.tempatLahir
                    ? `${anggota.tempatLahir}, ${anggota.tanggalLahir ? new Date(anggota.tanggalLahir).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}`
                    : "-"
                }
                icon={<Calendar size={14} />}
              />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Briefcase size={16} className="text-primary" />
                Informasi Organisasi & Tambahan
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
              <InfoItem
                label="Jabatan"
                value={anggota.jabatan || "Anggota"}
                icon={<Briefcase size={14} />}
                highLight
              />
              <InfoItem
                label="No. RFID"
                value={anggota.noRfid || "-"}
                icon={<CreditCard size={14} />}
              />

              <InfoItem
                label="Hobi / Minat Bakat"
                value={anggota.hobi || "-"}
                icon={<Heart size={14} />}
                fullWidth
              />
              <InfoItem
                label="Alamat Lengkap"
                value={anggota.alamatLengkap || "-"}
                icon={<MapPin size={14} />}
                fullWidth
              />
            </CardContent>

            {/* Riwayat Pendidikan Inside Organisasi Card */}
            <div className="border-t border-slate-100 bg-slate-50/30">
              <div className="px-6 py-4">
                <h3 className="text-[12px] font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
                  <School size={14} className="text-primary" />
                  Riwayat Pendidikan
                </h3>
              </div>
              <CardContent className="px-6 pb-6 pt-0">
                {anggota.pendidikans && anggota.pendidikans.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {anggota.pendidikans.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className="flex flex-col p-4 border border-slate-100 rounded-xl bg-white shadow-sm space-y-1.5 transition-all hover:shadow-md"
                      >
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {p.jenjang}
                        </span>
                        <p className="text-sm font-bold text-slate-700">
                          {p.namaSekolah}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-white">
                    <p className="text-[10px] text-slate-500 font-medium tracking-wide">
                      BELUM ADA DATA PENDIDIKAN
                    </p>
                  </div>
                )}
              </CardContent>
            </div>
          </Card>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest border-t pt-4">
            <div className="flex items-center gap-2">
              <Calendar size={12} />
              <span>
                Terdaftar:{" "}
                {new Date(anggota.createdAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={12} />
              <span>
                Update:{" "}
                {new Date(anggota.updatedAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* SIDEBAR BOTTOM / Mobile Bottom: Perkaderan */}
        <div className="lg:col-start-1 lg:row-start-2">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b pb-3">
              <CardTitle className="text-[12px] font-bold flex items-center gap-2">
                <GraduationCap size={14} className="text-primary" />
                Riwayat Perkaderan
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 pb-4 px-3">
              {anggota.perkaderans && anggota.perkaderans.length > 0 ? (
                <div className="space-y-3">
                  {anggota.perkaderans.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="p-3 bg-slate-50/50 rounded-lg border border-slate-100 shadow-sm space-y-2"
                    >
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">
                          Nama
                        </span>
                        <p className="text-xs font-bold text-slate-800 leading-tight">
                          {p.namaPerkaderan}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100/50">
                        <div className="space-y-0.5">
                          <span className="text-[8px] font-bold text-slate-400 uppercase">
                            Tanggal
                          </span>
                          <p className="text-[10px] font-medium text-slate-600">
                            {p.tanggal
                              ? new Date(p.tanggal).toLocaleDateString(
                                  "id-ID",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )
                              : "-"}
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[8px] font-bold text-slate-400 uppercase">
                            Tempat
                          </span>
                          <p className="text-[10px] font-medium text-slate-600 truncate">
                            {p.tempat}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border-2 border-dashed rounded-lg bg-slate-50/50">
                  <p className="text-[10px] text-slate-500 font-medium">
                    Belum ada data.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmApproveOpen}
        onClose={() => setConfirmApproveOpen(false)}
        onConfirm={handleApprove}
        title="Verifikasi Anggota?"
        description={`Apakah Anda yakin ingin mengesahkan ${capitalizeName(anggota.namaLengkap)} sebagai anggota?`}
        confirmText="Ya, Verifikasi"
        variant="default"
        loading={isSubmitting}
      />

      <ConfirmModal
        isOpen={confirmRejectOpen}
        onClose={() => setConfirmRejectOpen(false)}
        onConfirm={handleReject}
        title="Tolak Pendaftar?"
        description={`Apakah Anda yakin ingin menolak pendaftaran ${capitalizeName(anggota.namaLengkap)}? Alasan penolakan akan disimpan sebagai status data.`}
        confirmText="Ya, Tolak"
        variant="destructive"
        loading={isSubmitting}
      />
    </div>
  );
}

function InfoItem({
  label,
  value,
  icon,
  fullWidth = false,
  highLight = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  fullWidth?: boolean;
  highLight?: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-1.5 p-5 bg-slate-50/30 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:bg-white",
        fullWidth && "sm:col-span-2",
      )}
    >
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-1">
        <div className="p-1 bg-white rounded border border-slate-100">
          {icon}
        </div>
        {label}
      </span>
      <div
        className={cn(
          "text-sm font-semibold text-slate-700 leading-relaxed",
          highLight && "text-primary text-base",
        )}
      >
        {value || "-"}
      </div>
    </div>
  );
}
