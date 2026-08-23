"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Search,
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
  getPengajuanForReferensiPac,
  getActivePacUsersForReferensi,
} from "@/app/actions/pengajuan-berkas-actions";
import { toast } from "sonner";
import { cn, capitalizeName } from "@/lib/utils";
import { UserFilterSelect } from "@/components/shared/user-filter-select";

// ─── Types ────────────────────────────────────────────────────────────────────

type PengajuanItem = {
  id: string;
  noSurat: string;
  penerima: string;
  tanggal: Date;
  keperluan: string;
  deskripsi: string | null;
  status: string;
  alasanPenolakan: string | null;
  user?: { name: string; email: string } | null;
  periodePac?: { nama: string } | null;
};

type PacUser = { id: string; name: string };

// ─── Configs ──────────────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReferensiPengajuanList({
  pengajuanList: initialPengajuanList,
  pacUsers: initialPacUsers = [],
  totalPages: initialTotalPages,
  currentPage: initialCurrentPage,
  totalItems: initialTotalItems,
}: {
  pengajuanList: PengajuanItem[];
  pacUsers?: PacUser[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Data State ────────────────────────────────────────────────────────────
  const [data, setData] = useState<PengajuanItem[]>(initialPengajuanList);
  const [pacUsers, setPacUsers] = useState<PacUser[]>(initialPacUsers);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [totalItems, setTotalItems] = useState(initialTotalItems);

  // Sync state with props
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

  // ── Filter State ──────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [penerimaFilter, setPenerimaFilter] = useState("ALL");
  const [pacFilter, setPacFilter] = useState(
    searchParams.get("userId") || "ALL",
  );

  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Sort State ────────────────────────────────────────────────────────────
  type SortKey =
    | "noSurat"
    | "tanggal"
    | "keperluan"
    | "penerima"
    | "status"
    | "pengaju";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey | null>("tanggal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const isFirstRender = useRef(true);

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
  const sortedDisplayedItems = data;

  // ── Fetch Data ────────────────────────────────────────────────────────────
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
        const result = await getPengajuanForReferensiPac(
          query,
          page,
          10,
          status,
          penerima,
          pac,
          sKey,
          sDir,
        );
        setData(result.data as PengajuanItem[]);
        setTotalPages(result.totalPages);
        setTotalItems(result.total);
      } catch (error) {
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
    [sortKey, sortDir],
  );

  // ── Load PAC users on mount ───────────────────────────────────────────────
  useEffect(() => {
    getActivePacUsersForReferensi()
      .then(setPacUsers)
      .catch(() => {});
  }, []);

  // ── Debounced filter effect ───────────────────────────────────────────────
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

  // ── Realtime listener (same pattern as pengajuan-berkas-list) ────────────────
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFilterChange = (key: string, value: string) => {
    if (key === "status") {
      setStatusFilter(value);
    }
    if (key === "penerima") {
      setPenerimaFilter(value);
    }
    if (key === "pac") {
      setPacFilter(value);

      // Update URL to trigger server-side re-render (optional but good for consistency)
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

  const hasFilters =
    searchTerm !== "" ||
    statusFilter !== "ALL" ||
    penerimaFilter !== "ALL" ||
    pacFilter !== "ALL";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">
      {/* Filter Section — sama persis dengan pengajuan-berkas-list */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
        {/* Search */}
        <div className="flex-1 relative w-full">
          <Label className="text-xs font-medium mb-1 block">Cari Surat</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="No Surat, keperluan, atau pengaju..."
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

        {/* Filter PAC — sama dengan pengajuan-pac cabang view */}
        {pacUsers.length > 0 && (
          <div className="w-full md:w-64">
            <Label className="text-xs font-medium mb-1 block">Filter PAC</Label>
            <UserFilterSelect
              users={pacUsers}
              selectedUserId={pacFilter}
              onSelectUser={(val) => handleFilterChange("pac", val)}
              placeholder="Semua PAC"
            />
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 w-full md:flex md:w-auto md:items-center md:justify-end md:gap-4 lg:justify-start">
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

      {/* Table Section */}
      <div className="relative">
        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <Table className="w-full table-fixed [&_td]:py-2 [&_th]:py-2">
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-[50px] bg-slate-50/40 text-center whitespace-nowrap">
                    No
                  </TableHead>
                  <TableHead
                    className="w-[180px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("noSurat")}
                  >
                    <span className="inline-flex items-center">
                      No Surat
                      <SortIcon col="noSurat" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[160px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("pengaju")}
                  >
                    <span className="inline-flex items-center">
                      Pengaju
                      <SortIcon col="pengaju" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[120px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("penerima")}
                  >
                    <span className="inline-flex items-center">
                      Penerima
                      <SortIcon col="penerima" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[150px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("tanggal")}
                  >
                    <span className="inline-flex items-center">
                      Tanggal
                      <SortIcon col="tanggal" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("keperluan")}
                  >
                    <span className="inline-flex items-center">
                      Keperluan
                      <SortIcon col="keperluan" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[120px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    <span className="inline-flex items-center">
                      Status
                      <SortIcon col="status" />
                    </span>
                  </TableHead>
                  <TableHead className="w-[60px] text-right bg-slate-50/40 whitespace-nowrap">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDisplayedItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-32 text-center text-muted-foreground"
                    >
                      {searchTerm
                        ? "Tidak ada pengajuan yang cocok dengan filter."
                        : "Belum ada data pengajuan referensi."}
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
                        <TableCell className="font-medium whitespace-nowrap">
                          {item.noSurat}
                        </TableCell>
                        <TableCell className="whitespace-nowrap pr-6">
                          {item.user?.name
                            ? capitalizeName(item.user.name)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "transition-colors",
                              penerimaConfig[
                                item.penerima as keyof typeof penerimaConfig
                              ]?.className,
                            )}
                          >
                            {item.penerima}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap pr-8">
                          {new Date(item.tanggal).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell
                          className="max-w-[300px] truncate"
                          title={item.keperluan}
                        >
                          {capitalizeName(item.keperluan)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "transition-colors",
                              statusConfig[
                                item.status as keyof typeof statusConfig
                              ]?.className,
                            )}
                          >
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig[
                              item.status as keyof typeof statusConfig
                            ]?.label || item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            asChild
                            title="Detail"
                          >
                            <Link
                              href={`/dashboard/referensi-pengajuan/${item.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}

                {/* Pagination Row — integrated into table body (same as pengajuan-berkas-list) */}
                {totalPages >= 1 && (
                  <TableRow className="hover:bg-transparent border-t bg-white">
                    <TableCell colSpan={8} className="p-0">
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
    </div>
  );
}
