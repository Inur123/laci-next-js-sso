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

export function LogActivitySkeleton({ userRole }: { userRole?: string }) {
  const isCabang = userRole === "SEKRETARIS_CABANG";
  const statsCount = isCabang ? 11 : 9;

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

        {isCabang && (
          <div className="bg-slate-50 p-1 rounded-lg border border-slate-100 flex gap-1 w-full sm:w-[250px]">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 flex-1" />
          </div>
        )}
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(statsCount)].map((_, i) => (
          <Card key={i} className="h-[90px] p-3 shadow-none border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-6 w-12" />
          </Card>
        ))}
      </div>

      {/* Filter / Search Skeleton */}
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-md border border-slate-200 overflow-hidden">
        <div className="relative overflow-auto">
          <Table className="min-w-[900px]">
            <TableHeader className="bg-slate-50/40 sticky top-0 z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px] text-center bg-slate-50/40">No</TableHead>
                <TableHead className="w-[180px] bg-slate-50/40">Waktu</TableHead>
                <TableHead className="w-[130px] bg-slate-50/40">Entitas</TableHead>
                <TableHead className="w-[160px] bg-slate-50/40">Menu</TableHead>
                <TableHead className="bg-slate-50/40">Aktivitas</TableHead>
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
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-full" />
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

export function LogDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Info Skeleton */}
        <Card className="md:col-span-2 shadow-none border-slate-200">
          <CardHeader className="border-b bg-slate-50/40">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            <div className="space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-40" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* User & Time Skeleton */}
        <Card className="shadow-none border-slate-200">
          <CardHeader className="border-b bg-slate-50/40">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="space-y-2 w-full">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Device & Network Info Skeleton */}
      <Card className="shadow-none border-slate-200 mt-6">
        <CardHeader className="border-b bg-slate-50/40">
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                <div className="space-y-2 w-full">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
