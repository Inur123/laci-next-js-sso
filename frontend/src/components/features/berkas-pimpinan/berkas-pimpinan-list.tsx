"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
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
  deleteBerkasPimpinan,
  getBerkasPimpinans,
  bulkImportBerkasPimpinan,
} from "@/app/actions/berkas-pimpinan-actions";
import { logExport, logImport } from "@/app/actions/log-activity-actions";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import XLSX from "xlsx-js-style";
import { cn } from "@/lib/utils";
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

type BerkasPimpinan = {
  id: string;
  nama: string;
  tanggal: Date;
  catatan: string | null;
  file: string | null;
};

export function BerkasPimpinanList({
  berkasList: initialBerkasList,
  userRole,
  totalPages: initialTotalPages,
  currentPage: initialCurrentPage,
  totalItems: initialTotalItems,
}: {
  berkasList: BerkasPimpinan[];
  userRole: string;
  totalPages: number;
  currentPage: number;
  totalItems: number;
}) {
  // Local data state
  const [data, setData] = useState<BerkasPimpinan[]>(initialBerkasList);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [totalItems, setTotalItems] = useState(initialTotalItems);
  const [importLoading, setImportLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");

  // Sort state
  type SortKey = "nama" | "tanggal" | "catatan";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey | null>("tanggal");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const isFirstRender = useRef(true);

  // Function to fetch data with sorting parameters
  const fetchData = async (
    query: string,
    page: number,
    sKey: SortKey | null = sortKey,
    sDir: SortDir = sortDir,
  ) => {
    setIsLoading(true);
    try {
      const result = await getBerkasPimpinans(query, page, 10, sKey, sDir);
      setData(result.data as BerkasPimpinan[]);
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
    fetchData(searchTerm, 1, key, newDir);
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
      fetchData(searchTerm, 1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "BerkasPimpinan") return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        fetchData(searchTerm, currentPage);
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
  }, [searchTerm, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(searchTerm, page);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setOptimisticHiddenIds((prev) => [...prev, id]);

    const result = await deleteBerkasPimpinan(id);
    if (result.error) {
      setOptimisticHiddenIds((prev) => prev.filter((pid) => pid !== id));
      toast.error(result.error);
    } else {
      toast.success("Berkas berhasil dihapus");
      fetchData(searchTerm, currentPage);
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
        let tanggalStr = "";
        const rawTanggal = row["Tanggal"];

        if (rawTanggal instanceof Date) {
          tanggalStr = `${rawTanggal.getFullYear()}-${String(rawTanggal.getMonth() + 1).padStart(2, "0")}-${String(rawTanggal.getDate()).padStart(2, "0")}`;
        } else {
          tanggalStr = String(rawTanggal ?? "");
        }

        return {
          nama: String(row["Nama"] || row["Nama Pimpinan"] || ""),
          tanggal: tanggalStr,
          catatan: row["Catatan"] ? String(row["Catatan"]) : undefined,
        };
      });

      const result = await bulkImportBerkasPimpinan(importData);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (result.success > 0) {
        toast.success(
          `${result.success} berkas berhasil diimport!${result.failed > 0 ? ` (${result.failed} baris gagal)` : ""}`,
        );
        logImport("BERKAS_PIMPINAN", result.success, result.failed); // Fire and forget
        window.dispatchEvent(
          new CustomEvent("laci-realtime", {
            detail: { type: "mutation", model: "BerkasPimpinan" },
          }),
        );
      } else {
        toast.error(`Semua baris gagal. ${result.failedRows[0] ?? ""}`);
      }

      fetchData(searchTerm, currentPage);
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
        Nama: "Nama Berkas / Pimpinan",
        Tanggal: "2025-01-01",
        Catatan: "(opsional)",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Import_Berkas.xlsx");
    toast.info("Template berhasil didownload.");
  };

  const handleExportExcel = async () => {
    if (totalItems === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    toast.info("Menyiapkan data export...");

    const dateStr = new Date().toLocaleDateString("id-ID").replace(/\//g, "-");
    const moduleName =
      userRole === "SEKRETARIS_CABANG" ? "Berkas_Cabang" : "Berkas_PAC";
    const filename = `${moduleName}_${dateStr}.xlsx`;

    // Fetch ALL data (bypass pagination)
    let allData = data;
    if (totalItems > data.length) {
      try {
        const result = await getBerkasPimpinans(searchTerm, 1, 9999);
        allData = result.data as BerkasPimpinan[];
      } catch {
        toast.error("Gagal mengambil semua data untuk export");
        return;
      }
    }

    const exportData: Record<string, string | number>[] = allData.map(
      (item, index) => ({
        No: index + 1,
        Nama: item.nama,
        Tanggal: new Date(item.tanggal).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        Catatan: item.catatan || "-",
      }),
    );

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:D1");
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Berkas");
    XLSX.writeFile(workbook, filename);
    logExport("BERKAS_PIMPINAN", filename);
    toast.success("File excel berhasil didownload!");
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-col md:flex-row gap-4 mb-4 items-end">
        <div className="flex-1 relative w-full">
          <Label className="text-xs font-medium mb-1 block">Cari Berkas</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau catatan..."
              className="pl-9 w-full bg-white h-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
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
                  <TableHead className="w-[50px] text-center bg-slate-50/40 whitespace-nowrap">
                    No
                  </TableHead>
                  <TableHead
                    className="w-[200px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("nama")}
                  >
                    <span className="inline-flex items-center">
                      Nama
                      <SortIcon col="nama" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[180px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("tanggal")}
                  >
                    <span className="inline-flex items-center">
                      Tanggal
                      <SortIcon col="tanggal" />
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
                      colSpan={5}
                      className="h-32 text-center text-muted-foreground"
                    >
                      {searchTerm
                        ? "Tidak ada data berkas pimpinan yang cocok dengan filter."
                        : "Belum ada data berkas pimpinan."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData
                    .filter((item) => !optimisticHiddenIds.includes(item.id))
                    .map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-center text-muted-foreground font-medium whitespace-nowrap">
                          {(currentPage - 1) * 10 + index + 1}
                        </TableCell>
                        <TableCell
                          className="font-medium whitespace-nowrap truncate"
                          title={item.nama}
                        >
                          {item.nama}
                        </TableCell>
                        <TableCell className="whitespace-nowrap pr-6">
                          {new Date(item.tanggal).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell
                          className="truncate max-w-[400px] whitespace-nowrap"
                          title={item.catatan || ""}
                        >
                          {item.catatan || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {item.file && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                                asChild
                                title="Tampilkan File"
                              >
                                <a
                                  href={`/api/berkas-pimpinan/download/${item.id}?preview=true`}
                                  target="_blank"
                                >
                                  <Eye className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              asChild
                            >
                              <Link
                                href={`/dashboard/berkas-pimpinan/${item.id}/edit`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                              onClick={() => setConfirmDeleteId(item.id)}
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
                    <TableCell colSpan={5} className="p-0">
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
        title="Hapus Berkas?"
        description="Apakah Anda yakin ingin menghapus berkas ini?"
        variant="destructive"
        loading={false}
      />
    </div>
  );
}
