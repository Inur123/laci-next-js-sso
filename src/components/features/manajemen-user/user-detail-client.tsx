"use client";

import { useState, useEffect, useRef } from "react";
import {
  toggleUserStatus,
  deleteUser,
  resetUserPassword,
  getUserDetail,
} from "@/app/actions/auth-actions";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Trash2,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Mail,
  Calendar,
  ArrowLeft,
  User as UserIcon,
  Shield,
  Timer,
  FileCheck,
  FolderOpen,
  FileText,
  History as HistoryIcon,
  Users,
  GraduationCap,
  School,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConfirmModal } from "@/components/shared/confirm-modal";

type UserDetail = {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  isActive: boolean;
  image?: string | null;
  emailVerified?: boolean | null;
  createdAt: Date | string;
  periodeAktif?: string | null;
  totalArsip?: number | null;
  totalPengajuan?: number | null;
  totalAnggota?: number | null;
  totalBerkasPimpinan?: number | null;
  totalLog?: number | null;
  perkaderanCounts?: {
    Makesta: number;
    Lakmud: number;
    Latin: number;
    Latpel: number;
    Lakut: number;
    Diklatama: number;
    Diklatmad: number;
  };
  pendidikanCounts?: {
    SD: number;
    MI: number;
    SMP: number;
    MTs: number;
    SMA: number;
    SMK: number;
    MAN: number;
    KULIAH: number;
  };
  perkaderans?: Array<{
    id: string;
    namaPerkaderan: string;
    tanggal: Date | string;
    tempat: string;
  }>;
};

export default function UserDetailClient({
  user: initialUser,
}: {
  user: UserDetail;
}) {
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserDetail>(initialUser);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
        userId?: string;
      };

      // Refresh if any mutation happens (could affect stats) or specific user logs
      if (!detail || (detail.type !== "mutation" && detail.type !== "log"))
        return;
      if (realtimeTimerRef.current) return;

      realtimeTimerRef.current = setTimeout(async () => {
        realtimeTimerRef.current = null;
        const fresh = await getUserDetail(initialUser.id);
        if (fresh) {
          setCurrentUser(fresh as any);
        }
      }, 300);
    };

    window.addEventListener("laci-realtime", handler as EventListener);

    return () => {
      window.removeEventListener("laci-realtime", handler as EventListener);
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
      }
    };
  }, [initialUser.id]);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: "default" | "destructive";
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });
  const router = useRouter();

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

  const closeConfirm = () =>
    setModalConfig((prev) => ({ ...prev, isOpen: false }));

  async function handleToggleStatus() {
    closeConfirm();
    setLoading(true);
    const result = await toggleUserStatus(currentUser.id);
    if (result.error) {
      toast.error(result.error);
    } else if (result.success) {
      toast.success(result.success);
      setCurrentUser({ ...currentUser, isActive: !currentUser.isActive });
      router.refresh();
    }
    setLoading(false);
  }

  async function handleDelete() {
    closeConfirm();
    setLoading(true);
    const result = await deleteUser(currentUser.id);
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
    } else if (result.success) {
      toast.success(result.success);
      router.push("/dashboard/manajemen-user");
      router.refresh();
    }
  }

  async function handleResetPassword() {
    closeConfirm();
    setLoading(true);
    const result = await resetUserPassword(currentUser.id);
    setLoading(false);
    if (result.error) toast.error(result.error);
    else if (result.success) toast.success(result.success);
  }

  const openDeleteConfirm = () => {
    setModalConfig({
      isOpen: true,
      title: "Hapus User Permanen?",
      description: `Apakah Anda yakin ingin menghapus akun ${capitalizeName(currentUser.name)} secara permanen? Data yang telah dihapus tidak dapat dikembalikan.`,
      onConfirm: handleDelete,
      variant: "destructive",
    });
  };

  const openResetConfirm = () => {
    setModalConfig({
      isOpen: true,
      title: "Reset Password?",
      description: `Password untuk user ${capitalizeName(currentUser.name)} akan diubah menjadi default: "password".`,
      onConfirm: handleResetPassword,
      variant: "default",
    });
  };

  const openToggleConfirm = () => {
    const action = currentUser.isActive ? "Nonaktifkan" : "Aktifkan";
    setModalConfig({
      isOpen: true,
      title: `${action} Akun?`,
      description: `Apakah Anda yakin ingin ${action.toLowerCase()} akun ${capitalizeName(currentUser.name)}?`,
      onConfirm: handleToggleStatus,
      variant: currentUser.isActive ? "destructive" : "default",
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/manajemen-user">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">
              Detail Pengguna
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              Kelola informasi dan hak akses pengguna
            </p>
          </div>
        </div>
      </div>

      <Card className="border shadow-sm overflow-hidden w-full">
        <div className="grid md:grid-cols-[280px_1fr]">
          {/* Unified Profile Section */}
          <div className="bg-white p-8 border-r flex flex-col items-center text-center">
            <div className="relative group">
              <Avatar className="h-40 w-40 border-4 border-background shadow-xl">
                <AvatarImage
                  src={
                    currentUser.image?.startsWith("http")
                      ? currentUser.image
                      : currentUser.image
                        ? `/api/manajemen-user/${currentUser.id}/image?v=${currentUser.image}`
                        : ""
                  }
                  className="object-cover"
                />
                <AvatarFallback className="text-4xl bg-slate-100 text-slate-500 font-bold">
                  {getInitials(currentUser.name || "User")}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="mt-6 flex flex-col items-center gap-2">
              <div className="text-xl font-bold text-slate-900">
                {capitalizeName(currentUser.name)}
              </div>
              <Badge
                variant="outline"
                className="bg-blue-100/80 text-blue-700 border-blue-200 hover:bg-blue-200/80"
              >
                {currentUser.role?.replace("_", " ")}
              </Badge>
              <Badge
                variant="outline"
                className={`mt-1 shadow-none ${
                  currentUser.isActive
                    ? "bg-emerald-100/80 text-emerald-700 border-emerald-200 hover:bg-emerald-200/80"
                    : "bg-red-100/80 text-red-700 border-red-200 hover:bg-red-200/80"
                }`}
              >
                {currentUser.isActive ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>
            <p className="mt-8 text-[9px] text-slate-400 font-medium uppercase tracking-[0.2em] break-all px-4">
              ID USER: {currentUser.id}
            </p>
          </div>

          {/* Details & Actions Section */}
          <div className="p-8 space-y-8">
            <div className="grid gap-8">
              {/* Info Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-900">
                  <UserIcon size={18} className="text-primary" />
                  Informasi Akun
                </h3>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-1.5 p-4 bg-white rounded-lg border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Mail size={12} /> Alamat Email
                    </span>
                    <div className="text-sm font-medium text-slate-700 flex flex-col gap-1">
                      {currentUser.email}
                      <Badge
                        variant="outline"
                        className={`w-fit text-[10px] px-2 py-0 h-5 ${
                          currentUser.emailVerified
                            ? "bg-emerald-50 text-green-600 border-emerald-200"
                            : "bg-amber-50 text-amber-600 border-amber-200"
                        }`}
                      >
                        {currentUser.emailVerified ? (
                          <div className="flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Terverifikasi
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" />
                            Belum Verifikasi
                          </div>
                        )}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1.5 p-4 bg-white rounded-lg border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Calendar size={12} /> Tanggal Terdaftar
                    </span>
                    <div className="text-sm font-medium text-slate-700">
                      {new Date(currentUser.createdAt).toLocaleDateString(
                        "id-ID",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistik Section */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-900">
                  <Timer size={18} className="text-primary" />
                  Statistik Aktivitas
                </h3>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5 p-4 bg-blue-50/30 rounded-lg border border-blue-100">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1">
                      <Timer size={12} /> Periode Aktif
                    </span>
                    <div className="text-sm font-medium text-slate-700 truncate">
                      {currentUser.periodeAktif}
                    </div>
                  </div>
                  <div className="space-y-1.5 p-4 bg-emerald-50/30 rounded-lg border border-emerald-100">
                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest flex items-center gap-1">
                      <FileCheck size={12} /> Arsip Surat
                    </span>
                    <div className="text-sm font-medium text-slate-700">
                      <NumberTicker value={currentUser.totalArsip ?? 0} /> Surat
                    </div>
                  </div>
                  <div className="space-y-1.5 p-4 bg-purple-50/30 rounded-lg border border-purple-100">
                    <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest flex items-center gap-1">
                      <FileText size={12} /> Pengajuan PAC
                    </span>
                    <div className="text-sm font-medium text-slate-700">
                      <NumberTicker value={currentUser.totalPengajuan ?? 0} />{" "}
                      Pengajuan
                    </div>
                  </div>
                  <div className="space-y-1.5 p-4 bg-indigo-50/30 rounded-lg border border-indigo-100">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                      <Users size={12} /> Data Anggota
                    </span>
                    <div className="text-sm font-medium text-slate-700">
                      <NumberTicker value={currentUser.totalAnggota ?? 0} />{" "}
                      Anggota
                    </div>
                  </div>
                  <div className="space-y-1.5 p-4 bg-amber-50/30 rounded-lg border border-amber-100">
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1">
                      <FolderOpen size={12} /> Berkas Pimpinan
                    </span>
                    <div className="text-sm font-medium text-slate-700">
                      <NumberTicker
                        value={currentUser.totalBerkasPimpinan ?? 0}
                      />{" "}
                      Berkas
                    </div>
                  </div>
                  <div className="space-y-1.5 p-4 bg-rose-50/30 rounded-lg border border-rose-100">
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1">
                      <HistoryIcon size={12} /> Riwayat Log
                    </span>
                    <div className="text-sm font-medium text-slate-700">
                      <NumberTicker value={currentUser.totalLog ?? 0} />{" "}
                      Aktivitas
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistik Perkaderan Section */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-900">
                  <GraduationCap size={18} className="text-primary" />
                  Statistik Perkaderan
                </h3>
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                  {/* Makesta */}
                  <div className="space-y-1.5 p-4 bg-purple-50/30 rounded-lg border border-purple-100 flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-purple-500 uppercase tracking-widest flex items-center gap-1">
                      <GraduationCap size={12} className="shrink-0" /> Makesta
                    </span>
                    <div className="text-sm font-bold text-slate-700 flex items-center gap-1">
                      <NumberTicker
                        value={currentUser.perkaderanCounts?.Makesta || 0}
                      />
                      <span className="text-[10px] font-medium opacity-70">
                        Anggota
                      </span>
                    </div>
                  </div>
                  {/* Lakmud */}
                  <div className="space-y-1.5 p-4 bg-emerald-50/30 rounded-lg border border-emerald-100 flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-green-600 uppercase tracking-widest flex items-center gap-1">
                      <GraduationCap size={12} className="shrink-0" /> Lakmud
                    </span>
                    <div className="text-sm font-bold text-slate-700 flex items-center gap-1">
                      <NumberTicker
                        value={currentUser.perkaderanCounts?.Lakmud || 0}
                      />
                      <span className="text-[10px] font-medium opacity-70">
                        Anggota
                      </span>
                    </div>
                  </div>
                  {/* Latin */}
                  <div className="space-y-1.5 p-4 bg-blue-50/30 rounded-lg border border-blue-100 flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1">
                      <GraduationCap size={12} className="shrink-0" /> Latin
                    </span>
                    <div className="text-sm font-bold text-slate-700 flex items-center gap-1">
                      <NumberTicker
                        value={currentUser.perkaderanCounts?.Latin || 0}
                      />
                      <span className="text-[10px] font-medium opacity-70">
                        Anggota
                      </span>
                    </div>
                  </div>
                  {/* Latpel */}
                  <div className="space-y-1.5 p-4 bg-cyan-50/30 rounded-lg border border-cyan-100 flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-cyan-600 uppercase tracking-widest flex items-center gap-1">
                      <GraduationCap size={12} className="shrink-0" /> Latpel
                    </span>
                    <div className="text-sm font-bold text-slate-700 flex items-center gap-1">
                      <NumberTicker
                        value={currentUser.perkaderanCounts?.Latpel || 0}
                      />
                      <span className="text-[10px] font-medium opacity-70">
                        Anggota
                      </span>
                    </div>
                  </div>
                  {/* Lakut */}
                  <div className="space-y-1.5 p-4 bg-indigo-50/30 rounded-lg border border-indigo-100 flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                      <GraduationCap size={12} className="shrink-0" /> Lakut
                    </span>
                    <div className="text-sm font-bold text-slate-700 flex items-center gap-1">
                      <NumberTicker
                        value={currentUser.perkaderanCounts?.Lakut || 0}
                      />
                      <span className="text-[10px] font-medium opacity-70">
                        Anggota
                      </span>
                    </div>
                  </div>
                  {/* Diklatama */}
                  <div className="space-y-1.5 p-4 bg-orange-50/30 rounded-lg border border-orange-100 flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-1">
                      <GraduationCap size={12} className="shrink-0" /> Diklatama
                    </span>
                    <div className="text-sm font-bold text-slate-700 flex items-center gap-1">
                      <NumberTicker
                        value={currentUser.perkaderanCounts?.Diklatama || 0}
                      />
                      <span className="text-[10px] font-medium opacity-70">
                        Anggota
                      </span>
                    </div>
                  </div>
                  {/* Diklatmad */}
                  <div className="space-y-1.5 p-4 bg-rose-50/30 rounded-lg border border-rose-100 flex flex-col justify-between">
                    <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1">
                      <GraduationCap size={12} className="shrink-0" /> Diklatmad
                    </span>
                    <div className="text-sm font-bold text-slate-700 flex items-center gap-1">
                      <NumberTicker
                        value={currentUser.perkaderanCounts?.Diklatmad || 0}
                      />
                      <span className="text-[10px] font-medium opacity-70">
                        Anggota
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistik Pendidikan Section */}
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-900">
                  <School size={18} className="text-primary" />
                  Statistik Pendidikan
                </h3>
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 text-left">
                  {[
                    {
                      id: "SD",
                      bg: "bg-slate-50/80",
                      border: "border-slate-200",
                      text: "text-slate-600",
                    },
                    {
                      id: "MI",
                      bg: "bg-sky-50/80",
                      border: "border-sky-200",
                      text: "text-sky-600",
                    },
                    {
                      id: "SMP",
                      bg: "bg-orange-50/80",
                      border: "border-orange-200",
                      text: "text-orange-600",
                    },
                    {
                      id: "MTs",
                      bg: "bg-amber-50/80",
                      border: "border-amber-200",
                      text: "text-amber-600",
                    },
                    {
                      id: "SMA",
                      bg: "bg-lime-50/80",
                      border: "border-lime-200",
                      text: "text-lime-600",
                    },
                    {
                      id: "SMK",
                      bg: "bg-emerald-50/80",
                      border: "border-emerald-200",
                      text: "text-emerald-600",
                    },
                    {
                      id: "MAN",
                      bg: "bg-teal-50/80",
                      border: "border-teal-200",
                      text: "text-teal-600",
                    },
                    {
                      id: "KULIAH",
                      bg: "bg-blue-50/80",
                      border: "border-blue-200",
                      text: "text-blue-600",
                    },
                  ].map((item) => (
                    <div
                      key={item.id}
                      className={`space-y-1.5 p-4 ${item.bg} rounded-lg border ${item.border} flex flex-col justify-between`}
                    >
                      <span
                        className={`text-[10px] font-bold ${item.text} uppercase tracking-widest flex items-center gap-1.5`}
                      >
                        <School size={12} className="shrink-0" />
                        <span className="truncate">{item.id}</span>
                      </span>
                      <div className="text-sm font-bold text-slate-700">
                        <NumberTicker
                          value={
                            currentUser.pendidikanCounts?.[
                              item.id as keyof typeof currentUser.pendidikanCounts
                            ] || 0
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

                </div>
              </div>
            
          
        
      </Card>

      <ConfirmModal
        isOpen={modalConfig.isOpen}
        onClose={closeConfirm}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        description={modalConfig.description}
        variant={modalConfig.variant}
        loading={loading}
      />
    </div>
  );
}
