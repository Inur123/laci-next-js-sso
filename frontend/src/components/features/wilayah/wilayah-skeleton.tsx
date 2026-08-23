import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function WilayahSkeleton({ isCabang }: { isCabang?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:gap-6 w-full h-full animate-in fade-in-50 duration-500">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        {!isCabang && <Skeleton className="h-10 w-full sm:w-64 rounded-md" />}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {/* Filter Skeleton */}
        <div className="flex flex-col md:flex-row gap-4 mb-4 items-end">
          <div className="flex-1 w-full">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-2 w-full md:flex md:w-auto md:items-center md:justify-end md:gap-4 lg:justify-start">
            <Skeleton className="h-9 w-full md:w-24 rounded-md" />
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white border rounded-lg overflow-x-auto shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50 border-y">
                <TableHead className="w-[50px]"><Skeleton className="h-4 w-6" /></TableHead>
                <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                {isCabang && <TableHead><Skeleton className="h-4 w-24" /></TableHead>}
                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                {!isCabang && <TableHead className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  {isCabang && <TableCell><Skeleton className="h-4 w-28" /></TableCell>}
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  {!isCabang && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
