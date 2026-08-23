"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteBerkasSP,
  getBerkasSPs,
  bulkImportBerkasSP,
} from "@/app/actions/berkas-sp-actions";
import { logExport, logImport } from "@/app/actions/log-activity-actions";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import XLSX from "xlsx-js-style";
import {
  FileUp,
  Eye,
  Pencil,
  Trash2,
  Search,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

const capitalizeName = (name: string) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

type BerkasSP = {
  id: string;
  nama: string;
  organisasi: string | null;
  tanggalMulai: Date;
  tanggalBerakhir: Date;
  catatan: string | null;
  file: string | null;
};

const organisasiConfig: Record<string, { label: string; className: string }> = {
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
};

const getStatusBadge = (tanggalBerakhir: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(tanggalBerakhir);
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <Badge
        variant="outline"
        className="bg-rose-50 text-rose-700 border-rose-200 mt-1 text-[10px] leading-3 h-5 px-1.5 font-medium whitespace-nowrap"
      >
        Kedaluwarsa (Lewat {Math.abs(diffDays)} Hari)
      </Badge>
    );
  } else if (diffDays === 0) {
    return (
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-700 border-amber-200 mt-1 text-[10px] leading-3 h-5 px-1.5 font-semibold whitespace-nowrap animate-pulse"
      >
        Berakhir Hari Ini!
      </Badge>
    );
  } else if (diffDays <= 30) {
    return (
      <Badge
        variant="outline"
        className="bg-orange-50 text-orange-700 border-orange-200 mt-1 text-[10px] leading-3 h-5 px-1.5 whitespace-nowrap"
      >
        Hampir Habis (Sisa {diffDays} Hari)
      </Badge>
    );
  } else {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-50 text-emerald-700 border-emerald-200 mt-1 text-[10px] leading-3 h-5 px-1.5 whitespace-nowrap"
      >
        Aktif (Sisa {diffDays} Hari)
      </Badge>
    );
  }
};

export function BerkasSPList({
  berkasSPList: initialBerkasSPList,
  userRole,
  totalPages: initialTotalPages,
  currentPage: initialCurrentPage,
  totalItems: initialTotalItems,
}: {
  berkasSPList: BerkasSP[];
  userRole: string;
  totalPages: number;
  currentPage: number;
  totalItems: number;
}) {
  // Local data state
  const [data, setData] = useState<BerkasSP[]>(initialBerkasSPList);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [totalItems, setTotalItems] = useState(initialTotalItems);
  const [importLoading, setImportLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [orgFilter, setOrgFilter] = useState("ALL");

  // Sort state
  type SortKey =
    | "nama"
    | "tanggalMulai"
    | "tanggalBerakhir"
    | "organisasi"
    | "catatan"
    | "status";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey | null>("tanggalMulai");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const isFirstRender = useRef(true);

  // Function to fetch data with sorting parameters
  const fetchData = async (
    query: string,
    org: string,
    page: number,
    sKey: SortKey | null = sortKey,
    sDir: SortDir = sortDir,
  ) => {
    setIsLoading(true);
    try {
      const result = await getBerkasSPs(query, org, page, 10, sKey, sDir);
      setData(result.data as BerkasSP[]);
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
    fetchData(searchTerm, orgFilter, 1, key, newDir);
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

  // Server sudah melakukan pengurutan secara global, sehingga klien cukup langsung menampilkan datanya
  const sortedData = data;

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [optimisticHiddenIds, setOptimisticHiddenIds] = useState<string[]>([]);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchData(searchTerm, orgFilter, 1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, orgFilter]);

  // Realtime listener
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "BerkasSP") return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        fetchData(searchTerm, orgFilter, currentPage);
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
  }, [searchTerm, orgFilter, currentPage]);

  const handleOrgFilterChange = (val: string) => {
    setOrgFilter(val);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(searchTerm, orgFilter, page);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;

    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setOptimisticHiddenIds((prev) => [...prev, id]);

    const result = await deleteBerkasSP(id);

    if (result.error) {
      setOptimisticHiddenIds((prev) => prev.filter((pid) => pid !== id));
      toast.error(result.error);
    } else {
      toast.success("Berkas SP berhasil dihapus");
      fetchData(searchTerm, orgFilter, currentPage);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImportLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: true,
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      if (rows.length === 0) {
        toast.error("File Excel kosong atau tidak ada data.");
        return;
      }

      const importData = rows.map((row) => {
        let tglMulaiStr = "";
        let tglBerakhirStr = "";

        const rawMulai = row["Tanggal Mulai"];
        const rawBerakhir = row["Tanggal Berakhir"];

        if (rawMulai instanceof Date) {
          tglMulaiStr = `${rawMulai.getFullYear()}-${String(rawMulai.getMonth() + 1).padStart(2, "0")}-${String(rawMulai.getDate()).padStart(2, "0")}`;
        } else {
          tglMulaiStr = String(rawMulai ?? "");
        }

        if (rawBerakhir instanceof Date) {
          tglBerakhirStr = `${rawBerakhir.getFullYear()}-${String(rawBerakhir.getMonth() + 1).padStart(2, "0")}-${String(rawBerakhir.getDate()).padStart(2, "0")}`;
        } else {
          tglBerakhirStr = String(rawBerakhir ?? "");
        }

        return {
          nama: String(row["Nama Pimpinan"] ?? ""),
          organisasi: row["Organisasi"] ? String(row["Organisasi"]) : undefined,
          tanggalMulai: tglMulaiStr,
          tanggalBerakhir: tglBerakhirStr,
          catatan: row["Catatan"] ? String(row["Catatan"]) : undefined,
        };
      });

      const result = await bulkImportBerkasSP(importData);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (result.success > 0) {
        toast.success(
          `${result.success} berkas berhasil diimport!${
            result.failed > 0 ? ` (${result.failed} baris gagal)` : ""
          }`,
        );
        logImport("BERKAS_SP", result.success, result.failed); // Fire and forget
        window.dispatchEvent(
          new CustomEvent("laci-realtime", {
            detail: { type: "mutation", model: "BerkasSP" },
          }),
        );
      } else {
        toast.error(`Semua baris gagal. ${result.failedRows[0] ?? ""}`);
      }

      fetchData(searchTerm, orgFilter, currentPage);
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Gagal membaca file. Pastikan format .xlsx benar.");
    } finally {
      setImportLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Nama Pimpinan": "Nama Pengurus / Pimpinan",
        Organisasi: "IPNU",
        "Tanggal Mulai": "2025-01-01",
        "Tanggal Berakhir": "2027-01-01",
        Catatan: "(opsional)",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [
      { wch: 25 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Import_Berkas_SP.xlsx");
    toast.info("Template berhasil didownload.");
  };

  const handleExportExcel = async () => {
    if (totalItems === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    toast.info("Menyiapkan data export...");

    const dateStr = new Date().toLocaleDateString("id-ID").replace(/\//g, "-");
    const filename = `Berkas_SP_${dateStr}.xlsx`;

    // Fetch ALL data (bypass pagination)
    let allData = data;
    if (totalItems > data.length) {
      try {
        const result = await getBerkasSPs(searchTerm, orgFilter, 1, 9999);
        allData = result.data as BerkasSP[];
      } catch {
        toast.error("Gagal mengambil semua data untuk export");
        return;
      }
    }

    const exportData: Record<string, string | number>[] = allData.map(
      (item, index) => ({
        No: index + 1,
        "Nama Pimpinan": item.nama,
        Organisasi: item.organisasi || "-",
        "Tanggal Mulai": new Date(item.tanggalMulai).toLocaleDateString(
          "id-ID",
          {
            day: "numeric",
            month: "long",
            year: "numeric",
          },
        ),
        "Tanggal Berakhir": new Date(item.tanggalBerakhir).toLocaleDateString(
          "id-ID",
          {
            day: "numeric",
            month: "long",
            year: "numeric",
          },
        ),
        Catatan: item.catatan || "-",
      }),
    );

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:G1");
    const headerColor = userRole === "SEKRETARIS_CABANG" ? "3b82f6" : "10b981";

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
      if (!worksheet[address]) continue;
      worksheet[address].s = headerStyle;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Berkas SP");

    const wscols = Object.keys(exportData[0] || {}).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...exportData.map((row) => String(row[key] || "").length),
      );
      return { wch: Math.min(maxLen + 2, 50) };
    });
    worksheet["!cols"] = wscols;

    XLSX.writeFile(workbook, filename);
    logExport("BERKAS_SP", filename);
    toast.success("File excel berhasil didownload!");
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-col md:flex-row gap-4 mb-4 items-end">
        <div className="flex-2 relative w-full">
          <Label className="text-xs font-medium mb-1 block">Cari Berkas</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama pimpinan atau catatan..."
              className="pl-9 w-full bg-white h-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="w-full md:w-72">
          <Label className="text-xs font-medium mb-1 block">Organisasi</Label>
          <Select value={orgFilter} onValueChange={handleOrgFilterChange}>
            <SelectTrigger className="w-full bg-white h-9 text-sm">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              <SelectItem value="IPNU">IPNU</SelectItem>
              <SelectItem value="IPPNU">IPPNU</SelectItem>
              <SelectItem value="BERSAMA">BERSAMA</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full md:flex md:w-auto md:items-center md:justify-end md:gap-4 lg:justify-start">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportExcel}
          />

          <Button
            variant="outline"
            className="h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm whitespace-nowrap"
            onClick={() => importInputRef.current?.click()}
            disabled={isLoading || importLoading}
          >
            {importLoading ? (
              <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            ) : (
              <FileUp
                className={cn(
                  "mr-2 h-3.5 w-3.5",
                  userRole === "SEKRETARIS_CABANG"
                    ? "text-blue-600"
                    : "text-green-600",
                )}
              />
            )}
            Import
          </Button>

          <Button
            variant="outline"
            className="h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm whitespace-nowrap"
            onClick={handleExportExcel}
            disabled={isLoading || importLoading}
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
                    className="w-[200px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("nama")}
                  >
                    <span className="inline-flex items-center">
                      Nama Pimpinan
                      <SortIcon col="nama" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[120px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("organisasi")}
                  >
                    <span className="inline-flex items-center">
                      Organisasi
                      <SortIcon col="organisasi" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[150px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("tanggalMulai")}
                  >
                    <span className="inline-flex items-center">
                      Tanggal Mulai
                      <SortIcon col="tanggalMulai" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[150px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("tanggalBerakhir")}
                  >
                    <span className="inline-flex items-center">
                      Tanggal Berakhir
                      <SortIcon col="tanggalBerakhir" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[150px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    <span className="inline-flex items-center">
                      Status
                      <SortIcon col="status" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("catatan")}
                  >
                    <span className="inline-flex items-center">
                      Catatan
                      <SortIcon col="catatan" />
                    </span>
                  </TableHead>
                  <TableHead className="w-[130px] text-right bg-slate-50/40 whitespace-nowrap">
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
                      colSpan={8}
                      className="h-32 text-center text-muted-foreground"
                    >
                      {searchTerm || orgFilter !== "ALL"
                        ? "Tidak ada data berkas SP yang cocok dengan filter."
                        : "Belum ada data berkas SP."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData
                    .filter((item) => !optimisticHiddenIds.includes(item.id))
                    .map((berkas, index) => (
                      <TableRow key={berkas.id}>
                        <TableCell className="text-center text-muted-foreground font-medium whitespace-nowrap">
                          {(currentPage - 1) * 10 + index + 1}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {capitalizeName(berkas.nama)}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {berkas.organisasi && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-medium whitespace-nowrap",
                                organisasiConfig[berkas.organisasi]
                                  ?.className ||
                                  "bg-slate-50 text-slate-700 border-slate-200",
                              )}
                            >
                              {organisasiConfig[berkas.organisasi]?.label ||
                                berkas.organisasi}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap pr-6">
                          {new Date(berkas.tanggalMulai).toLocaleDateString(
                            "id-ID",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap pr-6">
                          {new Date(berkas.tanggalBerakhir).toLocaleDateString(
                            "id-ID",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {getStatusBadge(berkas.tanggalBerakhir)}
                        </TableCell>
                        <TableCell
                          className="truncate max-w-[400px] whitespace-nowrap"
                          title={berkas.catatan || ""}
                        >
                          {berkas.catatan
                            ? capitalizeName(berkas.catatan)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              asChild
                              title="Lihat Detail"
                            >
                              <Link href={`/dashboard/berkas-sp/${berkas.id}`}>
                                <Eye className="w-4 h-4" />
                              </Link>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              asChild
                              title="Edit"
                            >
                              <Link
                                href={`/dashboard/berkas-sp/${berkas.id}/edit`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                              onClick={() => setConfirmDeleteId(berkas.id)}
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                )}

                {/* Pagination Row - integrated into table body */}
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
                          berkas
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
        title="Hapus Berkas SP?"
        description={`Apakah Anda yakin ingin menghapus berkas SP milik "${capitalizeName(data.find((b) => b.id === confirmDeleteId)?.nama || "")}"? Tindakan ini tidak dapat dibatalkan dan file terkait akan dihapus secara permanen.`}
        variant="destructive"
        loading={false}
      />
    </div>
  );
}
