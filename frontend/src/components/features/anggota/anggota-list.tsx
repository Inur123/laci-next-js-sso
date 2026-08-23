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
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  Pencil,
  Trash2,
  Search,
  User as UserIcon,
  RefreshCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { deleteAnggota, getAnggotaList } from "@/app/actions/anggota-actions";
import { logExport } from "@/app/actions/log-activity-actions";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, capitalizeName } from "@/lib/utils";
import { Check, X, FileSpreadsheet } from "lucide-react";
import XLSX from "xlsx-js-style";
import { VerifikasiDialog } from "./verifikasi-dialog";

type AnggotaItem = {
  id: string;
  namaLengkap: string;
  nik?: string | null;
  nia?: string | null;
  jenisKelamin?: string | null;
  tempatLahir?: string | null;
  tanggalLahir?: Date | string | null;
  alamatLengkap?: string | null;
  noHp?: string | null;
  email?: string | null;
  jabatan?: string | null;
  noRfid?: string | null;
  pekerjaan?: string | null;
  foto?: string | null;
  updatedAt?: Date | string | null;
  pendidikans?: Array<{
    jenjang: string;
    namaSekolah: string;
  }>;
  user?: { name?: string | null } | null;
  periode?: { nama?: string | null } | null;
  perkaderans?: Array<{
    namaPerkaderan: string;
    tanggal: Date | string;
    tempat: string;
  }>;
  status?: "PENDING" | "DITERIMA" | "DITOLAK";
  alasanPenolakan?: string | null;
};

type SortKey =
  | "namaLengkap"
  | "jabatan"
  | "jenisKelamin"
  | "noHp"
  | "periode"
  | "dibuatOleh";
type SortDir = "asc" | "desc";

import { UserFilterSelect } from "@/components/shared/user-filter-select";
import { ConfirmModal } from "@/components/shared/confirm-modal";

export function AnggotaList({
  anggotaList: initialAnggotaList,
  userRole,
  totalPages: initialTotalPages,
  currentPage: initialCurrentPage,
  totalItems: initialTotalItems,
  activeUsers,
  initialSearchTerm = "",
  initialSelectedUser = "ALL",
  initialSortKey = "namaLengkap",
  initialSortDir = "asc",
  initialStatus = "PENDING",
}: {
  anggotaList: AnggotaItem[];
  userRole: string;
  totalPages: number;
  currentPage: number;
  totalItems: number;
  activeUsers?: { id: string; name: string }[];
  initialSearchTerm?: string;
  initialSelectedUser?: string;
  initialSortKey?: string;
  initialSortDir?: string;
  initialStatus?: "PENDING" | "DITERIMA" | "DITOLAK";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local data state
  const [data, setData] = useState<AnggotaItem[]>(initialAnggotaList);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [totalItems, setTotalItems] = useState(initialTotalItems);

  // Sync state with props (important for URL changes and statistics update)
  useEffect(() => {
    setData(initialAnggotaList);
    setTotalPages(initialTotalPages);
    setCurrentPage(initialCurrentPage);
    setTotalItems(initialTotalItems);
    setActiveTab(initialStatus);
  }, [
    initialAnggotaList,
    initialTotalPages,
    initialCurrentPage,
    initialTotalItems,
    initialStatus,
  ]);

  // Filter state
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedUser, setSelectedUser] = useState(initialSelectedUser);
  const [activeTab, setActiveTab] = useState(initialStatus || "PENDING");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [optimisticHiddenIds, setOptimisticHiddenIds] = useState<string[]>([]);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey | null>(
    (initialSortKey as SortKey) || "namaLengkap",
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    initialSortDir === "desc" ? "desc" : "asc",
  );

  useEffect(() => {
    setSearchTerm(initialSearchTerm);
    setSelectedUser(initialSelectedUser);
    setSortKey((initialSortKey as SortKey) || "namaLengkap");
    setSortDir(initialSortDir === "desc" ? "desc" : "asc");
  }, [
    initialSearchTerm,
    initialSelectedUser,
    initialSortKey,
    initialSortDir,
  ]);

  const handleSort = (key: SortKey) => {
    let nextDir: SortDir = "asc";
    if (sortKey === key) {
      nextDir = sortDir === "asc" ? "desc" : "asc";
      setSortDir(nextDir);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
    fetchData(searchTerm, 1, selectedUser, key, nextDir, activeTab);
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
      page: number,
      userId: string,
      sKey: SortKey | null,
      sDir: SortDir,
      statusTab: "PENDING" | "DITERIMA" | "DITOLAK"
    ) => {
      try {
        const result = await getAnggotaList(
          query,
          page,
          10,
          userId,
          undefined,
          sKey,
          sDir,
          statusTab
        );
        setData(result.data as AnggotaItem[]);
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
    [],
  );

  // Debounced Search Update
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchData(searchTerm, 1, selectedUser, sortKey, sortDir, activeTab);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedUser, sortKey, sortDir, activeTab, fetchData]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "Anggota") return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        fetchData(searchTerm, currentPage, selectedUser, sortKey, sortDir, activeTab);
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
  }, [searchTerm, currentPage, selectedUser, sortKey, sortDir, activeTab, fetchData]);

  const handleUserFilterChange = (value: string) => {
    setSelectedUser(value);
    setCurrentPage(1);

    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") {
      params.delete("userId");
    } else {
      params.set("userId", value);
    }
    params.set("page", "1");
    router.push(`?${params.toString()}`, { scroll: false });

    fetchData(searchTerm, 1, value, sortKey, sortDir, activeTab);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedUser("ALL");
    setCurrentPage(1);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("userId");
    params.delete("q");
    params.set("page", "1");
    router.push(`?${params.toString()}`, { scroll: false });

    fetchData("", 1, "ALL", sortKey, sortDir, activeTab);
  };

  // Handle Page Change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(searchTerm, page, selectedUser, sortKey, sortDir, activeTab);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setOptimisticHiddenIds((prev) => [...prev, id]);

    const result = await deleteAnggota(id);

    if (result.error) {
      setOptimisticHiddenIds((prev) => prev.filter((pid) => pid !== id));
      toast.error(result.error);
    } else {
      toast.success("Anggota berhasil dihapus");
      fetchData(searchTerm, currentPage, selectedUser, sortKey, sortDir, activeTab);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleExportExcel = async () => {
    if (totalItems === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    toast.info("Menyiapkan data export...");

    const dateStr = new Date().toLocaleDateString("id-ID").replace(/\//g, "-");

    let userName = "All";
    if (selectedUser !== "ALL" && activeUsers) {
      const user = activeUsers.find((u) => u.id === selectedUser);
      if (user) userName = user.name;
    }
    const safeUserName = userName.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Data_Anggota_${safeUserName}_${dateStr}.xlsx`;

    // Fetch ALL data (bypass pagination)
    let allData = data;
    if (totalItems > data.length) {
      try {
        const result = await getAnggotaList(searchTerm, 1, 9999, selectedUser);
        allData = result.data as AnggotaItem[];
      } catch {
        toast.error("Gagal mengambil semua data untuk export");
        return;
      }
    }

    const exportData: Record<string, string | number>[] = allData.map(
      (item, index) => ({
        No: index + 1,
        Nama: item.namaLengkap,
        NIK: item.nik || "-",
        NIA: item.nia || "-",
        "Jenis Kelamin":
          item.jenisKelamin === "LAKI_LAKI" ? "Laki-laki" : "Perempuan",
        "Tempat Lahir": item.tempatLahir || "-",
        "Tanggal Lahir": item.tanggalLahir
          ? new Date(item.tanggalLahir).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "-",
        Alamat: item.alamatLengkap || "-",
        "No HP": item.noHp || "-",
        Email: item.email || "-",
        Jabatan: item.jabatan || "-",
        Pekerjaan: item.pekerjaan || "-",
        SD:
          item.pendidikans?.find((p) => p.jenjang === "SD")?.namaSekolah ||
          "-",
        MI:
          item.pendidikans?.find((p) => p.jenjang === "MI")?.namaSekolah ||
          "-",
        SMP:
          item.pendidikans?.find((p) => p.jenjang === "SMP")?.namaSekolah ||
          "-",
        MTs:
          item.pendidikans?.find((p) => p.jenjang === "MTs")?.namaSekolah ||
          "-",
        SMA:
          item.pendidikans?.find((p) => p.jenjang === "SMA")?.namaSekolah ||
          "-",
        SMK:
          item.pendidikans?.find((p) => p.jenjang === "SMK")?.namaSekolah ||
          "-",
        MAN:
          item.pendidikans?.find((p) => p.jenjang === "MAN")?.namaSekolah ||
          "-",
        KULIAH:
          item.pendidikans?.find((p) => p.jenjang === "KULIAH")?.namaSekolah ||
          "-",
        Makesta:
          item.perkaderans
            ?.filter((p) => p.namaPerkaderan.toUpperCase() === "MAKESTA")
            .map(
              (p) =>
                `${new Date(p.tanggal).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })} (${p.tempat})`,
            )
            .join(", ") || "-",
        Lakmud:
          item.perkaderans
            ?.filter((p) => p.namaPerkaderan.toUpperCase() === "LAKMUD")
            .map(
              (p) =>
                `${new Date(p.tanggal).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })} (${p.tempat})`,
            )
            .join(", ") || "-",
        Lakut:
          item.perkaderans
            ?.filter((p) => p.namaPerkaderan.toUpperCase() === "LAKUT")
            .map(
              (p) =>
                `${new Date(p.tanggal).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })} (${p.tempat})`,
            )
            .join(", ") || "-",
        Diklatama:
          item.perkaderans
            ?.filter((p) => p.namaPerkaderan.toUpperCase() === "DIKLATAMA")
            .map(
              (p) =>
                `${new Date(p.tanggal).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })} (${p.tempat})`,
            )
            .join(", ") || "-",
        Diklatmad:
          item.perkaderans
            ?.filter((p) => p.namaPerkaderan.toUpperCase() === "DIKLATMAD")
            .map(
              (p) =>
                `${new Date(p.tanggal).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })} (${p.tempat})`,
            )
            .join(", ") || "-",
        Latin:
          item.perkaderans
            ?.filter((p) => p.namaPerkaderan.toUpperCase() === "LATIN")
            .map(
              (p) =>
                `${new Date(p.tanggal).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })} (${p.tempat})`,
            )
            .join(", ") || "-",
        Latpel:
          item.perkaderans
            ?.filter((p) => p.namaPerkaderan.toUpperCase() === "LATPEL")
            .map(
              (p) =>
                `${new Date(p.tanggal).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })} (${p.tempat})`,
            )
            .join(", ") || "-",
        "No RFID": item.noRfid || "-",
        "Dibuat Oleh": item.user?.name || "-",
        Periode: item.periode?.nama || "-",
      }),
    );

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:N1");
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Anggota");
    XLSX.writeFile(workbook, filename);
    logExport("ANGGOTA", filename);
    toast.success("File excel berhasil didownload!");
  };

  return (
    <div className="space-y-6">
      {/* Filter Section - Matched with Reference Pattern */}
      <div className="flex flex-col md:flex-row gap-4 mb-4 items-end">
        {/* Search */}
        <div className="flex-1 w-full relative">
          <Label className="text-xs font-medium mb-1 block">Cari Anggota</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, jabatan, NIK, atau NIA..."
              className="pl-9 w-full bg-white h-9 text-sm border-slate-200 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* User Filter - Cabang Only */}
        {activeUsers && activeUsers.length > 0 && (
          <div className="w-full md:w-64">
            <Label className="text-xs font-medium mb-1 block">
              Filter User
            </Label>
            <UserFilterSelect
              users={activeUsers}
              selectedUserId={selectedUser}
              onSelectUser={handleUserFilterChange}
              className="h-9"
            />
          </div>
        )}

        {/* Actions Section */}
        <div className="grid grid-cols-2 gap-2 w-full md:flex md:w-auto md:items-center md:justify-end md:gap-3 lg:justify-start">
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

          <Button
            variant="outline"
            className={cn(
              "h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm whitespace-nowrap transition-all duration-200",
              searchTerm !== "" || selectedUser !== "ALL"
                ? "text-slate-900 border-slate-300 opacity-100"
                : "text-slate-400 border-slate-200 opacity-50 cursor-not-allowed",
            )}
            onClick={handleResetFilters}
            disabled={searchTerm === "" && selectedUser === "ALL"}
          >
            <RefreshCcw className="mr-2 h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      <div className="relative">
        <div className="rounded-md border">
          <div className="relative max-h-[600px] overflow-auto">
            <Table className="min-w-[900px]">
              <TableHeader className="sticky top-0 bg-white z-10 border-b">
                <TableRow>
                  <TableHead className="w-[50px] bg-slate-50/40 text-center whitespace-nowrap text-slate-500 font-semibold h-11">
                    No
                  </TableHead>
                  <TableHead
                    className="w-[250px] bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("namaLengkap")}
                  >
                    <span className="inline-flex items-center">
                      Nama
                      <SortIcon col="namaLengkap" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[120px] bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("periode")}
                  >
                    <span className="inline-flex items-center">
                      Periode
                      <SortIcon col="periode" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[120px] bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("jenisKelamin")}
                  >
                    <span className="inline-flex items-center">
                      Jenis Kelamin
                      <SortIcon col="jenisKelamin" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[180px] bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("noHp")}
                  >
                    <span className="inline-flex items-center">
                      No. HP
                      <SortIcon col="noHp" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[150px] bg-slate-50/40 whitespace-nowrap text-slate-500 font-semibold h-11 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("dibuatOleh")}
                  >
                    <span className="inline-flex items-center">
                      Dibuat Oleh
                      <SortIcon col="dibuatOleh" />
                    </span>
                  </TableHead>
                  <TableHead className="w-[100px] bg-slate-50/40 text-right whitespace-nowrap text-slate-500 font-semibold h-11">
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
                      colSpan={7}
                      className="h-32 text-center text-muted-foreground"
                    >
                      {searchTerm
                        ? "Tidak ada data anggota yang cocok dengan filter."
                        : "Belum ada data anggota."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData
                    .filter((item) => !optimisticHiddenIds.includes(item.id))
                    .map((item, index) => (
                      <TableRow
                        key={item.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <TableCell className="text-center text-slate-500 font-medium whitespace-nowrap">
                          {(currentPage - 1) * 10 + index + 1}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-slate-100 shadow-sm">
                              <AvatarImage
                                src={
                                  item.foto
                                    ? `/api/anggota/${item.id}/image?v=${item.updatedAt}`
                                    : ""
                                }
                                className="object-cover"
                              />
                              <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-bold">
                                {getInitials(item.namaLengkap)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-slate-900 truncate text-sm">
                                {capitalizeName(item.namaLengkap)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant="secondary"
                            className="font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200"
                          >
                            {item.periode?.nama || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="text-xs font-medium text-slate-700">
                            {item.jenisKelamin === "LAKI_LAKI"
                              ? "Laki-laki"
                              : "Perempuan"}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="text-xs text-slate-600 font-medium">
                            {item.noHp || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <UserIcon size={12} className="text-slate-400" />
                            <span className="text-xs text-slate-600 truncate max-w-[120px]">
                              {item.user?.name
                                ? capitalizeName(item.user.name)
                                : "-"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {activeTab === "PENDING" ? (
                              <VerifikasiDialog 
                                anggota={item} 
                                onVerified={() => fetchData(searchTerm, currentPage, selectedUser, sortKey, sortDir, activeTab)} 
                              />
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 p-0 border-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
                                  asChild
                                  title="Lihat Detail"
                                >
                                  <Link href={`/dashboard/anggota/${item.id}`}>
                                    <Eye className="w-4 h-4" />
                                  </Link>
                                </Button>
                                {activeTab === "DITERIMA" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 border-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
                                    asChild
                                    title="Edit"
                                  >
                                    <Link href={`/dashboard/anggota/${item.id}/edit`}>
                                      <Pencil className="w-4 h-4" />
                                    </Link>
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 p-0 border-slate-200 text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  title="Hapus"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                )}

                {/* Pagination Row - Consistent with reference pattern */}
                {totalPages >= 1 && (
                  <TableRow className="hover:bg-transparent border-t bg-slate-50/30">
                    <TableCell colSpan={7} className="p-0">
                      <div className="flex items-center justify-between px-4 py-2">
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
                          anggota
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
      </div>

        <ConfirmModal
          isOpen={confirmDeleteId !== null}
          onClose={() => setConfirmDeleteId(null)}
          onConfirm={handleDelete}
          title="Hapus Anggota"
          description="Apakah Anda yakin ingin menghapus data anggota ini? Tindakan ini tidak dapat dibatalkan."
          confirmText="Hapus"
          cancelText="Batal"
        />
    </div>
  );
}
