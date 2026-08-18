"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import Link from "next/link";
import {
  Pencil,
  Trash2,
  Search,
  FileSpreadsheet,
  RefreshCcw,
  MapPin,
  Clock,
  CheckCircle,
  PlayCircle,
  type LucideIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteKegiatan,
  getAgendaKegiatanList,
} from "@/app/actions/agenda-kegiatan-actions";
import { logExport } from "@/app/actions/log-activity-actions";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import XLSX from "xlsx-js-style";
import { cn } from "@/lib/utils";
import { KegiatanCalendar } from "./kegiatan-calendar";

const capitalizeName = (name: string) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

// Status configuration for badges
interface KegiatanItem {
  id: string;
  judul: string;
  deskripsi?: string | null;
  lokasi?: string | null;
  warna: string;
  tanggalMulai: Date | string;
  tanggalSelesai?: Date | string | null;
  status: string;
}

const statusConfig: Record<
  string,
  { label: string; icon: LucideIcon; className: string }
> = {
  MENDATANG: {
    label: "Mendatang",
    icon: Clock,
    className:
      "bg-blue-100/80 text-blue-700 border-blue-200 hover:bg-blue-200/80",
  },
  BERLANGSUNG: {
    label: "Berlangsung",
    icon: PlayCircle,
    className:
      "bg-green-100/80 text-green-700 border-green-200 hover:bg-green-200/80",
  },
  SELESAI: {
    label: "Selesai",
    icon: CheckCircle,
    className:
      "bg-slate-100/80 text-slate-700 border-slate-200 hover:bg-slate-200/80",
  },
};

export function KegiatanList({
  kegiatanList: initialKegiatanList,
  userRole,
  totalPages: initialTotalPages,
  currentPage: initialCurrentPage,
  totalItems: initialTotalItems,
}: {
  kegiatanList: KegiatanItem[];
  userRole: string;
  totalPages: number;
  currentPage: number;
  totalItems: number;
}) {
  // Local data state
  const [data, setData] = useState<KegiatanItem[]>(initialKegiatanList);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [totalItems, setTotalItems] = useState(initialTotalItems);
  const [isLoading, setIsLoading] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [optimisticHiddenIds, setOptimisticHiddenIds] = useState<string[]>([]);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sort state
  type SortKey = "judul" | "tanggalMulai" | "lokasi" | "status";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey | null>("tanggalMulai");
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

  // Data sudah diurutkan secara global dari server
  const sortedData = data;

  const isFirstRender = useRef(true);

  // Function to fetch data
  const fetchData = useCallback(
    async (
      query: string,
      status: string,
      page: number,
      sKey: SortKey | null = sortKey,
      sDir: SortDir = sortDir,
    ) => {
      setIsLoading(true);
      try {
        const result = await getAgendaKegiatanList(
          query,
          page,
          10,
          status,
          sKey,
          sDir,
        );
        setData(result.data as KegiatanItem[]);
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
      } finally {
        setIsLoading(false);
      }
    },
    [sortKey, sortDir],
  );

  // Debounce search
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchData(searchTerm, statusFilter, 1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, fetchData]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "AgendaKegiatan") return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        fetchData(searchTerm, statusFilter, currentPage);
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
  }, [searchTerm, statusFilter, currentPage, fetchData]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(searchTerm, statusFilter, page);
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setCurrentPage(1);
    fetchData("", "ALL", 1);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setOptimisticHiddenIds((prev) => [...prev, id]);

    const result = await deleteKegiatan(id);

    if (result.error) {
      setOptimisticHiddenIds((prev) => prev.filter((pid) => pid !== id));
      toast.error(result.error);
    } else {
      toast.success("Kegiatan berhasil dihapus");
      fetchData(searchTerm, statusFilter, currentPage);
    }
  };

  const handleExportExcel = async () => {
    if (totalItems === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    toast.info("Menyiapkan data export...");

    const dateStr = new Date().toLocaleDateString("id-ID").replace(/\//g, "-");
    const filename = `Data_Kegiatan_${dateStr}.xlsx`;

    // Fetch ALL data (bypass pagination)
    let allData = data;
    if (totalItems > data.length) {
      try {
        const result = await getAgendaKegiatanList(
          searchTerm,
          1,
          9999,
          statusFilter,
        );
        allData = result.data as KegiatanItem[];
      } catch {
        toast.error("Gagal mengambil semua data untuk export");
        return;
      }
    }

    const exportData: Record<string, string | number>[] = allData.map(
      (item, index) => ({
        No: index + 1,
        Judul: item.judul,
        "Tanggal Mulai": new Date(item.tanggalMulai).toLocaleString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        "Tanggal Selesai": item.tanggalSelesai
          ? new Date(item.tanggalSelesai).toLocaleString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-",
        Lokasi: item.lokasi || "-",
        Status: statusConfig[item.status]?.label || item.status,
        Deskripsi: item.deskripsi || "-",
      }),
    );

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:G1");
    const headerColor = "3b82f6";

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

    const wscols = Object.keys(exportData[0] || {}).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...exportData.map((row) => String(row[key] || "").length),
      );
      return { wch: Math.min(maxLen + 2, 50) };
    });
    worksheet["!cols"] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Kegiatan");
    XLSX.writeFile(workbook, filename);
    logExport("AGENDA_KEGIATAN", filename);
    toast.success("File excel berhasil didownload!");
  };

  const isFiltered = searchTerm !== "" || statusFilter !== "ALL";

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Calendar View */}
      <KegiatanCalendar kegiatanList={data} />

      <div className="flex flex-col md:flex-row gap-4 items-end">
        {/* Search Section */}
        <div className="flex-1 relative w-full">
          <Label className="text-xs font-medium mb-1 block">
            Cari Kegiatan
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari judul atau lokasi..."
              className="pl-9 w-full bg-white h-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-44">
          <Label className="text-xs font-medium mb-1 block">Status</Label>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-full bg-white h-9 text-sm">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <config.icon size={14} className="text-muted-foreground" />
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions Section */}
        <div className="grid grid-cols-2 gap-2 w-full md:flex md:w-auto md:items-end md:justify-end md:gap-4 lg:justify-start">
          <Button
            variant="outline"
            className="h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm whitespace-nowrap"
            onClick={handleExportExcel}
            disabled={isLoading || data.length === 0}
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

          <Button
            variant="outline"
            className={cn(
              "h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm whitespace-nowrap transition-all duration-200",
              isFiltered
                ? "text-slate-900 border-slate-300 opacity-100"
                : "text-slate-400 border-slate-200 opacity-50 cursor-not-allowed",
            )}
            onClick={handleReset}
            disabled={!isFiltered || isLoading}
          >
            <RefreshCcw
              className={cn(
                "mr-2 h-3.5 w-3.5",
                isFiltered && "animate-spin-once",
              )}
            />
            Reset
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <div className="relative">
        <div className="rounded-md border">
          <div className="overflow-x-auto pb-2">
            <Table className="w-full [&_td]:py-3 [&_th]:py-3">
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-[50px] text-center bg-slate-50/40 whitespace-nowrap">
                    No
                  </TableHead>
                  <TableHead
                    className="min-w-[200px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("judul")}
                  >
                    <span className="inline-flex items-center">
                      Judul Kegiatan
                      <SortIcon col="judul" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="min-w-[160px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("tanggalMulai")}
                  >
                    <span className="inline-flex items-center">
                      Tanggal
                      <SortIcon col="tanggalMulai" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="min-w-[180px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("lokasi")}
                  >
                    <span className="inline-flex items-center">
                      Lokasi
                      <SortIcon col="lokasi" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="min-w-[140px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    <span className="inline-flex items-center">
                      Status
                      <SortIcon col="status" />
                    </span>
                  </TableHead>
                  <TableHead className="w-[100px] text-right bg-slate-50/40 whitespace-nowrap">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.filter(
                  (item) => !optimisticHiddenIds.includes(item.id),
                ).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-muted-foreground"
                    >
                      {searchTerm
                        ? "Tidak ada kegiatan yang cocok dengan filter."
                        : "Belum ada kegiatan."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData
                    .filter((item) => !optimisticHiddenIds.includes(item.id))
                    .map((item, index) => {
                      const StatusIcon =
                        statusConfig[item.status]?.icon || Clock;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="text-center text-muted-foreground font-medium whitespace-nowrap">
                            {(currentPage - 1) * 10 + index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              {/* Color Indicator */}
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: item.warna }}
                                title="Label Warna"
                              />
                              <div className="flex flex-col max-w-[300px]">
                                <span className="truncate font-semibold text-slate-900">
                                  {capitalizeName(item.judul)}
                                </span>
                                {item.deskripsi && (
                                  <span className="truncate text-xs text-slate-500 max-w-[250px]">
                                    {capitalizeName(item.deskripsi)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900">
                                {new Date(item.tanggalMulai).toLocaleDateString(
                                  "id-ID",
                                  {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  },
                                )}
                                ,{" "}
                                {new Date(item.tanggalMulai).toLocaleTimeString(
                                  "id-ID",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                              {item.tanggalSelesai && (
                                <span className="text-[11px] text-slate-500 mt-0.5">
                                  s/d{" "}
                                  {new Date(
                                    item.tanggalSelesai,
                                  ).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  })}
                                  ,{" "}
                                  {new Date(
                                    item.tanggalSelesai,
                                  ).toLocaleTimeString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-1.5 max-w-[180px]">
                              <MapPin
                                size={14}
                                className="text-slate-400 shrink-0"
                              />
                              <span className="text-sm truncate text-slate-700">
                                {item.lokasi
                                  ? capitalizeName(item.lokasi)
                                  : "-"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={cn(
                                "transition-colors flex w-fit items-center gap-1",
                                statusConfig[item.status]?.className,
                              )}
                            >
                              <StatusIcon size={12} />
                              {statusConfig[item.status]?.label || item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0 cursor-pointer"
                                asChild
                                title="Edit"
                              >
                                <Link
                                  href={`/dashboard/agenda-kegiatan/${item.id}/edit`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Link>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 cursor-pointer"
                                onClick={() => setConfirmDeleteId(item.id)}
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}

                {/* Pagination Row - integrated into table body */}
                {totalPages >= 1 && (
                  <TableRow className="hover:bg-transparent border-t bg-white">
                    <TableCell colSpan={6} className="p-0">
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
                          kegiatan
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
                                        handlePageChange(page);
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
                                return <PaginationEllipsis key={page} />;
                              }
                              return null;
                            })}

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
        title="Hapus Kegiatan?"
        description="Apakah Anda yakin ingin menghapus kegiatan ini? Tindakan ini tidak dapat dibatalkan."
        variant="destructive"
        loading={false}
      />
    </div>
  );
}
