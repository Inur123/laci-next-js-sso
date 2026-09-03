"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ReferensiSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
      </div>

      {/* Filter Skeleton */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
        {/* Search */}
        <Skeleton className="h-9 flex-1 min-w-[200px]" />
        {/* Status */}
        <Skeleton className="h-9 w-full md:w-36" />
        {/* Penerima */}
        <Skeleton className="h-9 w-full md:w-36" />
        {/* Filter PAC */}
        <Skeleton className="h-9 w-full md:w-64" />
        {/* Reset button */}
        <Skeleton className="h-9 w-full md:w-24" />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[1140px] table-fixed [&_td]:py-2 [&_th]:py-2">
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px] text-center bg-slate-50/40 whitespace-nowrap">
                  No
                </TableHead>
                <TableHead className="w-[260px] bg-slate-50/40 whitespace-nowrap">
                  No Surat
                </TableHead>
                <TableHead className="w-[180px] bg-slate-50/40 whitespace-nowrap">
                  Pengaju
                </TableHead>
                <TableHead className="w-[120px] bg-slate-50/40 whitespace-nowrap">
                  Penerima
                </TableHead>
                <TableHead className="w-[140px] bg-slate-50/40 whitespace-nowrap">
                  Tanggal
                </TableHead>
                <TableHead className="bg-slate-50/40 whitespace-nowrap">
                  Keperluan
                </TableHead>
                <TableHead className="w-[120px] bg-slate-50/40 whitespace-nowrap">
                  Status
                </TableHead>
                <TableHead className="w-[72px] text-right bg-slate-50/40 whitespace-nowrap">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(7)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-4 mx-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[140px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[120px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-[70px] rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[100px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-full max-w-[300px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-[80px] rounded-full" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-8 ml-auto" />
                  </TableCell>
                </TableRow>
              ))}

              {/* Pagination row skeleton */}
              <TableRow className="hover:bg-transparent border-t bg-white">
                <TableCell colSpan={8} className="px-4 py-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-48 hidden sm:block" />
                    <div className="flex gap-1 ml-auto">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
