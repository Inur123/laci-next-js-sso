"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarDays,
  MoreVertical,
  Eye,
  Trash2,
  Users,
  Pencil,
  Search,
  RefreshCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
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

const capitalizeName = (name: string) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};
import Link from "next/link";
import {
  deletePresensi,
  updatePresensiStatus,
  getPresensiList,
} from "@/app/actions/presensi-actions";
import { isPresensiOpen } from "@/lib/presensi-utils";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PresensiListProps {
  data: any[];
  totalPages?: number;
  totalItems?: number;
  userRole?: string;
}

export function PresensiList({
  data: initialData,
  totalPages: initialTotalPages = 1,
  totalItems: initialTotalItems = 0,
  userRole = "SEKRETARIS_PAC",
}: PresensiListProps) {
  const [data, setData] = useState<any[]>(initialData);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [totalItems, setTotalItems] = useState(initialTotalItems);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [optimisticHiddenIds, setOptimisticHiddenIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "CLOSED">(
    "ALL",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const realtimeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Sort state
  type SortKey =
    | "namaKegiatan"
    | "tanggal"
    | "jamMulai"
    | "tempat"
    | "isActive";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey | null>("tanggal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const isFirstRender = React.useRef(true);

  const fetchData = async (
    query: string,
    status: string,
    page: number,
    sKey: SortKey | null = sortKey,
    sDir: SortDir = sortDir,
  ) => {
    try {
      const result = await getPresensiList(
        query,
        page,
        10,
        status,
        sKey,
        sDir,
      );
      setData(result.data);
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
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(searchTerm, statusFilter, page);
  };

  // Real-time tick to update status badges every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setOptimisticHiddenIds((prev) => [...prev, id]);

    const result = await deletePresensi(id);
    if (result.error) {
      setOptimisticHiddenIds((prev) => prev.filter((pid) => pid !== id));
      toast.error(result.error);
    } else {
      toast.success(result.success ?? "Presensi berhasil dihapus");
      fetchData(searchTerm, statusFilter, currentPage);
    }
  };

  useEffect(() => {
    const handleRealtime = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail) return;

      const detailModel = detail.model?.toLowerCase();
      const detailAction = detail.action?.toLowerCase();
      const detailType = detail.type;
      const detailModule = detail.module;

      // Cek apakah event ini relevan untuk halaman Presensi
      const isPresensiMutation =
        detailType === "mutation" &&
        (detailModel === "presensidata" || detailModel === "presensi");
      const isPresensiLog =
        detailType === "log" &&
        (detailModule === "PRESENSI" || detailModule === "AGENDA_KEGIATAN");

      if (isPresensiMutation || isPresensiLog) {
        // Debounce refresh agar tidak membombardir server jika banyak join sekaligus
        if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = setTimeout(() => {
          realtimeTimerRef.current = null;
          fetchData(searchTerm, statusFilter, currentPage);
        }, 500);
      }
    };

    window.addEventListener("laci-realtime", handleRealtime);
    return () => {
      window.removeEventListener("laci-realtime", handleRealtime);
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
    };
  }, [searchTerm, statusFilter, currentPage]);

  const handleToggleStatus = async (
    id: string,
    mode: "AUTO" | "MANUAL_CLOSE",
  ) => {
    setLoadingId(id);
    const result = await updatePresensiStatus(id, mode);
    if (result.success) {
      toast.success(result.success);
      fetchData(searchTerm, statusFilter, currentPage);
    } else {
      toast.error(result.error);
    }
    setLoadingId(null);
  };

  const handleSort = (key: SortKey) => {
    let newDir: SortDir = "asc";
    if (sortKey === key) {
      newDir = sortDir === "asc" ? "desc" : "asc";
      setSortDir(newDir);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
    fetchData(searchTerm, statusFilter, 1, key, newDir);
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

  const visibleData = data.filter((item) => !optimisticHiddenIds.includes(item.id));

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
  }, [searchTerm, statusFilter]);

  const handleReset = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setCurrentPage(1);
    fetchData("", "ALL", 1);
  };

  const isFiltered = searchTerm !== "" || statusFilter !== "ALL";



  return (
    <>
      {/* Search + Filter Bar */}
      {/* Filter Section - Matched with UserList/PengajuanBerkas Layout */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
        {/* Search + label */}
        <div className="flex-1 w-full relative">
          <Label className="text-xs font-medium mb-1 block">
            Cari Kegiatan
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, tempat, atau penyelenggara..."
              className="pl-9 w-full bg-white h-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Status + label */}
        <div className="w-full md:w-36">
          <Label className="text-xs font-medium mb-1 block">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as "ALL" | "OPEN" | "CLOSED");
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full bg-white h-9 text-sm border-slate-200 shadow-sm">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              <SelectItem value="OPEN">Dibuka</SelectItem>
              <SelectItem value="CLOSED">Ditutup</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reset Button */}
        <Button
          variant="outline"
          className={cn(
            "h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm whitespace-nowrap transition-all duration-200",
            isFiltered
              ? "text-slate-900 border-slate-300 opacity-100"
              : "text-slate-400 border-slate-200 opacity-50 cursor-not-allowed",
          )}
          onClick={handleReset}
          disabled={!isFiltered}
        >
          <RefreshCcw className="mr-2 h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="relative max-h-[600px] overflow-auto">
          <Table className="min-w-[800px]">
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow>
                <TableHead className="w-[50px] text-center bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11">
                  No
                </TableHead>
                <TableHead
                  className="bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("namaKegiatan")}
                >
                  <span className="inline-flex items-center">
                    Nama Kegiatan
                    <SortIcon col="namaKegiatan" />
                  </span>
                </TableHead>
                <TableHead
                  className="w-[160px] bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("tanggal")}
                >
                  <span className="inline-flex items-center">
                    Tanggal
                    <SortIcon col="tanggal" />
                  </span>
                </TableHead>
                <TableHead
                  className="w-[140px] bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("jamMulai")}
                >
                  <span className="inline-flex items-center">
                    Waktu
                    <SortIcon col="jamMulai" />
                  </span>
                </TableHead>
                <TableHead
                  className="w-[160px] bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("tempat")}
                >
                  <span className="inline-flex items-center">
                    Tempat
                    <SortIcon col="tempat" />
                  </span>
                </TableHead>
                <TableHead className="w-[90px] text-center bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11">
                  Peserta
                </TableHead>
                <TableHead
                  className="w-[130px] bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort("isActive")}
                >
                  <span className="inline-flex items-center">
                    Status
                    <SortIcon col="isActive" />
                  </span>
                </TableHead>
                <TableHead className="w-[60px] text-right bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-32 text-center text-muted-foreground"
                  >
                    {isFiltered
                      ? "Tidak ada kegiatan yang cocok dengan filter yang dipilih."
                      : "Belum ada kegiatan presensi."}
                  </TableCell>
                </TableRow>
              ) : (
                visibleData.map((item, index) => (
                  <TableRow
                    key={item.id}
                    className={
                      !item.isActive ? "bg-slate-50/60 opacity-80" : ""
                    }
                  >
                    {/* No */}
                    <TableCell className="text-center text-muted-foreground font-medium whitespace-nowrap">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </TableCell>

                    {/* Nama Kegiatan */}
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/presensi/${item.id}`}
                        className={cn(
                          "transition-colors font-semibold text-slate-900 block max-w-[220px] truncate",
                          userRole === "SEKRETARIS_CABANG"
                            ? "hover:text-blue-600"
                            : "hover:text-green-600",
                        )}
                      >
                        {capitalizeName(item.namaKegiatan)}
                      </Link>
                      <span className="text-xs text-slate-500 truncate block max-w-[220px]">
                        {capitalizeName(item.penyelenggara)}
                      </span>
                    </TableCell>

                    {/* Tanggal */}
                    <TableCell className="whitespace-nowrap text-sm text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {format(new Date(item.tanggal), "dd MMM yyyy", {
                          locale: id,
                        })}
                      </div>
                    </TableCell>

                    {/* Waktu */}
                    <TableCell className="whitespace-nowrap text-sm text-slate-600">
                      {item.jamMulai} – {item.jamSelesai}
                    </TableCell>

                    {/* Tempat */}
                    <TableCell className="text-sm text-slate-600">
                      <span className="truncate block max-w-[140px]">
                        {capitalizeName(item.tempat)}
                      </span>
                    </TableCell>

                    {/* Peserta */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-slate-700 font-semibold text-sm">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {item._count?.dataPresensi ?? 0}
                      </div>
                    </TableCell>

                    <TableCell>
                      {(() => {
                        const isOpen = isPresensiOpen(item);
                        return (
                          <Badge
                            variant="outline"
                            className={cn(
                              "w-fit transition-all duration-300",
                              isOpen
                                ? "bg-green-100 text-green-700 border-green-200"
                                : "bg-red-100 text-red-600 border-red-200",
                            )}
                          >
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full mr-1.5 shrink-0",
                                isOpen
                                  ? "bg-green-500 animate-pulse"
                                  : "bg-red-500",
                              )}
                            />
                            {isOpen ? "Dibuka" : "Ditutup"}
                          </Badge>
                        );
                      })()}
                    </TableCell>

                    {/* Aksi – 3 dot dropdown */}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-700"
                            disabled={loadingId === item.id}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {/* Detail */}
                          <DropdownMenuItem
                            asChild
                            className={cn(
                              "cursor-pointer",
                              userRole === "SEKRETARIS_CABANG"
                                ? "text-blue-600 focus:text-blue-600"
                                : "text-green-600 focus:text-green-600",
                            )}
                          >
                            <Link
                              href={`/dashboard/presensi/${item.id}`}
                              className="flex items-center"
                            >
                              <Eye className="w-4 h-4 mr-2 shrink-0" />
                              Detail
                            </Link>
                          </DropdownMenuItem>

                          {/* Edit */}
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/dashboard/presensi/${item.id}/edit`}
                              className="flex items-center cursor-pointer text-slate-700"
                            >
                              <Pencil className="w-4 h-4 mr-2 shrink-0" />
                              Edit
                            </Link>
                          </DropdownMenuItem>

                          {/* Hapus */}
                          <DropdownMenuItem
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="flex items-center cursor-pointer text-red-600 focus:text-red-700"
                          >
                            <Trash2 className="w-4 h-4 mr-2 shrink-0" />
                            Hapus Kegiatan
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}

              {/* Pagination Row - Identical with UserList/ArsipSurat */}
              {totalPages >= 1 && (
                <TableRow className="hover:bg-transparent border-t bg-slate-50/30">
                  <TableCell colSpan={8} className="p-0">
                    <div className="flex items-center justify-between px-4 py-2">
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        Menampilkan{" "}
                        <span className="font-medium text-slate-700">
                          {(currentPage - 1) * itemsPerPage + 1}
                        </span>{" "}
                        sampai{" "}
                        <span className="font-medium text-slate-700">
                          {Math.min(currentPage * itemsPerPage, totalItems)}
                        </span>{" "}
                        dari{" "}
                        <span className="font-medium text-slate-700">
                          {totalItems}
                        </span>{" "}
                        kegiatan
                      </p>
                      <Pagination className="mx-0 w-auto scale-90 sm:scale-100 origin-right">
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

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Presensi?"
        description="Apakah Anda yakin ingin menghapus kegiatan presensi ini? Semua data kehadiran peserta juga akan terhapus permanen."
        variant="destructive"
        loading={false}
      />
    </>
  );
}
