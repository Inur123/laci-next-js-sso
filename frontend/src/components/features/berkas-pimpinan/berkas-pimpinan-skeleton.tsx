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
import { Card, CardContent } from "@/components/ui/card";

export function BerkasPimpinanSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-10 w-full sm:w-40 rounded-md" />
      </div>

      {/* Filter Skeleton */}
      <div className="flex flex-col md:flex-row gap-4 mb-4 items-end">
        <div className="flex-1 space-y-2 w-full">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="grid grid-cols-1 gap-2 w-full md:flex md:w-auto md:gap-4">
          <Skeleton className="h-9 w-full md:w-28 rounded-md" />
          <Skeleton className="h-9 w-full md:w-28 rounded-md" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border overflow-hidden">
        <div className="relative max-h-[600px] overflow-auto">
          <Table className="min-w-[800px]">
            <TableHeader className="sticky top-0 bg-slate-50/40 z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px] text-center bg-slate-50/40 whitespace-nowrap">
                  No
                </TableHead>
                <TableHead className="w-[200px] bg-slate-50/40 whitespace-nowrap">
                  Nama
                </TableHead>
                <TableHead className="w-[180px] bg-slate-50/40 whitespace-nowrap">
                  Tanggal
                </TableHead>
                <TableHead className="bg-slate-50/40 whitespace-nowrap">
                  Catatan
                </TableHead>
                <TableHead className="w-[130px] text-right bg-slate-50/40 whitespace-nowrap">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-4 mx-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-full max-w-[300px]" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
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

export function BerkasPimpinanFormSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <Card>
        <CardContent className="p-6 md:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center space-y-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t font-semibold">
            <Skeleton className="h-10 flex-1 rounded-md" />
            <Skeleton className="h-10 flex-1 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
