"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { UserFilterSelect } from "@/components/shared/user-filter-select";
import { Label } from "@/components/ui/label";
import { RefreshCcw, Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import { LogAction, LogModule } from "@prisma/client";
import { DatePickerWithPresets } from "@/components/ui/date-range-picker-presets";
import { DateRange } from "react-day-picker";
import {
  getPersonalLogs,
  getGlobalLogs,
  type LogActivityFilters,
} from "@/app/actions/log-activity-actions";
import { formatDateForInput } from "@/lib/date-utils";

export type LogActivityData = {
  id: string;
  action: LogAction;
  module: LogModule;
  description: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  periode: {
    id: string;
    nama: string;
  };
};

const actionConfig: Record<LogAction, { label: string; className: string }> = {
  CREATE: {
    label: "Tambah",
    className:
      "bg-green-100/80 text-green-700 border-green-200 hover:bg-green-200/80",
  },
  UPDATE: {
    label: "Update",
    className:
      "bg-blue-100/80 text-blue-700 border-blue-200 hover:bg-blue-200/80",
  },
  DELETE: {
    label: "Hapus",
    className: "bg-red-100/80 text-red-700 border-red-200 hover:bg-red-200/80",
  },
  IMPORT: {
    label: "Import Excel",
    className:
      "bg-teal-100/80 text-teal-700 border-teal-200 hover:bg-teal-200/80",
  },
  EXPORT: {
    label: "Export Excel",
    className:
      "bg-purple-100/80 text-purple-700 border-purple-200 hover:bg-purple-200/80",
  },
  APPROVE: {
    label: "Update",
    className:
      "bg-blue-100/80 text-blue-700 border-blue-200 hover:bg-blue-200/80",
  },
  REJECT: {
    label: "Update",
    className:
      "bg-blue-100/80 text-blue-700 border-blue-200 hover:bg-blue-100/80",
  },
  LOGIN: {
    label: "Login",
    className:
      "bg-emerald-100/80 text-emerald-700 border-emerald-200 hover:bg-emerald-200/80",
  },
  LOGOUT: {
    label: "Logout",
    className:
      "bg-orange-100/80 text-orange-700 border-orange-200 hover:bg-orange-200/80",
  },
};

const moduleConfig: Record<LogModule, { label: string; className: string }> = {
  ARSIP_SURAT: {
    label: "Arsip Surat",
    className: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",
  },
  ANGGOTA: {
    label: "Anggota",
    className: "bg-green-50 text-green-600 border-green-200 hover:bg-green-100",
  },
  BERKAS_PIMPINAN: {
    label: "Berkas Pimpinan",
    className:
      "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100",
  },
  BERKAS_SP: {
    label: "Berkas SP",
    className:
      "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100",
  },
  AGENDA_KEGIATAN: {
    label: "Kegiatan",
    className: "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100",
  },
  PENGAJUAN_BERKAS: {
    label: "Pengajuan PAC",
    className: "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100",
  },
  PERIODE: {
    label: "Periode",
    className: "bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100",
  },
  USER: {
    label: "Update Profil",
    className: "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100",
  },
  AUTH: {
    label: "Autentikasi",
    className: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100",
  },
  PRESENSI: {
    label: "Presensi",
    className:
      "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100",
  },
  WILAYAH: {
    label: "Wilayah",
    className: "bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100",
  },
};

type LogActivityListProps = {
  initialLogs: LogActivityData[];
  initialTotalPages: number;
  initialCurrentPage: number;
  initialTotalItems: number;
  initialView: "personal" | "global";
  userRole: string;
  pacUsers?: { id: string; name: string }[];
};

export function LogActivityList({
  initialLogs,
  initialTotalPages,
  initialCurrentPage,
  initialTotalItems,
  initialView,
  userRole,
  pacUsers = [],
}: LogActivityListProps) {
  // Local data state
  const [logs, setLogs] = useState<LogActivityData[]>(initialLogs);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [totalItems, setTotalItems] = useState(initialTotalItems);
  const [currentView, setCurrentView] = useState(initialView);
  const [isLoading, setIsLoading] = useState(false);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state from server props
  React.useEffect(() => {
    setLogs(initialLogs);
    setTotalPages(initialTotalPages);
    setTotalItems(initialTotalItems);
    setCurrentPage(initialCurrentPage);
  }, [initialLogs, initialTotalPages, initialTotalItems, initialCurrentPage]);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [userFilter, setUserFilter] = useState("ALL");

  const isCabang = userRole === "SEKRETARIS_CABANG";

  // Sort state global
  type LogSortKey = "createdAt" | "action" | "module" | "userName";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<LogSortKey | null>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: LogSortKey) => {
    let nextDir: SortDir = "asc";
    if (sortKey === key) {
      nextDir = sortDir === "asc" ? "desc" : "asc";
      setSortDir(nextDir);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
    const start = formatDateForInput(dateRange?.from);
    const end = formatDateForInput(dateRange?.to || dateRange?.from);
    fetchData(
      searchTerm,
      actionFilter,
      moduleFilter,
      start,
      end,
      1,
      currentView,
      userFilter,
      key,
      nextDir,
    );
  };

  const LogSortIcon = ({ col }: { col: LogSortKey }) => {
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

  const sortedLogs = logs;

  // Detect if user has active filters or pagination
  const isDirty =
    currentPage !== 1 ||
    searchTerm !== "" ||
    actionFilter !== "ALL" ||
    moduleFilter !== "ALL" ||
    dateRange !== undefined ||
    userFilter !== "ALL" ||
    sortKey !== "createdAt" ||
    sortDir !== "desc";

  const fetchData = React.useCallback(
    async (
      search: string,
      action: string,
      module: string,
      start: string,
      end: string,
      page: number,
      view: "personal" | "global",
      userId?: string,
      sKey: LogSortKey | null = sortKey,
      sDir: SortDir = sortDir,
      options: { silent?: boolean } = {},
    ) => {
      if (!options.silent) setIsLoading(true);
      try {
        const filters: LogActivityFilters = {};
        if (search) filters.search = search;
        if (action !== "ALL") filters.action = action;
        if (module !== "ALL") filters.module = module;
        if (start) filters.startDate = start;
        if (end) filters.endDate = end;
        if (userId && userId !== "ALL") filters.userId = userId;
        if (sKey) filters.sortKey = sKey;
        if (sDir) filters.sortDir = sDir;

        const data =
          view === "global"
            ? await getGlobalLogs(filters, page, 20)
            : await getPersonalLogs(filters, page, 20);

        setLogs(data.data as LogActivityData[]);
        setTotalPages(data.totalPages);
        setTotalItems(data.total);
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        if (!options.silent) setIsLoading(false);
      }
    },
    [sortKey, sortDir],
  );

  // REALTIME FIX: Smart Sync
  // When server props (initialLogs) update due to realtime router.refresh():
  // 1. If no filters (isDirty=false), sync directly with server data.
  // 2. If filters active (isDirty=true), re-fetch client-side to maintain filters but get new data.
  React.useEffect(() => {
    if (!isDirty) {
      setLogs(initialLogs);
      setTotalPages(initialTotalPages);
      setTotalItems(initialTotalItems);
    } else {
      const start = formatDateForInput(dateRange?.from);
      const end = formatDateForInput(dateRange?.to);

      // Refetch with current filters
      fetchData(
        searchTerm,
        actionFilter,
        moduleFilter,
        start,
        end,
        currentPage,
        currentView,
        userFilter,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLogs, initialTotalPages, initialTotalItems]);

  // Sync view from prop
  React.useEffect(() => {
    setCurrentView(initialView);
    // When view changes from props, we just sync the local state.
    // The key in parent will handle full reset if necessary.
  }, [initialView]);

  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      const isLogEvent =
        detail?.type === "log" ||
        (detail?.type === "mutation" && detail.model === "LogActivity");
      if (!isLogEvent) return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        const start = formatDateForInput(dateRange?.from);
        const end = formatDateForInput(dateRange?.to);
        fetchData(
          searchTerm,
          actionFilter,
          moduleFilter,
          start,
          end,
          currentPage,
          currentView,
          userFilter,
          sortKey,
          sortDir,
          { silent: true },
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
    actionFilter,
    moduleFilter,
    dateRange,
    currentPage,
    currentView,
    userFilter,
    sortKey,
    sortDir,
    fetchData,
  ]);

  const isFirstRender = useRef(true);

  // Debounced effect for search and dates
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const start = formatDateForInput(dateRange?.from);
      const end = formatDateForInput(dateRange?.to || dateRange?.from);

      fetchData(
        searchTerm,
        actionFilter,
        moduleFilter,
        start,
        end,
        currentPage,
        currentView,
        userFilter,
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [
    searchTerm,
    actionFilter,
    moduleFilter,
    dateRange,
    currentPage,
    currentView,
    userFilter,
    fetchData,
  ]);
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const start = formatDateForInput(dateRange?.from);
    const end = formatDateForInput(dateRange?.to || dateRange?.from);
    fetchData(
      searchTerm,
      actionFilter,
      moduleFilter,
      start,
      end,
      page,
      currentView,
      userFilter,
    );
  };

  const handleActionFilterChange = (val: string) => {
    setActionFilter(val);
    setCurrentPage(1);
    const start = formatDateForInput(dateRange?.from);
    const end = formatDateForInput(dateRange?.to || dateRange?.from);
    fetchData(
      searchTerm,
      val,
      moduleFilter,
      start,
      end,
      1,
      currentView,
      userFilter,
    );
  };

  const handleModuleFilterChange = (val: string) => {
    setModuleFilter(val);
    setCurrentPage(1);
    const start = formatDateForInput(dateRange?.from);
    const end = formatDateForInput(dateRange?.to || dateRange?.from);
    fetchData(
      searchTerm,
      actionFilter,
      val,
      start,
      end,
      1,
      currentView,
      userFilter,
    );
  };

  const handleUserFilterSelect = (val: string) => {
    setUserFilter(val);
    setCurrentPage(1);
    const start = formatDateForInput(dateRange?.from);
    const end = formatDateForInput(dateRange?.to || dateRange?.from);
    fetchData(
      searchTerm,
      actionFilter,
      moduleFilter,
      start,
      end,
      1,
      currentView,
      val,
    );
  };

  const handleReset = () => {
    setSearchTerm("");
    setActionFilter("ALL");
    setModuleFilter("ALL");
    setDateRange(undefined);
    setUserFilter("ALL");
    setSortKey("createdAt");
    setSortDir("desc");
    setCurrentPage(1);
    fetchData("", "ALL", "ALL", "", "", 1, currentView, "ALL", "createdAt", "desc");
  };


  return (
    <div className="space-y-6">
      {/* Filter Section - Matched with Reference Pattern */}
      <div className="flex flex-col md:flex-row gap-4 mb-4 items-end">
        {/* Date Range Picker with Presets */}
        <div className="flex-1 w-full relative">
          <Label className="text-xs font-medium mb-1 block">
            Rentang Tanggal
          </Label>
          <DatePickerWithPresets
            date={dateRange}
            onSelect={setDateRange}
            className="w-full bg-white border-slate-200 h-9"
          />
        </div>

        {/* User Filter - Only for Global View (Cabang) */}
        {currentView === "global" && isCabang && pacUsers.length > 0 && (
          <div className="flex-1 w-full">
            <Label className="text-xs font-medium mb-1 block">
              Filter User
            </Label>
            <UserFilterSelect
              users={pacUsers}
              selectedUserId={userFilter}
              onSelectUser={handleUserFilterSelect}
              placeholder="Pilih User"
            />
          </div>
        )}

        {/* Action */}
        <div className="flex-1 w-full">
          <Label className="text-xs font-medium mb-1 block">Entitas</Label>
          <Select value={actionFilter} onValueChange={handleActionFilterChange}>
            <SelectTrigger className="w-full bg-white h-9 text-sm border-slate-200 shadow-sm">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              {Object.entries(actionConfig)
                .filter(([key]) => !["APPROVE", "REJECT"].includes(key))
                .map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Module */}
        <div className="flex-1 w-full">
          <Label className="text-xs font-medium mb-1 block">Modul/Menu</Label>
          <Select value={moduleFilter} onValueChange={handleModuleFilterChange}>
            <SelectTrigger className="w-full bg-white h-9 text-sm border-slate-200 shadow-sm">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              {Object.entries(moduleConfig).filter(([key]) => key !== "USER").map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons Group */}
        <div className="w-full md:w-auto">
          <Button
            variant="outline"
            className={cn(
              "h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm whitespace-nowrap transition-all duration-200",
              searchTerm !== "" ||
                actionFilter !== "ALL" ||
                moduleFilter !== "ALL" ||
                dateRange !== undefined ||
                userFilter !== "ALL" ||
                sortKey !== "createdAt" ||
                sortDir !== "desc"
                ? "text-slate-900 border-slate-300 opacity-100"
                : "text-slate-400 border-slate-200 opacity-50 cursor-not-allowed",
            )}
            onClick={handleReset}
            disabled={
              !isLoading &&
              searchTerm === "" &&
              actionFilter === "ALL" &&
              moduleFilter === "ALL" &&
              dateRange === undefined &&
              userFilter === "ALL" &&
              sortKey === "createdAt" &&
              sortDir === "desc"
            }
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
            <Table className="w-full [&_td]:py-3 [&_th]:py-3">
              <TableHeader className="sticky top-0 bg-white z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                <TableRow className="bg-slate-50/40 hover:bg-slate-50/40 border-b-slate-100">
                  <TableHead className="w-[50px] text-center text-slate-500 font-semibold h-12 whitespace-nowrap">
                    No
                  </TableHead>
                  <TableHead
                    className="w-[140px] whitespace-nowrap text-slate-500 font-semibold h-12 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("createdAt")}
                  >
                    <span className="inline-flex items-center">
                      Waktu
                      <LogSortIcon col="createdAt" />
                    </span>
                  </TableHead>
                  {currentView === "global" && (
                    <TableHead
                      className="w-[130px] whitespace-nowrap text-slate-500 font-semibold h-12 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort("userName")}
                    >
                      <span className="inline-flex items-center">
                        User
                        <LogSortIcon col="userName" />
                      </span>
                    </TableHead>
                  )}
                  <TableHead
                    className="w-[100px] whitespace-nowrap text-slate-500 font-semibold h-12 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("action")}
                  >
                    <span className="inline-flex items-center">
                      Entitas
                      <LogSortIcon col="action" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[110px] whitespace-nowrap text-slate-500 font-semibold h-12 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("module")}
                  >
                    <span className="inline-flex items-center">
                      Menu
                      <LogSortIcon col="module" />
                    </span>
                  </TableHead>
                  <TableHead className="text-slate-500 font-semibold h-12">
                    Aktivitas
                  </TableHead>
                  <TableHead className="w-[60px] text-right text-slate-500 font-semibold h-12">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={currentView === "global" ? 7 : 6}
                      className="h-32 text-center text-muted-foreground"
                    >
                      Belum ada riwayat aktivitas pada periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedLogs.map((log, index) => (
                    <TableRow
                      key={log.id}
                      className="group transition-all hover:bg-slate-50/50"
                    >
                      <TableCell className="text-center text-muted-foreground font-medium whitespace-nowrap">
                        {(currentPage - 1) * 20 + index + 1}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-slate-600">
                        {new Date(log.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                        {" - "}
                        {new Date(log.createdAt).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </TableCell>
                      {currentView === "global" && (
                        <TableCell className="whitespace-nowrap max-w-[120px] truncate" title={log.user.name}>
                          {log.user.name}
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            "whitespace-nowrap transition-colors",
                            actionConfig[log.action]?.className,
                          )}
                        >
                          {actionConfig[log.action]?.label || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            "whitespace-nowrap transition-colors",
                            moduleConfig[log.module]?.className,
                          )}
                        >
                          {moduleConfig[log.module]?.label || log.module}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 text-[13px] leading-relaxed">
                        <div
                          className="max-w-[120px] sm:max-w-[180px] md:max-w-[240px] lg:max-w-[340px] xl:max-w-[480px] truncate"
                          title={log.description}
                        >
                          {log.description}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 border-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
                          asChild
                        >
                          <Link href={`/dashboard/log-activity/${log.id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}

                {/* Pagination Row - Consistent with other modules */}
                {totalPages >= 1 && (
                  <TableRow className="hover:bg-transparent border-t bg-slate-50/30">
                    <TableCell
                      colSpan={currentView === "global" ? 7 : 6}
                      className="p-0"
                    >
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
                            {new Intl.NumberFormat("id-ID").format(totalItems)}
                          </span>{" "}
                          data
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
