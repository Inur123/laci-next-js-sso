"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function ProfileSkeleton() {
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
      </div>

      <Card className="border shadow-sm overflow-hidden w-full">
        <div className="grid md:grid-cols-[280px_1fr]">
          {/* Left Side (Avatar) Skeleton */}
          <div className="bg-white p-8 border-r flex flex-col items-center text-center space-y-6">
            <Skeleton className="h-40 w-40 rounded-full" />
            <div className="flex flex-col items-center gap-3 w-full">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2 rounded-full" />
              <Skeleton className="h-4 w-1/3 rounded-full" />
            </div>
            <Skeleton className="h-8 w-full rounded-md" />
          </div>

          {/* Right Side (Form) Skeleton */}
          <div className="p-8 space-y-8">
            <div className="grid gap-8">
              {/* Section 1: Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-md" />
                  <Skeleton className="h-6 w-40" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-9 w-full rounded-md" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-9 w-full rounded-md" />
                  </div>
                </div>
              </div>

              {/* Section 2: Keamanan */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-md" />
                  <Skeleton className="h-6 w-32" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-9 w-full rounded-md" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-9 w-full rounded-md" />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-36 rounded-md" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
