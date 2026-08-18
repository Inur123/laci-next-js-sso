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

export function UserSkeleton() {
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
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="h-[85px] p-3 shadow-none border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-6 w-12" />
          </Card>
        ))}
      </div>

      {/* Filter Skeleton */}
      <div className="flex flex-col md:flex-row gap-4">
        <Skeleton className="h-10 flex-[3]" />
        <Skeleton className="h-10 flex-1" />
        <div className="flex gap-2 w-full md:w-auto">
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border overflow-hidden">
        <div className="relative overflow-auto">
          <Table className="min-w-[800px]">
            <TableHeader className="bg-slate-50/40 sticky top-0 z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[280px] bg-slate-50/40">User</TableHead>
                <TableHead className="bg-slate-50/40">Email</TableHead>
                <TableHead className="w-[150px] bg-slate-50/40">
                  Status
                </TableHead>
                <TableHead className="w-[100px] text-right bg-slate-50/40 pr-6">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
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

export function UserDetailSkeleton() {
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

      <Card className="overflow-hidden shadow-none border-slate-200">
        <div className="grid md:grid-cols-[300px_1fr]">
          {/* Profile Sidebar Skeleton */}
          <div className="p-8 border-r bg-slate-50/30 flex flex-col items-center text-center space-y-6">
            <Skeleton className="h-32 w-32 rounded-full ring-4 ring-white" />
            <div className="space-y-3 flex flex-col items-center w-full">
              <Skeleton className="h-6 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            <div className="w-full pt-6 border-t space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>

          {/* Details Section Skeleton */}
          <div className="p-8 space-y-10">
            {/* Info Section */}
            <div className="space-y-6">
              <Skeleton className="h-6 w-40" />
              <div className="grid gap-6 sm:grid-cols-2">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                ))}
              </div>
            </div>

            {/* Activity Stats Section Skeleton */}
            <div className="space-y-6 pt-8 border-t">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-6 w-32 rounded-full" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                 {[...Array(6)].map((_, i) => (
                    <Card key={i} className="p-4 shadow-none border-slate-100">
                       <Skeleton className="h-3 w-20 mb-3" />
                       <Skeleton className="h-6 w-12" />
                    </Card>
                 ))}
              </div>
            </div>

            {/* Perkaderan Stats Section Skeleton */}
            <div className="space-y-6 pt-8 border-t">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-6 w-32 rounded-full" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                 {[...Array(5)].map((_, i) => (
                    <Card key={i} className="p-4 shadow-none border-slate-100">
                       <Skeleton className="h-3 w-16 mb-3" />
                       <Skeleton className="h-5 w-10" />
                    </Card>
                 ))}
              </div>
            </div>

            {/* Actions Section */}
            <div className="space-y-6 pt-8 border-t">
              <Skeleton className="h-6 w-48" />
              <div className="bg-slate-50 rounded-lg p-6 space-y-4">
                <Skeleton className="h-16 w-full rounded-md" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-11 w-full rounded-md" />
                  <Skeleton className="h-11 w-full rounded-md" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
