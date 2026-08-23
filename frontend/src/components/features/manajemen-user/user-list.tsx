"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import {
  Eye,
  Search,
  RefreshCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getPACUsers } from "@/app/actions/auth-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  emailVerified?: boolean | null;
  image?: string | null;
  role?: string | null;
};

export function UserList({
  users: initialUsers,
  totalPages: initialTotalPages,
  currentPage: initialCurrentPage,
  totalItems: initialTotalItems,
}: {
  users: UserListItem[];
  totalPages: number;
  currentPage: number;
  totalItems: number;
}) {
  const [data, setData] = useState<UserListItem[]>(initialUsers);

  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [totalItems, setTotalItems] = useState(initialTotalItems);
  const [isLoading, setIsLoading] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [emailStatusFilter, setEmailStatusFilter] = useState("ALL");

  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sort state
  type SortKey = "name" | "email" | "isActive" | "emailVerified";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey | null>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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

  const sortedData = data;

  const isFirstRender = useRef(true);

  const fetchData = useCallback(
    async (
      query: string,
      status: string,
      emailStatus: string,
      page: number,
      sKey: SortKey | null = sortKey,
      sDir: SortDir = sortDir,
    ) => {
      setIsLoading(true);
      try {
        const result = await getPACUsers(
          query,
          page,
          10,
          status,
          emailStatus,
          sKey,
          sDir,
        );
        setData(result.data as UserListItem[]);
        setTotalPages(result.totalPages);
        setTotalItems(result.total);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (
          !errMsg.includes("unexpected response") &&
          !errMsg.includes("NEXT_REDIRECT") &&
          !errMsg.includes("abort")
        ) {
          toast.error(`Gagal memuat data user: ${errMsg}`);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [sortKey, sortDir],
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchData(searchTerm, statusFilter, emailStatusFilter, 1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, emailStatusFilter, fetchData]);

  // Realtime listener for user updates
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        type?: string;
        model?: string;
      };
      if (!detail || detail.type !== "mutation") return;
      if (detail.model !== "User") return;
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        fetchData(searchTerm, statusFilter, emailStatusFilter, currentPage);
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
  }, [searchTerm, statusFilter, emailStatusFilter, currentPage, fetchData]);

  const handleReset = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setEmailStatusFilter("ALL");
    setCurrentPage(1);
    fetchData("", "ALL", "ALL", 1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(searchTerm, statusFilter, emailStatusFilter, page);
  };

  const capitalizeName = (name: string) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const hasFilters =
    searchTerm !== "" || statusFilter !== "ALL" || emailStatusFilter !== "ALL";

  return (
    <div className="flex flex-col">
      {/* Filter Section - Matched with Pengajuan PAC Layout */}
      <div className="flex flex-col md:flex-row gap-4 mb-4 items-end">
        <div className="flex-1 relative w-full">
          <Label className="text-xs font-medium mb-1 block">Cari User</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau email..."
              className="pl-9 w-full bg-white h-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="w-full md:w-40">
          <Label className="text-xs font-medium mb-1 block">Status Akun</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full bg-white h-9 text-sm border-slate-200 shadow-sm">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              <SelectItem value="ACTIVE">Aktif</SelectItem>
              <SelectItem value="INACTIVE">Nonaktif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-40">
          <Label className="text-xs font-medium mb-1 block">Status Email</Label>
          <Select
            value={emailStatusFilter}
            onValueChange={setEmailStatusFilter}
          >
            <SelectTrigger className="w-full bg-white h-9 text-sm border-slate-200 shadow-sm">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              <SelectItem value="VERIFIED">Terverifikasi</SelectItem>
              <SelectItem value="UNVERIFIED">Belum Verifikasi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          className={cn(
            "h-9 w-full md:w-auto px-4 text-sm bg-white border-slate-200 shadow-sm whitespace-nowrap transition-all duration-200",
            hasFilters
              ? "text-slate-900 border-slate-300 opacity-100"
              : "text-slate-400 border-slate-200 opacity-50 cursor-not-allowed",
          )}
          onClick={handleReset}
          disabled={!hasFilters || isLoading}
        >
          <RefreshCcw className="mr-2 h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <div className="relative">
        <div className="rounded-md border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="w-full table-fixed min-w-[800px] [&_td]:py-2.5 [&_th]:py-3">
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-[50px] text-center bg-slate-50/40 whitespace-nowrap">
                    No
                  </TableHead>
                  <TableHead
                    className="w-[280px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <span className="inline-flex items-center">
                      Profil User
                      <SortIcon col="name" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[200px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("email")}
                  >
                    <span className="inline-flex items-center">
                      Alamat Email
                      <SortIcon col="email" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[120px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("isActive")}
                  >
                    <span className="inline-flex items-center">
                      Status Akun
                      <SortIcon col="isActive" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[140px] bg-slate-50/40 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("emailVerified")}
                  >
                    <span className="inline-flex items-center">
                      Email Verif
                      <SortIcon col="emailVerified" />
                    </span>
                  </TableHead>
                  <TableHead className="w-[80px] text-right bg-slate-50/40 whitespace-nowrap">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-40 text-center text-muted-foreground"
                    >
                      {hasFilters
                        ? "Data user tidak ditemukan dengan filter "
                        : "Belum ada data user."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((user, index) => (
                    <TableRow key={user.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-center text-muted-foreground font-medium whitespace-nowrap">
                        {(currentPage - 1) * 10 + index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border shadow-sm shrink-0">
                            <AvatarImage
                              src={
                                user.image
                                  ? user.image.startsWith("http")
                                    ? user.image
                                    : `/api/manajemen-user/${user.id}/image?v=${user.image}`
                                  : ""
                              }
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-slate-100 text-slate-500 text-xs font-bold font-mono">
                              {getInitials(user.name || "User")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <Link
                              href={`/dashboard/manajemen-user/${user.id}`}
                              className="font-bold text-sm text-slate-900 hover:text-blue-600 transition-colors truncate"
                            >
                              {capitalizeName(user.name)}
                            </Link>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest leading-none mt-1">
                              {user.role ? user.role.replace("_", " ") : "PAC"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm truncate">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-100/80 text-emerald-700 border-emerald-200 hover:bg-emerald-200/80 shadow-none px-2.5 py-0.5 transition-colors font-semibold"
                          >
                            Aktif
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-red-100/80 text-red-700 border-red-200 hover:bg-red-200/80 shadow-none px-2.5 py-0.5 transition-colors font-semibold"
                          >
                            Nonaktif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.emailVerified ? (
                          <Badge
                            variant="outline"
                            className="bg-blue-100/80 text-blue-700 border-blue-200 hover:bg-blue-200/80 px-2.5 py-0.5 transition-colors font-semibold"
                          >
                            Verif
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 px-2.5 py-0.5 transition-colors font-semibold opacity-70"
                          >
                            Belum
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 border-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
                            asChild
                          >
                            <Link href={`/dashboard/manajemen-user/${user.id}`}>
                              <Eye className="w-4 h-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}

                {/* Pagination Row */}
                {totalPages >= 1 && (
                  <TableRow className="hover:bg-transparent border-t bg-slate-50/30">
                    <TableCell colSpan={6} className="p-0">
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
                          user
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
    </div>
  );
}
