"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function PeriodeSkeleton() {
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
        <Skeleton className="h-10 w-full sm:w-40 rounded-md" />
      </div>

      {/* List Card Skeleton */}
      <div className="grid gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="shadow-none border-slate-200">
            <div className="flex items-center justify-between p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-7 w-36 rounded-md" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-24 rounded-md" />
                <Skeleton className="h-9 w-9 rounded-md" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function PeriodeFormSkeleton() {
  return (
    <div className="max-w-xl flex flex-col gap-4 sm:gap-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <Card className="shadow-none border-slate-200">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>

          <div className="flex justify-between pt-6 border-t mt-4">
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
