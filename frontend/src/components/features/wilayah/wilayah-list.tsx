"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  Search,
  MapPin,
  RefreshCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
} from "lucide-react";
import { deleteWilayah, getWilayahList } from "@/app/actions/wilayah-actions";
import { toast } from "sonner";
import { WilayahForm } from "./wilayah-form";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { CopyWilayahDialog } from "./copy-wilayah-dialog";
import { cn } from "@/lib/utils";

type WilayahItem = {
  id: string;
  nama: string;
  ketua: string | null;
  kontak: string | null;
  alamat: string | null;
  user?: { name: string } | null;
};

interface WilayahListProps {
  initialData: WilayahItem[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
  isCabang: boolean;
  jenis: "RANTING" | "PK";
  userRole?: string;
}

type SortKey = "nama" | "ketua" | "kontak" | "alamat";
type SortDir = "asc" | "desc";

export function WilayahList({
  initialData,
  totalPages: initialTotalPages,
  currentPage: initialCurrentPage,
  totalItems: initialTotalItems,
  isCabang,
  jenis,
  userRole,
}: WilayahListProps) {
  const router = useRouter();
  
  const [data, setData] = useState<WilayahItem[]>(initialData);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [totalItems, setTotalItems] = useState(initialTotalItems);
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>("nama");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<WilayahItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isFirstRender = useRef(true);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = async (
    query: string,
    page: number,
    sKey: SortKey | null = sortKey,
    sDir: SortDir = sortDir,
  ) => {
    setIsLoading(true);
    try {
      const result = await getWilayahList(
        jenis,
        query,
        page,
        10,
        undefined, // userIdFilter (handled in action)
        undefined, // periodeId
        sKey,
        sDir
      );
      setData(result.data as WilayahItem[]);
      setTotalPages(result.totalPages);
      setTotalItems(result.total);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Gagal memuat data wilayah");
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced Search Update
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

  // Real-time listener
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "Wilayah") return;
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
      return <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 text-slate-400 inline-block" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1.5 h-3.5 w-3.5 text-slate-600 inline-block" />
    ) : (
      <ArrowDown className="ml-1.5 h-3.5 w-3.5 text-slate-600 inline-block" />
    );
  };

  const handleClear = () => {
    setSearchTerm("");
    setCurrentPage(1);
    // fetchData(1) handled by useEffect
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(searchTerm, page);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setLoading(true);

    const res = await deleteWilayah(id);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Data berhasil dihapus");
      fetchData(searchTerm, currentPage);
    }
    setLoading(false);
  };

  const handleEdit = (item: WilayahItem) => {
    setEditItem(item);
    setIsFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
            <MapPin size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Data {jenis === "RANTING" ? "Ranting" : "PK"}</h2>
            <p className="text-sm text-muted-foreground">
              {isCabang ? `Pantau data ${jenis.toLowerCase()} dari seluruh PAC` : `Kelola data pimpinan ${jenis.toLowerCase()} di wilayah PAC Anda`}
            </p>
          </div>
        </div>
        {!isCabang && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <CopyWilayahDialog userRole={userRole || ""} jenis={jenis} />
            <Button
              onClick={() => {
                setEditItem(null);
                setIsFormOpen(true);
              }}
              className={`w-full sm:w-auto text-white shadow-md hover:shadow-xl transition-all duration-200 ${
                userRole === "SEKRETARIS_CABANG"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              <Plus className="w-4 h-4 mr-2" />
              Tambah Data
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {/* Filter Section */}
        <div className="flex flex-col md:flex-row gap-4 mb-4 items-end">
          <div className="flex-1 relative w-full">
            <Label className="text-xs font-medium mb-1 block">Cari Data</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Cari nama ${jenis === "RANTING" ? "Ranting" : "PK"} atau ketua...`}
                className="pl-9 w-full bg-white h-9 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full md:flex md:w-auto md:items-center md:justify-end md:gap-4 lg:justify-start">
            <Button
              variant="outline"
              className={cn(
                "h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm whitespace-nowrap transition-all duration-200",
                searchTerm
                  ? "text-slate-900 border-slate-300 opacity-100"
                  : "text-slate-400 border-slate-200 opacity-50 cursor-not-allowed",
              )}
              onClick={handleClear}
              disabled={!searchTerm}
            >
              <RefreshCcw className="mr-2 h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>

        <div className="bg-white border rounded-lg overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50 border-y">
              <TableHead className="w-[50px] font-semibold text-slate-600">No</TableHead>
              <TableHead 
                className="font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort("nama")}
              >
                Nama {jenis === "RANTING" ? "Ranting" : "PK"} <SortIcon col="nama" />
              </TableHead>
              {isCabang && <TableHead className="font-semibold text-slate-600">PAC</TableHead>}
              <TableHead 
                className="font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort("ketua")}
              >
                Ketua <SortIcon col="ketua" />
              </TableHead>
              <TableHead 
                className="font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort("kontak")}
              >
                Kontak <SortIcon col="kontak" />
              </TableHead>
              <TableHead 
                className="font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                onClick={() => handleSort("alamat")}
              >
                Alamat <SortIcon col="alamat" />
              </TableHead>
              {!isCabang && <TableHead className="text-right font-semibold text-slate-600">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isCabang ? 7 : 6} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                    <p className="mt-2 text-sm text-slate-500">Memuat data...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isCabang ? 7 : 6} className="h-32 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <MapPin className="h-8 w-8 text-slate-300" />
                    <p>Belum ada data</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => (
                <TableRow key={item.id} className="hover:bg-slate-50/50">
                  <TableCell className="text-slate-500 font-medium">
                    {(currentPage - 1) * 10 + index + 1}
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">{item.nama}</TableCell>
                  {isCabang && (
                    <TableCell className="text-slate-600">{item.user?.name || "-"}</TableCell>
                  )}
                  <TableCell className="text-slate-600">{item.ketua || "-"}</TableCell>
                  <TableCell className="text-slate-600">{item.kontak || "-"}</TableCell>
                  <TableCell className="text-slate-600 max-w-[200px] truncate">{item.alamat || "-"}</TableCell>
                  
                  {!isCabang && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => handleEdit(item)}
                          disabled={loading}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setConfirmDeleteId(item.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
            
            {/* Pagination Controls */}
            {totalPages >= 1 && (
              <TableRow className="hover:bg-transparent border-t bg-slate-50/30">
                <TableCell colSpan={isCabang ? 7 : 6} className="p-0">
                  <div className="flex items-center justify-start sm:justify-between px-4 py-2">
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      Menampilkan{" "}
                      <span className="font-medium text-slate-700">
                        {Math.min((currentPage - 1) * 10 + 1, totalItems)}
                      </span>{" "}
                      sampai{" "}
                      <span className="font-medium text-slate-700">
                        {Math.min(currentPage * 10, totalItems)}
                      </span>{" "}
                      dari{" "}
                      <span className="font-medium text-slate-700">
                        {totalItems}
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
                              if (currentPage > 1) handlePageChange(currentPage - 1);
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
                            (page >= currentPage - 1 && page <= currentPage + 1)
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
                              if (currentPage < totalPages) handlePageChange(currentPage + 1);
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

      <WilayahForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        editItem={editItem}
        jenis={jenis}
        onSuccess={() => {
          setIsFormOpen(false);
          // Optional: we can call fetchData instead of router.refresh()
          fetchData(searchTerm, currentPage);
        }}
      />
      
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        title={`Hapus Data ${jenis === "RANTING" ? "Ranting" : "PK"}?`}
        description="Data yang dihapus tidak dapat dikembalikan."
      />
      </div>
    </div>
  );
}
