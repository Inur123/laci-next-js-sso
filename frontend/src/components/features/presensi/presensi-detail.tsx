"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Building,
  Clock,
  QrCode,
  Download,
  Users,
  ExternalLink,
  Pencil,
  Search,
  RefreshCcw,
  FileSpreadsheet,
  Maximize2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QRCodeSVG } from "qrcode.react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getPresensiDetail } from "@/app/actions/presensi-actions";
import { isPresensiOpen } from "@/lib/presensi-utils";
import { logExport } from "@/app/actions/log-activity-actions";
import XLSX from "xlsx-js-style";
import { PresensiFullscreenPresentation } from "./presensi-fullscreen-presentation";

interface PresensiDetailProps {
  presensi: any;
  userRole?: string;
}

const capitalizeName = (name: string) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export function PresensiDetail({
  presensi,
  userRole = "SEKRETARIS_PAC",
}: PresensiDetailProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const fullscreenOverlayRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [mounted, setMounted] = useState(false);
  const [dataPresensi, setDataPresensi] = useState<any[]>(
    presensi.dataPresensi ?? [],
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [tickValue, setTick] = useState(0);
  const itemsPerPage = 10;
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sort state for attendance table
  type AttSortKey =
    | "namaLengkap"
    | "organisasi"
    | "createdAt"
    | "tingkat"
    | "jabatan";
  type AttSortDir = "asc" | "desc";
  const [attSortKey, setAttSortKey] = useState<AttSortKey | null>("createdAt");
  const [attSortDir, setAttSortDir] = useState<AttSortDir>("desc");

  const handleAttSort = (key: AttSortKey) => {
    setCurrentPage(1);
    if (attSortKey === key) {
      setAttSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setAttSortKey(key);
      setAttSortDir("asc");
    }
  };

  const AttSortIcon = ({ col }: { col: AttSortKey }) => {
    if (attSortKey !== col)
      return (
        <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 text-slate-400 inline-block" />
      );
    return attSortDir === "asc" ? (
      <ArrowUp className="ml-1.5 h-3.5 w-3.5 text-slate-600 inline-block" />
    ) : (
      <ArrowDown className="ml-1.5 h-3.5 w-3.5 text-slate-600 inline-block" />
    );
  };

  // Set URL hanya di client untuk menghindari hydration mismatch
  useEffect(() => {
    setPublicUrl(`${window.location.origin}/presensi/${presensi.id}`);
    setMounted(true);
  }, [presensi.id]);

  // Real-time clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    tick();
    const interval = setInterval(() => {
      tick();
      setTick((t) => t + 1); // Internal tick for live status updates
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Escape key to close fullscreen (manual key listener for fallback)
  // Removed — browser Fullscreen API handles Escape natively

  // Sync isFullscreen state when user exits via browser Escape or other means
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Open native browser fullscreen
  const openFullscreen = useCallback(() => {
    setIsFullscreen(true);
    // Wait for overlay to mount in DOM, then request fullscreen on it
    setTimeout(() => {
      const el = fullscreenOverlayRef.current;
      if (el?.requestFullscreen) {
        el.requestFullscreen().catch(() => {
          // Fallback: keep as fixed overlay if browser blocks fullscreen
        });
      }
    }, 50);
  }, []);

  // Close native browser fullscreen
  const closeFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);
  }, []);

  // Fetch fresh attendance data
  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const fresh = await getPresensiDetail(presensi.id);
      if (fresh) setDataPresensi(fresh.dataPresensi ?? []);
    } catch {
      // silent
    } finally {
      setIsRefreshing(false);
    }
  }, [presensi.id]);

  // Realtime listener – listen PresensiData mutations
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
        module?: string;
        action?: string;
        presensiId?: string;
        entityId?: string;
      };

      // 1. Perbarui melalui event realtime dari Go API.
      const isMutation =
        detail.type === "mutation" &&
        (detail.model?.toLowerCase() === "presensidata" ||
          detail.model?.toLowerCase() === "presensi");

      // 2. Cek via Log (Manual Notification)
      const isLog =
        detail.type === "log" &&
        detail.module === "PRESENSI" &&
        (detail.action === "CREATE" || detail.action === "UPDATE") &&
        (detail.entityId === presensi.id || detail.presensiId === presensi.id);

      if (!isMutation && !isLog) return;

      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        fetchData();
      }, 500);
    };
    window.addEventListener("laci-realtime", handler as EventListener);
    return () => {
      window.removeEventListener("laci-realtime", handler as EventListener);
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
    };
  }, [fetchData]);

  const downloadQr = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const scale = 5; // 5x resolution – sangat tajam
    const qrDisplaySize = 260;
    const marginPx = Math.round(qrDisplaySize * 0.09); // ~9% margin
    const svgSize = qrDisplaySize + marginPx * 2;
    const canvasSize = svgSize * scale;

    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const qrImg = new Image();
    qrImg.onload = () => {
      // 1. Draw white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      // 2. Draw QR code stretched to canvas
      ctx.drawImage(qrImg, 0, 0, canvasSize, canvasSize);

      // 3. Draw logo overlay in center
      const logoImg = new Image();
      logoImg.onload = () => {
        const logoSize = 62 * scale;
        const cx = canvasSize / 2;
        const cy = canvasSize / 2;
        const pad = 7 * scale;
        const bgW = logoSize + pad * 2;
        const bgH = logoSize + pad * 2;
        const rx = 10 * scale; // corner radius

        // White rounded rect background
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(cx - bgW / 2, cy - bgH / 2, bgW, bgH, rx);
        ctx.fill();

        // Thin border
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.roundRect(cx - bgW / 2, cy - bgH / 2, bgW, bgH, rx);
        ctx.stroke();

        // Draw logo centered
        ctx.drawImage(
          logoImg,
          cx - logoSize / 2,
          cy - logoSize / 2,
          logoSize,
          logoSize,
        );

        const pngFile = canvas.toDataURL("image/png", 1.0);
        const link = document.createElement("a");
        link.download = `QR-Presensi-${presensi.namaKegiatan}.png`;
        link.href = pngFile;
        link.click();
      };
      logoImg.src = "/images/logo-laci.webp";
    };
    qrImg.src =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svgData)));
  };

  // Warna sesuai role – biru untuk Cabang, hijau untuk PAC (sama seperti arsip surat)
  const iconColor =
    userRole === "SEKRETARIS_CABANG" ? "text-blue-600" : "text-green-600";
  const excelHeaderColor =
    userRole === "SEKRETARIS_CABANG" ? "2563eb" : "15803d";

  const handleExportExcel = () => {
    if (dataPresensi.length === 0) return;

    const dateStr = new Date().toLocaleDateString("id-ID").replace(/\//g, "-");
    const filename = `Presensi-${presensi.namaKegiatan}-${dateStr}.xlsx`;

    const exportData = dataPresensi.map((item: any, i: number) => ({
      No: i + 1,
      "Nama Lengkap": item.namaLengkap,
      Organisasi: item.organisasi === "UMUM" ? "Eksternal" : item.organisasi,
      Tingkat: item.tingkat || "-",
      Instansi: item.instansi || "-",
      Jabatan: item.jabatan || "-",
      "Waktu Absen": new Date(item.createdAt).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:G1");

    const headerStyle = {
      font: { name: "Arial", bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: excelHeaderColor } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: excelHeaderColor } },
        bottom: { style: "thin", color: { rgb: excelHeaderColor } },
        left: { style: "thin", color: { rgb: excelHeaderColor } },
        right: { style: "thin", color: { rgb: excelHeaderColor } },
      },
    };

    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C });
      if (worksheet[addr]) worksheet[addr].s = headerStyle;
    }

    const wscols = Object.keys(exportData[0] || {}).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...exportData.map(
          (row) => String(row[key as keyof typeof row] ?? "").length,
        ),
      );
      return { wch: Math.min(maxLen + 2, 50) };
    });
    worksheet["!cols"] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daftar Kehadiran");
    XLSX.writeFile(workbook, filename);
    logExport("AGENDA_KEGIATAN", filename);
  };

  return (
    <>
      <div className="space-y-6">
        {/* ── Header – sama style dengan arsip-surat-detail ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/dashboard/presensi">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">
                Detail Presensi
              </h1>
              <p className="text-sm text-muted-foreground truncate">
                Pantau daftar kehadiran dan QR Code untuk kegiatan ini.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              asChild
              className="flex-1 sm:flex-initial"
            >
              <Link href={`/dashboard/presensi/${presensi.id}/edit`}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Info Detail */}
          <Card className="lg:col-span-2 border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl font-bold text-slate-800">
                    {capitalizeName(presensi.namaKegiatan)}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Detail informasi kegiatan presensi
                  </CardDescription>
                </div>
                {(() => {
                  const isOpen = isPresensiOpen(presensi);
                  return (
                    <Badge
                      variant="outline"
                      className={cn(
                        "transition-all duration-300",
                        isOpen
                          ? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200"
                          : "bg-red-100 text-red-600 hover:bg-red-100 border-red-200",
                      )}
                    >
                      {isOpen ? "Presensi Dibuka" : "Presensi Ditutup"}
                    </Badge>
                  );
                })()}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${userRole === "SEKRETARIS_CABANG" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"}`}
                  >
                    <Building size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Penyelenggara
                    </p>
                    <p className="text-slate-700 font-medium">
                      {capitalizeName(presensi.penyelenggara)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${userRole === "SEKRETARIS_CABANG" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"}`}
                  >
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Lokasi / Tempat
                    </p>
                    <p className="text-slate-700 font-medium">
                      {capitalizeName(presensi.tempat)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${userRole === "SEKRETARIS_CABANG" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"}`}
                  >
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tanggal
                    </p>
                    <p className="text-slate-700 font-medium">
                      {format(
                        new Date(presensi.tanggal),
                        "EEEE, dd MMMM yyyy",
                        {
                          locale: id,
                        },
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${userRole === "SEKRETARIS_CABANG" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"}`}
                  >
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Waktu
                    </p>
                    <p className="text-slate-700 font-medium">
                      {presensi.jamMulai} - {presensi.jamSelesai} WIB
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QR CODE CARD */}
          <Card
            className={`border-slate-200 shadow-sm border-t-4 ${userRole === "SEKRETARIS_CABANG" ? "border-t-blue-600" : "border-t-green-600"}`}
          >
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg font-bold flex items-center justify-center gap-2">
                <QrCode
                  className={`w-5 h-5 ${userRole === "SEKRETARIS_CABANG" ? "text-blue-600" : "text-green-600"}`}
                />
                QR Presensi
              </CardTitle>
              <CardDescription>Scan untuk melakukan absensi</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div
                ref={qrRef}
                className="relative p-4 bg-white border-2 border-slate-100 rounded-xl shadow-inner mb-4 inline-block"
              >
                {mounted ? (
                  <>
                    <QRCodeSVG
                      value={publicUrl}
                      size={260}
                      level="H"
                      includeMargin={true}
                    />
                    {/* Logo overlay – lebih besar = lebih tajam */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-white rounded-lg p-2 shadow-sm border border-slate-100">
                        <img
                          src="/images/logo-laci.webp"
                          alt="Laci"
                          width={52}
                          height={52}
                          className="rounded-md object-contain block"
                          style={{ imageRendering: "auto" }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-[260px] h-[260px] bg-slate-100 animate-pulse rounded-lg" />
                )}
              </div>
              <div className="w-full space-y-2">
                <Button
                  variant="default"
                  className={`w-full ${
                    userRole === "SEKRETARIS_CABANG"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-green-600 hover:bg-green-700"
                  } text-white`}
                  onClick={openFullscreen}
                >
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Layar Penuh
                </Button>
                <Button
                  variant="outline"
                  className={`w-full ${
                    userRole === "SEKRETARIS_CABANG"
                      ? "border-blue-200 text-blue-700 hover:bg-blue-50"
                      : "border-green-200 text-green-600 hover:bg-green-50"
                  }`}
                  onClick={downloadQr}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download QR
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-slate-500 text-xs"
                  asChild
                >
                  <Link href={`/presensi/${presensi.id}`} target="_blank">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Buka Link Absensi
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabel Kehadiran */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 border-b py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users
                  className={`w-5 h-5 ${userRole === "SEKRETARIS_CABANG" ? "text-blue-600" : "text-green-600"}`}
                />
                <CardTitle className="text-base font-bold whitespace-nowrap">
                  Daftar Kehadiran
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className="bg-white flex items-center gap-1.5"
              >
                {isRefreshing && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                )}
                Total: {dataPresensi.length} Peserta
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
              <div className="flex-1 w-full relative">
                <Label className="text-xs font-medium mb-1 block text-slate-500 uppercase tracking-wider font-bold">
                  Cari Peserta
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama, organisasi, atau jabatan..."
                    className="pl-9 w-full bg-white h-9 text-sm border-slate-200"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full md:flex md:w-auto md:items-end md:gap-3">
                <Button
                  variant="outline"
                  className="h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm"
                  onClick={handleExportExcel}
                  disabled={dataPresensi.length === 0}
                >
                  <FileSpreadsheet
                    className={cn("mr-2 h-3.5 w-3.5", iconColor)}
                  />
                  Export
                </Button>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm transition-all duration-200",
                    searchTerm
                      ? "text-slate-900 border-slate-300"
                      : "text-slate-400 border-slate-200 opacity-50 cursor-not-allowed",
                  )}
                  onClick={() => {
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  disabled={!searchTerm}
                >
                  <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
            </div>

            <div className="rounded-md border">
              <div className="relative overflow-auto max-h-[600px]">
                <Table className="min-w-[700px]">
                  <TableHeader className="sticky top-0 bg-white z-10 h-11">
                    <TableRow>
                      <TableHead className="w-[50px] text-center bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11">
                        No
                      </TableHead>
                      <TableHead
                        className="bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleAttSort("namaLengkap")}
                      >
                        <span className="inline-flex items-center">
                          Nama Lengkap
                          <AttSortIcon col="namaLengkap" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="w-[110px] bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleAttSort("organisasi")}
                      >
                        <span className="inline-flex items-center">
                          Organisasi
                          <AttSortIcon col="organisasi" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="w-[130px] bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleAttSort("tingkat")}
                      >
                        <span className="inline-flex items-center">
                          Tingkat
                          <AttSortIcon col="tingkat" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleAttSort("jabatan")}
                      >
                        <span className="inline-flex items-center">
                          Jabatan / Instansi
                          <AttSortIcon col="jabatan" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="w-[120px] text-center bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                        onClick={() => handleAttSort("createdAt")}
                      >
                        <span className="inline-flex items-center justify-center">
                          Waktu Absen
                          <AttSortIcon col="createdAt" />
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const filtered = dataPresensi.filter((item: any) => {
                        if (!searchTerm) return true;
                        const q = searchTerm.toLowerCase();
                        return (
                          item.namaLengkap?.toLowerCase().includes(q) ||
                          item.organisasi?.toLowerCase().includes(q) ||
                          item.jabatan?.toLowerCase().includes(q) ||
                          item.instansi?.toLowerCase().includes(q) ||
                          item.tingkat?.toLowerCase().includes(q)
                        );
                      });

                      const sorted = [...filtered].sort((a: any, b: any) => {
                        if (!attSortKey) return 0;
                        if (attSortKey === "createdAt") {
                          const aT = new Date(a.createdAt).getTime();
                          const bT = new Date(b.createdAt).getTime();
                          return attSortDir === "asc" ? aT - bT : bT - aT;
                        }
                        // jabatan/instansi column uses jabatan or instansi depending on organisasi
                        const getVal = (item: any) => {
                          if (attSortKey === "jabatan")
                            return (
                              (item.organisasi === "UMUM"
                                ? item.instansi
                                : item.jabatan) ?? ""
                            );
                          return item[attSortKey] ?? "";
                        };
                        const aVal = getVal(a).toString().toLowerCase();
                        const bVal = getVal(b).toString().toLowerCase();
                        if (aVal < bVal) return attSortDir === "asc" ? -1 : 1;
                        if (aVal > bVal) return attSortDir === "asc" ? 1 : -1;
                        return 0;
                      });

                      const totalItems = sorted.length;
                      const totalPages = Math.ceil(totalItems / itemsPerPage);
                      const visibleData = sorted.slice(
                        (currentPage - 1) * itemsPerPage,
                        currentPage * itemsPerPage,
                      );

                      if (visibleData.length === 0) {
                        return (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="h-32 text-center text-muted-foreground"
                            >
                              {searchTerm
                                ? "Tidak ada peserta yang cocok dengan pencarian."
                                : "Belum ada peserta yang melakukan presensi."}
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return (
                        <>
                          {visibleData.map((item: any, index: number) => (
                            <TableRow
                              key={item.id}
                              className="hover:bg-slate-50/50"
                            >
                              <TableCell className="text-center font-medium text-muted-foreground whitespace-nowrap">
                                {(currentPage - 1) * itemsPerPage + index + 1}
                              </TableCell>
                              <TableCell className="font-bold text-slate-900 capitalize">
                                {capitalizeName(item.namaLengkap)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "font-semibold",
                                    item.organisasi === "IPNU"
                                      ? "bg-emerald-100/80 text-emerald-700 border-emerald-200"
                                      : item.organisasi === "IPPNU"
                                        ? "bg-rose-100/80 text-rose-700 border-rose-200"
                                        : "bg-slate-100/80 text-slate-700 border-slate-200",
                                  )}
                                >
                                  {item.organisasi === "UMUM"
                                    ? "Eksternal"
                                    : item.organisasi}
                                </Badge>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {item.tingkat || "-"}
                              </TableCell>
                              <TableCell className="text-slate-600 text-sm">
                                {capitalizeName(
                                  item.organisasi === "UMUM"
                                    ? item.instansi
                                    : item.jabatan,
                                )}
                              </TableCell>
                              <TableCell className="text-center text-xs text-muted-foreground whitespace-nowrap">
                                {format(new Date(item.createdAt), "HH:mm:ss", {
                                  locale: id,
                                })}
                              </TableCell>
                            </TableRow>
                          ))}

                          {/* Pagination Row - Consistent with other modules */}
                          {totalPages >= 1 && (
                            <TableRow className="hover:bg-transparent border-t bg-slate-50/30">
                              <TableCell colSpan={6} className="p-0">
                                <div className="flex items-center justify-between px-4 py-2">
                                  <p className="text-xs text-muted-foreground hidden sm:block">
                                    Menampilkan{" "}
                                    <span className="font-medium text-slate-700">
                                      {(currentPage - 1) * itemsPerPage + 1}
                                    </span>{" "}
                                    sampai{" "}
                                    <span className="font-medium text-slate-700">
                                      {Math.min(
                                        currentPage * itemsPerPage,
                                        totalItems,
                                      )}
                                    </span>{" "}
                                    dari{" "}
                                    <span className="font-medium text-slate-700">
                                      {totalItems}
                                    </span>{" "}
                                    peserta
                                  </p>
                                  <Pagination className="mx-0 w-auto scale-90 sm:scale-100 origin-right">
                                    <PaginationContent>
                                      <PaginationItem>
                                        <PaginationPrevious
                                          href="#"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            if (currentPage > 1)
                                              setCurrentPage(currentPage - 1);
                                          }}
                                          className={
                                            currentPage === 1
                                              ? "pointer-events-none opacity-50"
                                              : "cursor-pointer"
                                          }
                                        />
                                      </PaginationItem>

                                      {[...Array(totalPages)].map((_, i) => {
                                        const page = i + 1;
                                        if (
                                          page === 1 ||
                                          page === totalPages ||
                                          (page >= currentPage - 1 &&
                                            page <= currentPage + 1)
                                        ) {
                                          return (
                                            <PaginationItem key={page}>
                                              <PaginationLink
                                                href="#"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  setCurrentPage(page);
                                                }}
                                                isActive={currentPage === page}
                                                className="cursor-pointer"
                                              >
                                                {page}
                                              </PaginationLink>
                                            </PaginationItem>
                                          );
                                        } else if (
                                          page === currentPage - 2 ||
                                          page === currentPage + 2
                                        ) {
                                          return (
                                            <PaginationEllipsis key={page} />
                                          );
                                        }
                                        return null;
                                      })}

                                      <PaginationItem>
                                        <PaginationNext
                                          href="#"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            if (currentPage < totalPages)
                                              setCurrentPage(currentPage + 1);
                                          }}
                                          className={
                                            currentPage === totalPages
                                              ? "pointer-events-none opacity-50"
                                              : "cursor-pointer"
                                          }
                                        />
                                      </PaginationItem>
                                    </PaginationContent>
                                  </Pagination>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })()}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── FULLSCREEN PRESENTATION MODE ── */}
      {isFullscreen && (
        <PresensiFullscreenPresentation
          presensi={presensi}
          dataPresensi={dataPresensi}
          publicUrl={publicUrl}
          currentTime={currentTime}
          isRefreshing={isRefreshing}
          userRole={userRole}
          closeFullscreen={closeFullscreen}
          fullscreenOverlayRef={fullscreenOverlayRef}
        />
      )}
    </>
  );
}
