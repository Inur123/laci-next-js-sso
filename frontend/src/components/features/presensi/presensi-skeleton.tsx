"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PresensiListSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48 md:w-64" />
            <Skeleton className="h-4 w-64 md:w-80" />
          </div>
        </div>
        <Skeleton className="h-10 w-full sm:w-48 rounded-md" />
      </div>

      {/* Filter Skeleton */}
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="w-full md:w-36 space-y-1.5">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <Skeleton className="h-10 w-full md:w-24 rounded-md" />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border overflow-hidden">
        <div className="relative overflow-auto">
          <Table className="min-w-[1000px]">
            <TableHeader className="bg-slate-50/40 sticky top-0 z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px] text-center bg-slate-50/40">No</TableHead>
                <TableHead className="bg-slate-50/40">Nama Kegiatan</TableHead>
                <TableHead className="w-[180px] bg-slate-50/40">Tanggal</TableHead>
                <TableHead className="w-[140px] bg-slate-50/40">Waktu</TableHead>
                <TableHead className="w-[180px] bg-slate-50/40">Tempat</TableHead>
                <TableHead className="w-[90px] text-center bg-slate-50/40">Peserta</TableHead>
                <TableHead className="w-[130px] bg-slate-50/40">Status</TableHead>
                <TableHead className="w-[80px] text-right bg-slate-50/40 pr-6">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-4 mx-auto" />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-56" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-8 mx-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <Skeleton className="h-8 w-8 ml-auto rounded-md" />
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

export function PresensiFormSkeleton() {
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
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
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

export function PresensiDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 animate-pulse">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>

      {/* Info + QR Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Card */}
        <Card className="lg:col-span-2 shadow-none border-slate-200">
          <CardHeader className="border-b bg-slate-50/40">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-40" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* QR Card */}
        <Card className="shadow-none border-slate-200">
          <CardHeader className="text-center border-b bg-slate-50/40">
            <Skeleton className="h-5 w-32 mx-auto" />
            <Skeleton className="h-3 w-40 mx-auto mt-1" />
          </CardHeader>
          <CardContent className="flex flex-col items-center pt-6 pb-6">
            <Skeleton className="w-[200px] h-[200px] rounded-xl mb-6 shadow-sm" />
            <Skeleton className="h-10 w-full rounded-md mb-3" />
            <Skeleton className="h-9 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>

      {/* Participants Table Card */}
      <Card className="shadow-none border-slate-200">
        <CardHeader className="border-b bg-slate-50/40 flex flex-row items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-7 w-32 rounded-full" />
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6">
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="rounded-md border overflow-hidden">
            <div className="bg-slate-50/40 px-4 py-3 flex gap-4 border-b">
               <Skeleton className="h-4 w-8" />
               <Skeleton className="h-4 w-48" />
               <Skeleton className="h-4 w-24" />
               <Skeleton className="h-4 w-32" />
               <Skeleton className="h-4 w-20 ml-auto" />
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-4 py-3 flex gap-4 items-center border-b last:border-0">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
