"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  Pencil,
  Trash2,
  Search,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  deletePengajuanBerkas,
  getPengajuanBerkass,
  getVerifikasiPengajuanForCabang,
  getPengajuanForReferensiPac,
} from "@/app/actions/pengajuan-berkas-actions";
import { logExport } from "@/app/actions/log-activity-actions";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { toast } from "sonner";
import { cn, capitalizeName } from "@/lib/utils";
import XLSX from "xlsx-js-style";
import { UserFilterSelect } from "@/components/shared/user-filter-select";

type PengajuanBerkas = {
  id: string;
  noSurat: string;
  penerima: string;
  tanggal: Date;
  keperluan: string;
  deskripsi: string | null;
  status: string;
  alasanPenolakan: string | null;
  userId?: string;
  user?: {
    name: string;
    email: string;
  };
  periodePac?: {
    nama: string;
  };
};

type PacUser = {
  id: string;
  name: string;
};

const statusConfig = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    className:
      "bg-amber-100/80 text-amber-700 border-amber-200 hover:bg-amber-200/80",
  },
  DITERIMA: {
    label: "Diterima",
    icon: CheckCircle,
    className:
      "bg-green-100/80 text-green-700 border-green-200 hover:bg-green-200/80",
  },
  DITOLAK: {
    label: "Ditolak",
    icon: XCircle,
    className: "bg-red-100/80 text-red-700 border-red-200 hover:bg-red-200/80",
  },
};

const penerimaConfig: Record<string, { label: string; className: string }> = {
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
  CBP_KPP: {
    label: "CBP KPP",
    className:
      "bg-amber-100/80 text-amber-700 border-amber-200 hover:bg-amber-200/80",
  },
};

export function PengajuanBerkasList({
  pengajuanList: initialPengajuanList,
  userRole,
  pacUsers = [],
  totalPages: initialTotalPages,
  currentPage: initialCurrentPage,
  totalItems: initialTotalItems,
  viewMode,
  showExport = true,
  detailBasePath = "/dashboard/pengajuan-berkas",
  actionsInlineOnDesktop = false,
}: {
  pengajuanList: PengajuanBerkas[];
  userRole: string;
  pacUsers?: PacUser[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
  viewMode?: "pac" | "cabang" | "referensi";
  showExport?: boolean;
  detailBasePath?: string;
  actionsInlineOnDesktop?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local data state
  const [data, setData] = useState<PengajuanBerkas[]>(initialPengajuanList);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [totalItems, setTotalItems] = useState(initialTotalItems);

  // Sync state with props (important for URL changes and statistics update)
  useEffect(() => {
    setData(initialPengajuanList);
    setTotalPages(initialTotalPages);
    setCurrentPage(initialCurrentPage);
    setTotalItems(initialTotalItems);
  }, [
    initialPengajuanList,
    initialTotalPages,
    initialCurrentPage,
    initialTotalItems,
  ]);

  // CONFETTI EFFECT
  useEffect(() => {
    if (searchParams.get("confetti") === "true") {
      import("canvas-confetti").then((confetti) => {
        // Sekali tembak meriam dari tengah bawah (Corong Kecil ke Atas Besar)
        confetti.default({
          particleCount: 300,
          angle: 90,
          spread: 100,
          origin: { x: 0.5, y: 1 },
          startVelocity: 80,
          gravity: 0.4,
          ticks: 500,
          scalar: 0.8, // Ukuran diperkecil agar lebih halus (agak kecil)
          zIndex: 9999,
          colors: [
            "#22c55e",
            "#3b82f6",
            "#f59e0b",
            "#ef4444",
            "#ec4899",
            "#8b5cf6",
          ],
        });
      });

      // Hapus parameter confetti dari URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete("confetti");
      const newUrl = params.toString()
        ? `?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [searchParams]);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [penerimaFilter, setPenerimaFilter] = useState("ALL");
  const [pacFilter, setPacFilter] = useState(
    searchParams.get("userId") || "ALL",
  );

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [optimisticHiddenIds, setOptimisticHiddenIds] = useState<string[]>([]);

  const [isDeleting, setIsDeleting] = useState(false);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sort state
  type SortKey = "noSurat" | "tanggal" | "keperluan" | "penerima" | "status";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey | null>("tanggal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col)
      return (
        <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 text-slate-400 inline-block" />
      );
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1.5 h-3.5 w-3.5 text-slate-600 inline-block" />
    ) : (
      <ArrowDown className="ml-1.5 h-3.5 w-3.5 text-slate-600 inline-block" />
    );
  };

  // Data sudah diurutkan dari server
  const sortedDisplayedItems = data.filter(
    (item) => !optimisticHiddenIds.includes(item.id),
  );

  const resolvedViewMode =
    viewMode || (userRole === "SEKRETARIS_CABANG" ? "cabang" : "pac");
  const isCabangView = resolvedViewMode !== "pac";

  const isFirstRender = useRef(true);

  const fetchData = useCallback(
    async (
      query: string,
      status: string,
      penerima: string,
      pac: string,
      page: number,
      sKey: SortKey | null = sortKey,
      sDir: SortDir = sortDir,
    ) => {
      try {
        let result;
        if (resolvedViewMode === "cabang") {
          result = await getVerifikasiPengajuanForCabang(
            query,
            page,
            10,
            status,
            penerima,
            pac,
            sKey,
            sDir,
          );
        } else if (resolvedViewMode === "referensi") {
          result = await getPengajuanForReferensiPac(
            query,
            page,
            10,
            status,
            penerima,
            pac,
            sKey,
            sDir,
          );
        } else {
          result = await getPengajuanBerkass(
            query,
            page,
            10,
            status,
            penerima,
            sKey,
            sDir,
          );
        }

        setData(result.data as PengajuanBerkas[]);
        setTotalPages(result.totalPages);
        setTotalItems(result.total);
      } catch (error) {
        console.error("Error fetching data:", error);
        const errMsg = error instanceof Error ? error.message : String(error);
        if (
          !errMsg.includes("unexpected response") &&
          !errMsg.includes("NEXT_REDIRECT") &&
          !errMsg.includes("abort")
        ) {
          toast.error(`Gagal memuat data: ${errMsg}`);
        }
      }
    },
    [resolvedViewMode, sortKey, sortDir],
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchData(searchTerm, statusFilter, penerimaFilter, pacFilter, 1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, penerimaFilter, pacFilter, fetchData]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "PengajuanBerkas") return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        fetchData(
          searchTerm,
          statusFilter,
          penerimaFilter,
          pacFilter,
          currentPage,
        );
      }, 300);
    };
    window.addEventListener("laci-realtime", handler as EventListener);
    return () => {
      window.removeEventListener("laci-realtime", handler as EventListener);
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
    };
  }, [
    searchTerm,
    statusFilter,
    penerimaFilter,
    pacFilter,
    currentPage,
    fetchData,
  ]);

  const handleFilterChange = (key: string, value: string) => {
    if (key === "status") {
      setStatusFilter(value);
    }
    if (key === "penerima") {
      setPenerimaFilter(value);
    }
    if (key === "pac") {
      setPacFilter(value);

      // Update URL to trigger server-side re-render of statistics
      const params = new URLSearchParams(searchParams.toString());
      if (value === "ALL") {
        params.delete("userId");
      } else {
        params.set("userId", value);
      }
      params.set("page", "1");
      router.push(`?${params.toString()}`, { scroll: false });
    }

    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(searchTerm, statusFilter, penerimaFilter, pacFilter, page);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setPenerimaFilter("ALL");
    setPacFilter("ALL");
    setCurrentPage(1);
    fetchData("", "ALL", "ALL", "ALL", 1);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setIsDeleting(true);
    const id = confirmDeleteId;

    const result = await deletePengajuanBerkas(id);
    setIsDeleting(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      setConfirmDeleteId(null);
      setOptimisticHiddenIds((prev) => [...prev, id]);
      toast.success("Pengajuan berhasil dihapus");
      fetchData(
        searchTerm,
        statusFilter,
        penerimaFilter,
        pacFilter,
        currentPage,
      );
    }
  };

  const handleExportExcel = async () => {
    if (totalItems === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    toast.info("Menyiapkan data export...");

    const dateStr = new Date().toLocaleDateString("id-ID").replace(/\//g, "-");

    // Determine dynamic filename based on filter
    let pacName = "All";
    if (isCabangView && pacFilter !== "ALL") {
      const user = pacUsers.find((u) => u.id === pacFilter);
      if (user) pacName = user.name;
    }
    const safePacName = pacName.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Pengajuan_PAC_${safePacName}_${dateStr}.xlsx`;

    // Fetch ALL data (bypass pagination)
    let allData = data;
    if (totalItems > data.length) {
      try {
        let result;
        if (resolvedViewMode === "cabang") {
          result = await getVerifikasiPengajuanForCabang(
            searchTerm,
            1,
            9999,
            statusFilter,
            penerimaFilter,
            pacFilter,
          );
        } else if (resolvedViewMode === "referensi") {
          result = await getPengajuanForReferensiPac(
            searchTerm,
            1,
            9999,
            statusFilter,
            penerimaFilter,
            pacFilter,
          );
        } else {
          result = await getPengajuanBerkass(
            searchTerm,
            1,
            9999,
            statusFilter,
            penerimaFilter,
          );
        }
        allData = result.data as PengajuanBerkas[];
      } catch {
        toast.error("Gagal mengambil semua data untuk export");
        return;
      }
    }

    const exportData = allData.map((item, index) => {
      const row: Record<string, string | number> = {
        No: index + 1,
        "No Surat": item.noSurat,
        Penerima: penerimaConfig[item.penerima]?.label || item.penerima,
        Tanggal: new Date(item.tanggal).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        Keperluan: item.keperluan,
        Deskripsi: item.deskripsi || "-",
        Status:
          statusConfig[item.status as keyof typeof statusConfig]?.label ||
          item.status,
      };

      if (isCabangView) {
        row.Pengaju = item.user?.name || "-";
      }

      if (item.alasanPenolakan) {
        row["Alasan Penolakan"] = item.alasanPenolakan;
      }

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:G1");
    const headerColor = isCabangView ? "3b82f6" : "10b981";

    const headerStyle = {
      font: { name: "Arial", bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: headerColor } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: headerColor } },
        bottom: { style: "thin", color: { rgb: headerColor } },
        left: { style: "thin", color: { rgb: headerColor } },
        right: { style: "thin", color: { rgb: headerColor } },
      },
    };

    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: 0, c: C });
      if (worksheet[address]) worksheet[address].s = headerStyle;
    }

    // Auto-adjust column width based on content
    const wscols = Object.keys(exportData[0] || {}).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...exportData.map((row) => String(row[key] ?? "").length),
      );
      return { wch: Math.min(maxLen + 2, 50) }; // Cap width at 50, add padding
    });
    worksheet["!cols"] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pengajuan PAC");
    XLSX.writeFile(workbook, filename);
    logExport("PENGAJUAN_BERKAS", filename);
    toast.success("File excel berhasil didownload!");
  };

  const hasFilters =
    searchTerm !== "" ||
    statusFilter !== "ALL" ||
    penerimaFilter !== "ALL" ||
    pacFilter !== "ALL";

  return (
    <div className="flex flex-col">
      {/* Filter Section */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
        {/* Search */}
        <div className="flex-1 relative w-full">
          <Label className="text-xs font-medium mb-1 block">Cari Surat</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Contoh: Surat Rekomendasi"
              className="pl-9 w-full h-9 text-sm bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Status */}
        <div className="w-full md:w-36">
          <Label className="text-xs font-medium mb-1 block">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(val) => handleFilterChange("status", val)}
          >
            <SelectTrigger className="w-full h-9 text-sm bg-white">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="DITERIMA">Diterima</SelectItem>
              <SelectItem value="DITOLAK">Ditolak</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Penerima */}
        <div className="w-full md:w-36">
          <Label className="text-xs font-medium mb-1 block">Penerima</Label>
          <Select
            value={penerimaFilter}
            onValueChange={(val) => handleFilterChange("penerima", val)}
          >
            <SelectTrigger className="w-full h-9 text-sm bg-white">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              <SelectItem value="IPNU">IPNU</SelectItem>
              <SelectItem value="IPPNU">IPPNU</SelectItem>
              <SelectItem value="BERSAMA">BERSAMA</SelectItem>
              <SelectItem value="CBP_KPP">CBP KPP</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* PAC Filter - Cabang Only */}
        {isCabangView && pacUsers && pacUsers.length > 0 && (
          <div className="w-full md:w-64">
            <Label className="text-xs font-medium mb-1 block">Filter PAC</Label>
            <UserFilterSelect
              users={pacUsers}
              selectedUserId={pacFilter}
              onSelectUser={(val) => handleFilterChange("pac", val)}
              placeholder="Pilih PAC"
            />
          </div>
        )}

        {/* Actions Section */}
        <div
          className={cn(
            "grid gap-2 w-full",
            showExport
              ? "grid-cols-2 md:flex md:w-auto md:items-center md:justify-end md:gap-4 lg:justify-start"
              : "grid-cols-1",
          )}
        >
          {showExport && (
            <Button
              variant="outline"
              className="h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm whitespace-nowrap text-slate-600 hover:text-slate-900"
              onClick={handleExportExcel}
            >
              <FileSpreadsheet
                className={cn(
                  "mr-2 h-3.5 w-3.5",
                  userRole === "SEKRETARIS_CABANG"
                    ? "text-blue-600"
                    : "text-green-600",
                )}
              />
              Export
            </Button>
          )}
          <Button
            variant="outline"
            className={cn(
              "h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm whitespace-nowrap transition-all duration-200",
              hasFilters
                ? "text-slate-900 border-slate-300 opacity-100"
                : "text-slate-400 border-slate-200 opacity-50 cursor-not-allowed",
            )}
            onClick={handleClearFilters}
            disabled={!hasFilters}
          >
            <RefreshCcw className="mr-2 h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      <div className="relative">
        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <Table className="w-full table-fixed [&_td]:py-2 [&_th]:py-2">
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-[40px] bg-slate-50/40 text-center whitespace-nowrap">
                    No
                  </TableHead>
                  <TableHead
                    className="w-[140px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("noSurat")}
                  >
                    <span className="inline-flex items-center">
                      No Surat
                      <SortIcon col="noSurat" />
                    </span>
                  </TableHead>
                  {isCabangView && (
                    <TableHead
                      className="w-[130px] bg-slate-50/40 whitespace-nowrap pr-2 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort("penerima")}
                    >
                      <span className="inline-flex items-center">
                        Pengaju
                        <SortIcon col="penerima" />
                      </span>
                    </TableHead>
                  )}
                  <TableHead className="w-[110px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors">
                    Periode
                  </TableHead>
                  <TableHead
                    className="w-[90px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("penerima")}
                  >
                    <span className="inline-flex items-center">
                      Penerima
                      <SortIcon col="penerima" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[110px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("tanggal")}
                  >
                    <span className="inline-flex items-center">
                      Tanggal
                      <SortIcon col="tanggal" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[160px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("keperluan")}
                  >
                    <span className="inline-flex items-center">
                      Keperluan
                      <SortIcon col="keperluan" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[100px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    <span className="inline-flex items-center">
                      Status
                      <SortIcon col="status" />
                    </span>
                  </TableHead>
                  <TableHead className="w-[90px] text-right bg-slate-50/40 whitespace-nowrap">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDisplayedItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isCabangView ? 9 : 8}
                      className="h-32 text-center text-muted-foreground"
                    >
                      {searchTerm
                        ? "Tidak ada data pengajuan yang cocok dengan filter."
                        : "Belum ada data pengajuan."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedDisplayedItems.map((item, index) => {
                    const StatusIcon =
                      statusConfig[item.status as keyof typeof statusConfig]
                        ?.icon || Clock;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-center text-muted-foreground font-medium">
                          {(currentPage - 1) * 10 + index + 1}
                        </TableCell>
                        <TableCell
                          className="font-medium whitespace-nowrap text-[13px] truncate max-w-[140px]"
                          title={item.noSurat}
                        >
                          {item.noSurat}
                        </TableCell>
                        {isCabangView && (
                          <TableCell
                            className="font-medium whitespace-nowrap text-[13px] truncate max-w-[130px]"
                            title={item.user?.name || ""}
                          >
                            {item.user?.name
                              ? capitalizeName(item.user.name)
                              : "-"}
                          </TableCell>
                        )}
                        <TableCell className="whitespace-nowrap font-medium text-[13px]">
                          {item.periodePac?.nama || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              "transition-colors text-[11px] px-1.5 py-0",
                              penerimaConfig[
                                item.penerima as keyof typeof penerimaConfig
                              ]?.className,
                            )}
                          >
                            {item.penerima}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap pr-2 text-[13px]">
                          {new Date(item.tanggal).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell
                          className="max-w-[160px] truncate text-[13px]"
                          title={item.keperluan}
                        >
                          {capitalizeName(item.keperluan)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "transition-colors text-[11px] px-1.5 py-0",
                              statusConfig[
                                item.status as keyof typeof statusConfig
                              ]?.className,
                            )}
                          >
                            <StatusIcon className="w-2.5 h-2.5 mr-1" />
                            {statusConfig[
                              item.status as keyof typeof statusConfig
                            ]?.label || item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              asChild
                              title="Detail"
                            >
                              <Link href={`${detailBasePath}/${item.id}`}>
                                <Eye className="w-4 h-4" />
                              </Link>
                            </Button>

                            {!isCabangView && item.status === "PENDING" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                                asChild
                              >
                                <Link
                                  href={`${detailBasePath}/${item.id}/edit`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Link>
                              </Button>
                            )}

                            {(!isCabangView || userRole === "SEKRETARIS_CABANG") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                onClick={() => setConfirmDeleteId(item.id)}
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}

                {/* Pagination Row - integrated into table body */}
                {totalPages >= 1 && (
                  <TableRow className="hover:bg-transparent border-t bg-white">
                    <TableCell colSpan={isCabangView ? 9 : 8} className="p-0">
                      <div className="flex items-center justify-start sm:justify-between px-4 py-2">
                        <p className="text-xs text-muted-foreground hidden sm:block">
                          Menampilkan{" "}
                          <span className="font-medium text-slate-700">
                            {(currentPage - 1) * 10 + 1}
                          </span>{" "}
                          sampai{" "}
                          <span className="font-medium text-slate-700">
                            {Math.min(currentPage * 10, totalItems)}
                          </span>{" "}
                          dari{" "}
                          <span className="font-medium text-slate-700">
                            {totalItems}
                          </span>{" "}
                          pengajuan
                        </p>
                        <Pagination className="mx-0 w-auto scale-90 sm:scale-100 origin-left">
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (currentPage > 1)
                                    handlePageChange(currentPage - 1);
                                }}
                                className={
                                  currentPage === 1
                                    ? "pointer-events-none opacity-50"
                                    : "cursor-pointer"
                                }
                              />
                            </PaginationItem>

                            {/* Dynamic Pagination Logic */}
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                              .filter((page) => {
                                if (totalPages <= 5) return true;
                                if (page === 1 || page === totalPages)
                                  return true;
                                if (Math.abs(page - currentPage) <= 1)
                                  return true;
                                return false;
                              })
                              .map((page, index, array) => (
                                <React.Fragment key={page}>
                                  {index > 0 &&
                                    array[index - 1] !== page - 1 && (
                                      <PaginationItem>
                                        <PaginationEllipsis />
                                      </PaginationItem>
                                    )}
                                  <PaginationItem>
                                    <PaginationLink
                                      href="#"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handlePageChange(page);
                                      }}
                                      isActive={currentPage === page}
                                    >
                                      {page}
                                    </PaginationLink>
                                  </PaginationItem>
                                </React.Fragment>
                              ))}

                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (currentPage < totalPages)
                                    handlePageChange(currentPage + 1);
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
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Pengajuan?"
        description={`Apakah Anda yakin ingin menghapus pengajuan "${capitalizeName(sortedDisplayedItems.find((p) => p.id === confirmDeleteId)?.keperluan || "")}"? Tindakan ini tidak dapat dibatalkan.`}
        variant="destructive"
        loading={isDeleting}
      />
    </div>
  );
}
