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

export function PengajuanBerkasSkeleton({
  isCabang = false,
}: {
  isCabang?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32 md:w-44" />
            <Skeleton className="h-4 w-48 md:w-72" />
          </div>
        </div>
        {!isCabang && <Skeleton className="h-10 w-full sm:w-36 rounded-md" />}
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => (
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
      <div className="flex flex-col md:flex-row gap-4">
        <Skeleton className="h-10 flex-[3]" />
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
        {isCabang && <Skeleton className="h-10 flex-[2]" />}
        <div className="flex gap-2 w-full md:w-auto">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border overflow-hidden">
        <div className="relative overflow-auto">
          <Table className="min-w-[1000px]">
            <TableHeader className="bg-slate-50/40 sticky top-0 z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px] text-center bg-slate-50/40 whitespace-nowrap">No</TableHead>
                <TableHead className="w-[180px] bg-slate-50/40 whitespace-nowrap">No Surat</TableHead>
                {isCabang && (
                  <TableHead className="w-[160px] bg-slate-50/40 whitespace-nowrap">Pengaju</TableHead>
                )}
                <TableHead className="w-[150px] bg-slate-50/40 whitespace-nowrap">Periode PAC</TableHead>
                <TableHead className="w-[120px] bg-slate-50/40 whitespace-nowrap">Penerima</TableHead>
                <TableHead className="w-[150px] bg-slate-50/40 whitespace-nowrap">Tanggal</TableHead>
                <TableHead className="bg-slate-50/40 whitespace-nowrap">Keperluan</TableHead>
                <TableHead className="w-[120px] bg-slate-50/40 whitespace-nowrap">Status</TableHead>
                <TableHead className="w-[120px] text-right bg-slate-50/40 whitespace-nowrap">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-4 mx-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  {isCabang && (
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                  )}
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
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

export function PengajuanBerkasDetailSkeleton({
  isCabang = false,
}: {
  isCabang?: boolean;
}) {
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Pengajuan Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-20 " />
                  <Skeleton className="h-5 w-48" />
                </div>
              ))}
            </div>
            <div className="pt-4 border-t space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: User Info & Actions */}
        <div className="flex flex-col gap-6">
          <Card className="flex-1">
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <div className="pt-4 border-t grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>

          {isCabang && (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* File Preview */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between p-4 border rounded-lg gap-4">
            <div className="flex items-center gap-3 text-white">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Skeleton className="h-10 flex-1 md:w-24 rounded-md" />
              <Skeleton className="h-10 flex-1 md:w-24 rounded-md" />
            </div>
          </div>
          <div className="border rounded-lg h-[400px] flex items-center justify-center bg-slate-50/50">
             <Skeleton className="h-full w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PengajuanBerkasFormSkeleton() {
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
        <CardContent className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Col */}
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              ))}
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-24 w-full rounded-md" />
              </div>
            </div>

            {/* Right Col */}
            <div className="space-y-4">
               <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <div className="border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center space-y-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-10 w-40 rounded-md" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
            <Skeleton className="h-10 flex-1 md:flex-none md:w-32 rounded-md" />
            <Skeleton className="h-10 flex-1 md:flex-none md:w-40 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
