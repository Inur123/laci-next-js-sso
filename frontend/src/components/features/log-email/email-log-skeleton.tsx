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

export function EmailLogSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      {/* Stats Skeleton - 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-[85px] p-3 border rounded-xl bg-card flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-6 w-8" />
          </div>
        ))}
      </div>

      {/* Filter Skeleton */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <Skeleton className="h-10 flex-[2]" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader className="sticky top-0 bg-slate-50/40 z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px] text-center bg-slate-50/40 whitespace-nowrap">
                  No
                </TableHead>
                <TableHead className="w-[160px] bg-slate-50/40 whitespace-nowrap">
                  Waktu
                </TableHead>
                <TableHead className="w-[200px] bg-slate-50/40 whitespace-nowrap">
                  Penerima
                </TableHead>
                <TableHead className="bg-slate-50/40 whitespace-nowrap hidden md:table-cell">
                  Subjek
                </TableHead>
                <TableHead className="w-[140px] bg-slate-50/40 whitespace-nowrap">
                  Jenis
                </TableHead>
                <TableHead className="w-[120px] bg-slate-50/40 whitespace-nowrap">
                  Status
                </TableHead>
                <TableHead className="w-[160px] text-right bg-slate-50/40 whitespace-nowrap">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="text-center whitespace-nowrap">
                    <Skeleton className="h-4 w-4 mx-auto" />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Skeleton className="h-4 w-[120px]" />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Skeleton className="h-4 w-[160px]" />
                  </TableCell>
                  <TableCell className="whitespace-nowrap hidden md:table-cell">
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Skeleton className="h-5 w-[100px] rounded-full" />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Skeleton className="h-5 w-[80px] rounded-full" />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <Skeleton className="h-7 w-16 rounded-md" />
                      <Skeleton className="h-7 w-14 rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
