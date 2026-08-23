"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  MailCheck,
  MailX,
  CalendarDays,
  Search,
  RefreshCcw,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";
import {
  getEmailLogs,
  getEmailStats,
  retryEmail,
  resendVerificationOTP,
  type EmailLogFilters,
} from "@/app/actions/log-email-actions";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  type: string;
  status: string;
  errorMessage: string | null;
  retryCount: number;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
  isVerified?: boolean;
}

interface EmailStats {
  totalAll: number;
  totalToday: number;
  totalSent: number;
  totalFailed: number;
  byType: Record<string, number>;
}

interface EmailLogClientProps {
  initialStats: EmailStats;
  initialLogs: {
    data: EmailLogEntry[];
    total: number;
    totalPages: number;
    currentPage: number;
  };
}

// ============================================
// CONFIG
// ============================================

const TYPE_LABELS: Record<string, { label: string; className: string }> = {
  VERIFICATION: {
    label: "Verifikasi",
    className:
      "bg-amber-100/80 text-amber-700 border-amber-200 hover:bg-amber-200/80",
  },
  VERIFIED_SUCCESS: {
    label: "Sukses Verif",
    className:
      "bg-emerald-100/80 text-emerald-700 border-emerald-200 hover:bg-emerald-200/80",
  },
  PENGAJUAN_USER: {
    label: "Pengajuan User",
    className:
      "bg-blue-100/80 text-blue-700 border-blue-200 hover:bg-blue-200/80",
  },
  PENGAJUAN_ADMIN: {
    label: "Pengajuan Admin",
    className:
      "bg-indigo-100/80 text-indigo-700 border-indigo-200 hover:bg-indigo-200/80",
  },
  PENGAJUAN_STATUS: {
    label: "Status Pengajuan",
    className:
      "bg-purple-100/80 text-purple-700 border-purple-200 hover:bg-purple-200/80",
  },
};

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    className: string;
  }
> = {
  SENT: {
    label: "Terkirim",
    icon: CheckCircle2,
    className:
      "bg-green-100/80 text-green-700 border-green-200 hover:bg-green-200/80",
  },
  FAILED: {
    label: "Gagal",
    icon: AlertCircle,
    className: "bg-red-100/80 text-red-700 border-red-200 hover:bg-red-200/80",
  },
  PENDING: {
    label: "Mengirim",
    icon: Clock,
    className:
      "bg-amber-100/80 text-amber-700 border-amber-200 hover:bg-amber-200/80",
  },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================
// STATS COMPONENT
// ============================================

function EmailLogStats({ stats }: { stats: EmailStats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Hari Ini */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-blue-100 bg-blue-50/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-blue-700 uppercase">
            Hari Ini
          </span>
          <CalendarDays className="h-4 w-4 text-blue-500" />
        </div>
        <div className="text-xl font-bold text-blue-600 leading-none">
          <NumberTicker
            value={stats.totalToday}
            formatter={(val) =>
              new Intl.NumberFormat("id-ID", {
                notation: "compact",
                compactDisplay: "short",
                maximumFractionDigits: 1,
              }).format(val)
            }
          />
        </div>
      </Card>

      {/* Total */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            Total
          </span>
          <Mail className="h-4 w-4 text-slate-400" />
        </div>
        <div className="text-xl font-bold text-slate-900 leading-none">
          <NumberTicker
            value={stats.totalAll}
            formatter={(val) =>
              new Intl.NumberFormat("id-ID", {
                notation: "compact",
                compactDisplay: "short",
                maximumFractionDigits: 1,
              }).format(val)
            }
          />
        </div>
      </Card>

      {/* Terkirim */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-emerald-100 bg-emerald-50/10">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-emerald-700 uppercase">
            Terkirim
          </span>
          <MailCheck className="h-4 w-4 text-green-600" />
        </div>
        <div className="text-xl font-bold text-green-600 leading-none">
          <NumberTicker
            value={stats.totalSent}
            formatter={(val) =>
              new Intl.NumberFormat("id-ID", {
                notation: "compact",
                compactDisplay: "short",
                maximumFractionDigits: 1,
              }).format(val)
            }
          />
        </div>
      </Card>

      {/* Gagal */}
      <Card className="h-[85px] flex flex-col justify-between p-3 shadow-none border-rose-100 bg-rose-50/10">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-rose-700 uppercase">
            Gagal
          </span>
          <MailX className="h-4 w-4 text-rose-500" />
        </div>
        <div className="text-xl font-bold text-rose-600 leading-none">
          <NumberTicker
            value={stats.totalFailed}
            formatter={(val) =>
              new Intl.NumberFormat("id-ID", {
                notation: "compact",
                compactDisplay: "short",
                maximumFractionDigits: 1,
              }).format(val)
            }
          />
        </div>
      </Card>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function EmailLogClient({
  initialStats,
  initialLogs,
}: EmailLogClientProps) {
  const [stats, setStats] = useState<EmailStats>(initialStats);
  const [data, setData] = useState<EmailLogEntry[]>(initialLogs.data);
  const [totalPages, setTotalPages] = useState(initialLogs.totalPages);
  const [currentPage, setCurrentPage] = useState(initialLogs.currentPage);
  const [totalItems, setTotalItems] = useState(initialLogs.total);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Action state
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);

  // Realtime
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sort state
  type SortKey = "createdAt" | "to" | "subject" | "type" | "status";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey | null>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const isFirstRender = useRef(true);

  const fetchData = useCallback(
    async (
      search: string,
      type: string,
      status: string,
      page: number,
      sKey: SortKey | null = sortKey,
      sDir: SortDir = sortDir,
    ) => {
      try {
        const filters: EmailLogFilters = {};
        if (search) filters.search = search;
        if (type !== "ALL") filters.type = type;
        if (status !== "ALL") filters.status = status;
        if (sKey) filters.sortKey = sKey;
        if (sDir) filters.sortDir = sDir;

        const [result, newStats] = await Promise.all([
          getEmailLogs(filters, page, 20),
          getEmailStats(),
        ]);

        setData(result.data);
        setTotalPages(result.totalPages);
        setTotalItems(result.total);
        setStats(newStats);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (
          !errMsg.includes("unexpected response") &&
          !errMsg.includes("NEXT_REDIRECT") &&
          !errMsg.includes("abort")
        ) {
          toast.error(`Gagal memuat data email: ${errMsg}`);
        }
      }
    },
    [sortKey, sortDir],
  );

  const handleSort = (key: SortKey) => {
    setCurrentPage(1);
    const nextDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortDir(nextDir);
    fetchData(searchTerm, typeFilter, statusFilter, 1, key, nextDir);
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

  const sortedData = data;

  // Debounced search for keyword only
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchData(searchTerm, typeFilter, statusFilter, 1);
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Realtime listener for EmailLog mutations
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "EmailLog") return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        fetchData(searchTerm, typeFilter, statusFilter, currentPage);
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
  }, [searchTerm, typeFilter, statusFilter, currentPage, fetchData]);

  const handleFilterChange = (key: string, value: string) => {
    const nType = key === "type" ? value : typeFilter;
    const nStatus = key === "status" ? value : statusFilter;
    if (key === "type") setTypeFilter(value);
    if (key === "status") setStatusFilter(value);
    setCurrentPage(1);
    fetchData(searchTerm, nType, nStatus, 1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(searchTerm, typeFilter, statusFilter, page);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setSortKey("createdAt");
    setSortDir("desc");
    setCurrentPage(1);
    fetchData("", "ALL", "ALL", 1, "createdAt", "desc");
  };

  const handleRetry = async (logId: string) => {
    setRetryingId(logId);
    try {
      const result = await retryEmail(logId);
      if (result.success) {
        toast.success("Email berhasil dikirim ulang");
        fetchData(searchTerm, typeFilter, statusFilter, currentPage);
      } else {
        toast.error(result.error || "Gagal mengirim ulang email");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setRetryingId(null);
    }
  };

  const handleResendOTP = async (email: string) => {
    setResendingEmail(email);
    try {
      const result = await resendVerificationOTP(email);
      if (result.success) {
        toast.success(`OTP baru berhasil dikirim ke ${email}`);
        fetchData(searchTerm, typeFilter, statusFilter, currentPage);
      } else {
        toast.error(result.error || "Gagal mengirim OTP");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setResendingEmail(null);
    }
  };

  const hasFilters =
    searchTerm !== "" ||
    typeFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    sortKey !== "createdAt" ||
    sortDir !== "desc";

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
            <Mail size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Log Email</h2>
            <p className="text-sm text-muted-foreground">
              Pantau dan kelola semua email yang dikirim oleh sistem
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <EmailLogStats stats={stats} />

      {/* Filter Section */}
      <div className="flex flex-col md:flex-row gap-4 mb-0 items-end">
        {/* Search */}
        <div className="flex-1 relative w-full">
          <Label className="text-xs font-medium mb-1 block">Cari Email</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Email penerima atau subjek..."
              className="pl-9 w-full h-9 text-sm bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Type Filter */}
        <div className="w-full md:w-44">
          <Label className="text-xs font-medium mb-1 block">Jenis Email</Label>
          <Select
            value={typeFilter}
            onValueChange={(val) => handleFilterChange("type", val)}
          >
            <SelectTrigger className="w-full h-9 text-sm bg-white">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              <SelectItem value="PENGAJUAN_USER">Pengajuan (User)</SelectItem>
              <SelectItem value="PENGAJUAN_ADMIN">Pengajuan (Admin)</SelectItem>
              <SelectItem value="PENGAJUAN_STATUS">Status Pengajuan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
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
              <SelectItem value="SENT">Terkirim</SelectItem>
              <SelectItem value="FAILED">Gagal</SelectItem>
              <SelectItem value="PENDING">Mengirim</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reset */}
        <div className="w-full md:w-auto">
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

      {/* Table */}
      <div className="relative">
        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <Table className="w-full table-fixed [&_td]:py-3 [&_th]:py-3">
              <TableHeader className="sticky top-0 bg-white z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                <TableRow className="bg-slate-50/40 hover:bg-slate-50/40 border-b-slate-100">
                  <TableHead className="w-[50px] text-center text-slate-500 font-semibold h-12 whitespace-nowrap">
                    No
                  </TableHead>
                  <TableHead
                    className="w-[160px] whitespace-nowrap text-slate-500 font-semibold h-12 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("createdAt")}
                  >
                    <span className="inline-flex items-center">
                      Waktu
                      <SortIcon col="createdAt" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[200px] whitespace-nowrap text-slate-500 font-semibold h-12 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("to")}
                  >
                    <span className="inline-flex items-center">
                      Penerima
                      <SortIcon col="to" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="whitespace-nowrap hidden md:table-cell text-slate-500 font-semibold h-12 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("subject")}
                  >
                    <span className="inline-flex items-center">
                      Subjek
                      <SortIcon col="subject" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[140px] whitespace-nowrap text-slate-500 font-semibold h-12 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("type")}
                  >
                    <span className="inline-flex items-center">
                      Jenis
                      <SortIcon col="type" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[120px] whitespace-nowrap text-slate-500 font-semibold h-12 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    <span className="inline-flex items-center">
                      Status
                      <SortIcon col="status" />
                    </span>
                  </TableHead>
                  <TableHead className="w-[160px] text-right whitespace-nowrap text-slate-500 font-semibold h-12">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-32 text-center text-muted-foreground"
                    >
                      {hasFilters
                        ? "Tidak ada email yang cocok dengan filter."
                        : "Belum ada data email."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((log, index) => {
                    const statusCfg =
                      STATUS_CONFIG[log.status] || STATUS_CONFIG.PENDING;
                    const StatusIcon = statusCfg.icon;
                    const typeCfg = TYPE_LABELS[log.type];

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-center text-muted-foreground font-medium">
                          {(currentPage - 1) * 20 + index + 1}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">
                          {formatDate(log.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap truncate">
                          {log.to}
                        </TableCell>
                        <TableCell
                          className="max-w-[300px] truncate hidden md:table-cell text-slate-600 text-sm"
                          title={log.subject}
                        >
                          {log.subject}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "transition-colors text-xs",
                              typeCfg?.className,
                            )}
                          >
                            {typeCfg?.label || log.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "transition-colors",
                              statusCfg.className,
                            )}
                          >
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusCfg.label}
                          </Badge>
                          {log.retryCount > 0 && (
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              retry: {log.retryCount}x
                            </span>
                          )}
                          {log.errorMessage && (
                            <p
                              className="text-[10px] text-red-500 mt-0.5 truncate max-w-[150px]"
                              title={log.errorMessage}
                            >
                              {log.errorMessage}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {log.status === "FAILED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
                                onClick={() => handleRetry(log.id)}
                                disabled={retryingId === log.id}
                                title="Kirim ulang"
                              >
                                {retryingId === log.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                )}
                                Retry
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}

                {/* Pagination Row */}
                {totalPages >= 1 && (
                  <TableRow className="hover:bg-transparent border-t bg-white">
                    <TableCell colSpan={7} className="p-0">
                      <div className="flex items-center justify-start sm:justify-between px-4 py-2">
                        <p className="text-xs text-muted-foreground hidden sm:block">
                          Menampilkan{" "}
                          <span className="font-medium text-slate-700">
                            {(currentPage - 1) * 20 + 1}
                          </span>{" "}
                          sampai{" "}
                          <span className="font-medium text-slate-700">
                            {Math.min(currentPage * 20, totalItems)}
                          </span>{" "}
                          dari{" "}
                          <span className="font-medium text-slate-700">
                            {totalItems}
                          </span>{" "}
                          email
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
