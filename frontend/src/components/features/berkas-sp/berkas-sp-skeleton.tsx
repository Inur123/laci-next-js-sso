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
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function BerkasSPSkeleton() {
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
        <Skeleton className="h-10 w-full sm:w-32 rounded-md" />
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-[85px] p-3 border rounded-xl bg-card flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-6 w-8" />
          </div>
        ))}
      </div>

      {/* Filter Skeleton */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-[2]">
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex-1">
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex-1">
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border overflow-hidden">
        <div className="relative overflow-auto">
          <Table className="min-w-[900px]">
            <TableHeader className="bg-slate-50/40 sticky top-0 z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px] text-center bg-slate-50/40">
                  No
                </TableHead>
                <TableHead className="bg-slate-50/40">Nama Pimpinan</TableHead>
                <TableHead className="w-[120px] bg-slate-50/40">
                  Organisasi
                </TableHead>
                <TableHead className="w-[140px] bg-slate-50/40">
                  Tanggal Mulai
                </TableHead>
                <TableHead className="w-[140px] bg-slate-50/40">
                  Tanggal Berakhir
                </TableHead>
                <TableHead className="bg-slate-50/40">Catatan</TableHead>
                <TableHead className="w-[120px] text-right bg-slate-50/40">
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
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
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

export function BerkasSPDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Skeleton className="h-10 flex-1 sm:w-24 rounded-md" />
          <Skeleton className="h-10 flex-1 sm:w-24 rounded-md" />
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-48" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-between p-4 border rounded-lg gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Skeleton className="h-9 flex-1 md:w-24 rounded-md" />
                <Skeleton className="h-9 flex-1 md:w-24 rounded-md" />
              </div>
            </div>
            <div className="mt-4 border rounded-lg h-[400px] flex items-center justify-center">
              <Skeleton className="h-[300px] w-full max-w-[500px]" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function BerkasSPFormSkeleton() {
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
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>

          <div className="space-y-4">
            <Skeleton className="h-4 w-28" />
            <div className="border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center space-y-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-10 w-40 rounded-md" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
