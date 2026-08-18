"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Eye,
  Pencil,
  Trash2,
  Search,
  FileSpreadsheet,
  FileUp,
  RefreshCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  deleteArsipSurat,
  getArsipSurats,
  bulkImportArsipSurat,
} from "@/app/actions/arsip-actions";
import { logExport, logImport } from "@/app/actions/log-activity-actions";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import XLSX from "xlsx-js-style";
import { cn } from "@/lib/utils";

import { DecryptedArsipSurat } from "@/types";

const capitalizeName = (name: string) => {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export function ArsipSuratList({
  arsipSurats: initialArsipSurats,
  userRole,
  totalPages: initialTotalPages,
  currentPage: initialCurrentPage,
  totalItems: initialTotalItems,
}: {
  arsipSurats: DecryptedArsipSurat[];
  userRole: string;
  totalPages: number;
  currentPage: number;
  totalItems: number;
}) {
  // Local data state
  const [data, setData] = useState<DecryptedArsipSurat[]>(initialArsipSurats);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [totalItems, setTotalItems] = useState(initialTotalItems);
  const [importLoading, setImportLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [orgFilter, setOrgFilter] = useState("ALL");
  const [jenisFilter, setJenisFilter] = useState("ALL");

  // Sort state
  type SortKey =
    | "tanggal"
    | "noSurat"
    | "pengirimPenerima"
    | "perihal"
    | "organisasi"
    | "jenisSurat";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey | null>("tanggal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Function to fetch data with sorting parameters
  const isFirstRender = useRef(true);

  const fetchData = async (
    query: string,
    org: string,
    jenis: string,
    page: number,
    sKey: SortKey | null = sortKey,
    sDir: SortDir = sortDir,
  ) => {
    setIsLoading(true);
    try {
      const result = await getArsipSurats(
        query,
        org,
        jenis,
        page,
        10,
        sKey,
        sDir,
      );
      setData(result.data as DecryptedArsipSurat[]);
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
    fetchData(searchTerm, orgFilter, jenisFilter, 1, key, newDir);
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

  // Debounced Search Update
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchData(searchTerm, orgFilter, jenisFilter, 1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, orgFilter, jenisFilter]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "ArsipSurat") return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        fetchData(searchTerm, orgFilter, jenisFilter, currentPage);
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
  }, [searchTerm, orgFilter, jenisFilter, currentPage]);

  // Handle Filter Changes
  const handleFilterChange = (key: string, value: string) => {
    if (key === "org") {
      setOrgFilter(value);
    } else if (key === "jenis") {
      setJenisFilter(value);
    }

    setCurrentPage(1);
  };

  const handleReset = () => {
    setSearchTerm("");
    setOrgFilter("ALL");
    setJenisFilter("ALL");
    setCurrentPage(1);
  };

  // Handle Page Change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(searchTerm, orgFilter, jenisFilter, page);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setOptimisticHiddenIds((prev) => [...prev, id]);

    const result = await deleteArsipSurat(id);

    if (result.error) {
      setOptimisticHiddenIds((prev) => prev.filter((pid) => pid !== id));
      toast.error(result.error);
    } else {
      toast.success("Arsip surat berhasil dihapus");
      // Refresh local data
      fetchData(searchTerm, orgFilter, jenisFilter, currentPage);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset agar bisa pilih file sama lagi

    setImportLoading(true);
    try {
      // Baca file Excel
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

      // Map kolom Excel → format action
      const importData = rows.map((row) => {
        let tanggalStr = "";
        const rawTanggal = row["Tanggal"];
        if (rawTanggal instanceof Date) {
          const d = rawTanggal;
          tanggalStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        } else {
          tanggalStr = String(rawTanggal ?? "");
        }
        return {
          noSurat: String(row["No. Surat"] ?? ""),
          jenisSurat: String(row["Jenis Surat"] ?? ""),
          organisasi: row["Organisasi"] ? String(row["Organisasi"]) : undefined,
          tanggal: tanggalStr,
          pengirimPenerima: String(row["Pengirim/Penerima"] ?? ""),
          perihal: String(row["Perihal"] ?? ""),
          deskripsi: row["Deskripsi"] ? String(row["Deskripsi"]) : undefined,
        };
      });

      const result = await bulkImportArsipSurat(importData);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (result.success > 0) {
        toast.success(
          `${result.success} arsip berhasil diimport!${
            result.failed > 0 ? ` (${result.failed} baris gagal)` : ""
          }`,
        );

        // PRINT ERROR KE CONSOLE SUPAYA USER BISA CEK
        if (result.failed > 0) {
          console.group("❌ Detail Import Gagal");
          result.failedRows.forEach((err) => console.error(err));
          console.groupEnd();
          toast.warning(
            "Beberapa baris gagal. Cek Console (F12) untuk detailnya.",
          );
        }

        logImport("ARSIP_SURAT", result.success, result.failed);
      } else {
        toast.error(`Semua baris gagal. ${result.failedRows[0] ?? ""}`);
      }

      fetchData(searchTerm, orgFilter, jenisFilter, currentPage);

      // Trigger manual event agar Statistik (ArsipStats) ikutan refresh
      window.dispatchEvent(
        new CustomEvent("laci-realtime", {
          detail: { type: "mutation", model: "ArsipSurat" },
        }),
      );
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Gagal membaca file. Pastikan format .xlsx benar.");
    } finally {
      setImportLoading(false);
    }
  };

  // Download template kosong untuk panduan import
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "No. Surat": "001/A/IPNU/2025",
        "Jenis Surat": "MASUK",
        Organisasi: "IPNU",
        Tanggal: "2025-01-15",
        "Pengirim/Penerima": "PC IPNU Magetan",
        Perihal: "Contoh perihal surat",
        Deskripsi: "(opsional)",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [
      { wch: 22 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 24 },
      { wch: 30 },
      { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Import_Arsip_Surat.xlsx");
    toast.info("Template berhasil didownload.");
  };

  const handleExportExcel = async () => {
    if (totalItems === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    toast.info("Menyiapkan data export...");

    const suffix = userRole === "SEKRETARIS_CABANG" ? "Cabang" : "PAC";
    const dateStr = new Date().toLocaleDateString("id-ID").replace(/\//g, "-");
    const filename = `Arsip_Surat_${suffix}_${dateStr}.xlsx`;

    // Fetch ALL data (bypass pagination)
    let allData = data;
    if (totalItems > data.length) {
      try {
        const result = await getArsipSurats(
          searchTerm,
          orgFilter,
          jenisFilter,
          1,
          9999,
        );
        allData = result.data as DecryptedArsipSurat[];
      } catch {
        toast.error("Gagal mengambil semua data untuk export");
        return;
      }
    }

    const exportData: Record<string, string | number>[] = allData.map(
      (item, index) => ({
        No: index + 1,
        "No. Surat": item.noSurat,
        "Jenis Surat": item.jenisSurat,
        Organisasi: item.organisasi
          ? organisasiConfig[item.organisasi]?.label || item.organisasi
          : "-",
        Tanggal: new Date(item.tanggal).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        "Pengirim/Penerima": item.pengirimPenerima,
        Perihal: item.perihal,
        Deskripsi: item.deskripsi || "-",
      }),
    );

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:H1");
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Arsip Surat");

    const wscols = Object.keys(exportData[0] || {}).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...exportData.map((row) => String(row[key] || "").length),
      );
      return { wch: Math.min(maxLen + 2, 50) };
    });
    worksheet["!cols"] = wscols;

    XLSX.writeFile(workbook, filename);
    logExport("ARSIP_SURAT", filename); // Fire and forget
    toast.success("File excel berhasil didownload!");
  };

  const organisasiConfig: Record<string, { label: string; className: string }> =
    {
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
        label: "CBP_KPP",
        className:
          "bg-orange-100/80 text-orange-700 border-orange-200 hover:bg-orange-200/80",
      },
    };

  const jenisSuratConfig: Record<string, { label: string; className: string }> =
    {
      MASUK: {
        label: "Surat Masuk",
        className:
          "bg-blue-100/80 text-blue-700 border-blue-200 hover:bg-blue-200/80",
      },
      KELUAR: {
        label: "Surat Keluar",
        className:
          "bg-amber-100/80 text-amber-700 border-amber-200 hover:bg-amber-200/80",
      },
    };

  return (
    <div className="flex flex-col">
      {/* Filter Section */}
      <div className="flex flex-col md:flex-row gap-4 mb-4 items-end">
        {/* Search */}
        <div className="flex-1 relative w-full">
          <Label className="text-xs font-medium mb-1 block">Cari Arsip</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nomor surat, perihal, atau pengirim..."
              className="pl-9 w-full bg-white h-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Organisasi */}
        <div className="w-full md:w-44">
          <Label className="text-xs font-medium mb-1 block">Organisasi</Label>
          <Select
            value={orgFilter}
            onValueChange={(val) => handleFilterChange("org", val)}
          >
            <SelectTrigger className="w-full bg-white h-9 text-sm">
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

        {/* Jenis */}
        <div className="w-full md:w-36">
          <Label className="text-xs font-medium mb-1 block">Jenis</Label>
          <Select
            value={jenisFilter}
            onValueChange={(val) => handleFilterChange("jenis", val)}
          >
            <SelectTrigger className="w-full bg-white h-9 text-sm">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              <SelectItem value="MASUK">Masuk</SelectItem>
              <SelectItem value="KELUAR">Keluar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Actions Button */}
        <div className="grid grid-cols-2 gap-2 w-full md:flex md:w-auto md:items-center md:justify-end md:gap-4 lg:justify-start">
          {/* Hidden file input untuk Import */}
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportExcel}
          />

          {/* Import Button */}
          <Button
            variant="outline"
            className="h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm"
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

          {/* Export Button */}
          <Button
            variant="outline"
            className="h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm"
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
            <Table className="w-full table-fixed">
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-[50px] bg-slate-50/40 text-center whitespace-nowrap">
                    No
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
                    className="w-[160px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("noSurat")}
                  >
                    <span className="inline-flex items-center">
                      No. Surat
                      <SortIcon col="noSurat" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[100px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("jenisSurat")}
                  >
                    <span className="inline-flex items-center">
                      Jenis
                      <SortIcon col="jenisSurat" />
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
                    className="w-[180px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("pengirimPenerima")}
                  >
                    <span className="inline-flex items-center">
                      Pengirim/Penerima
                      <SortIcon col="pengirimPenerima" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("perihal")}
                  >
                    <span className="inline-flex items-center">
                      Perihal
                      <SortIcon col="perihal" />
                    </span>
                  </TableHead>
                  <TableHead className="w-[130px] text-right bg-slate-50/40 whitespace-nowrap">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.filter(
                  (item: DecryptedArsipSurat) =>
                    !optimisticHiddenIds.includes(item.id),
                ).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-32 text-center text-muted-foreground"
                    >
                      {searchTerm ||
                      orgFilter !== "ALL" ||
                      jenisFilter !== "ALL"
                        ? "Tidak ada data arsip surat yang cocok dengan filter."
                        : "Belum ada data arsip surat."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData
                    .filter(
                      (item: DecryptedArsipSurat) =>
                        !optimisticHiddenIds.includes(item.id),
                    )
                    .map((arsip: DecryptedArsipSurat, index: number) => (
                      <TableRow key={arsip.id}>
                        <TableCell className="text-center text-muted-foreground font-medium whitespace-nowrap">
                          {(currentPage - 1) * 10 + index + 1}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {arsip.organisasi ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "whitespace-nowrap transition-colors",
                                organisasiConfig[arsip.organisasi]?.className ||
                                  "",
                              )}
                            >
                              {arsip.organisasi}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell
                          className="max-w-[160px] truncate font-medium"
                          title={arsip.noSurat}
                        >
                          {arsip.noSurat}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              "whitespace-nowrap transition-colors",
                              jenisSuratConfig[arsip.jenisSurat]?.className ||
                                "",
                            )}
                          >
                            {arsip.jenisSurat}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap pr-6">
                          {new Date(arsip.tanggal).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell
                          className="max-w-[180px] truncate"
                          title={arsip.pengirimPenerima}
                        >
                          {capitalizeName(arsip.pengirimPenerima)}
                        </TableCell>
                        <TableCell
                          className="max-w-[300px] truncate whitespace-nowrap"
                          title={arsip.perihal}
                        >
                          {capitalizeName(arsip.perihal)}
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
                              <Link href={`/dashboard/arsip/surat/${arsip.id}`}>
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
                                href={`/dashboard/arsip/surat/${arsip.id}/edit`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                              onClick={() => setConfirmDeleteId(arsip.id)}
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                )}

                {/* Pagination Row – integrated into table body */}
                {totalPages >= 1 && (
                  <TableRow className="hover:bg-transparent border-t bg-slate-50/30">
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
                          arsip
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
        title="Hapus Arsip Surat?"
        description="Apakah Anda yakin ingin menghapus arsip surat ini? Tindakan ini tidak dapat dibatalkan dan file terkait akan dihapus secara permanen."
        variant="destructive"
        loading={false}
      />
    </div>
  );
}
