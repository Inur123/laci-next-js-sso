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

export function AnggotaSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Skeleton className="h-10 w-full sm:w-44 rounded-md" />
          <Skeleton className="h-10 w-full sm:w-40 rounded-md" />
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-[82px] p-3 border rounded-lg bg-card flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>

      {/* Search and Filter Section Skeleton */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
        {/* Search Input Skeleton */}
        <div className="flex-1 space-y-1 w-full">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        {/* User Filter Skeleton (optional, shown for Cabang) */}
        <div className="w-full md:w-64 space-y-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        {/* Action Buttons Skeleton */}
        <div className="flex gap-2 w-full md:w-auto">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border">
        <div className="relative max-h-[600px] overflow-auto">
          <Table className="min-w-[900px]">
            <TableHeader className="sticky top-0 bg-slate-50/40 z-10">
              <TableRow>
                <TableHead className="w-[50px] bg-slate-50/40 text-center whitespace-nowrap">
                  No
                </TableHead>
                <TableHead className="w-[250px] bg-slate-50/40 whitespace-nowrap">
                  Nama Pimpinan
                </TableHead>
                <TableHead className="w-[120px] bg-slate-50/40 whitespace-nowrap">
                  Periode
                </TableHead>
                <TableHead className="w-[120px] bg-slate-50/40 whitespace-nowrap">
                  Jenis Kelamin
                </TableHead>
                <TableHead className="w-[150px] bg-slate-50/40 whitespace-nowrap">
                  No. HP
                </TableHead>
                <TableHead className="w-[150px] bg-slate-50/40 whitespace-nowrap">
                  Dibuat Oleh
                </TableHead>
                <TableHead className="w-[100px] bg-slate-50/40 text-right whitespace-nowrap">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i} className="hover:bg-slate-50/50">
                  {/* No */}
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-6 mx-auto" />
                  </TableCell>

                  {/* Nama Pimpinan (Avatar + Name + Jabatan) */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </TableCell>

                  {/* Periode (Badge) */}
                  <TableCell>
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </TableCell>

                  {/* Jenis Kelamin */}
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>

                  {/* No. HP */}
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>

                  {/* Dibuat Oleh (Icon + Name) */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-3 w-3 rounded-sm" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </TableCell>

                  {/* Aksi (3 buttons) */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Skeleton className="h-8 w-8 rounded-md" />
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

export function AnggotaDetailSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8">
        {/* Left Column Skeleton */}
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="border rounded-2xl bg-white shadow-sm overflow-hidden text-center p-8 space-y-6">
            <Skeleton className="h-40 w-40 rounded-full mx-auto" />
            <div className="space-y-2 flex flex-col items-center">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-5 w-32 rounded-full" />
            </div>
            <div className="space-y-3 pt-6 border-t w-full">
              <div className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </div>

          {/* Perkaderan Skeleton */}
          <div className="border rounded-2xl bg-white shadow-sm p-4 space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <Skeleton className="h-4 w-4 rounded-md" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="p-3 border rounded-lg bg-slate-50/50 space-y-3"
                >
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-full" />
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-8 w-full rounded" />
                    <Skeleton className="h-8 w-full rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="space-y-8">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="border rounded-2xl bg-white shadow-sm overflow-hidden"
            >
              <div className="bg-slate-50 p-4 border-b">
                <Skeleton className="h-5 w-48" />
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, j) => (
                  <div
                    key={j}
                    className="p-4 border rounded-xl bg-slate-50/30 space-y-3"
                  >
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
