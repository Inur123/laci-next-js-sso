import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-slate-200" />
          <Skeleton className="h-4 w-64 bg-slate-100" />
        </div>
        {/* Tabs Skeleton (Optional visual cue) */}
        <div className="hidden md:flex gap-2">
          <Skeleton className="h-10 w-32 bg-slate-100 rounded-lg" />
          <Skeleton className="h-10 w-40 bg-slate-100 rounded-lg" />
        </div>
      </div>

      {/* Stats Cards Skeleton (Grid of 10) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(10)].map((_, i) => (
          <Card
            key={i}
            className="h-[85px] border-slate-200 shadow-sm overflow-hidden"
          >
            <CardContent className="p-3 h-full flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <Skeleton className="h-3 w-16 bg-slate-200" />
                <Skeleton className="h-4 w-4 rounded-md bg-slate-100" />
              </div>
              <Skeleton className="h-6 w-10 bg-slate-200 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Visual Charts Area Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chart 1: Bar Chart Visual */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-32 bg-slate-200" />
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full flex items-end gap-3 px-2">
              {[...Array(7)].map((_, i) => (
                <Skeleton
                  key={i}
                  className={`w-full rounded-t-md bg-slate-100`}
                  style={{ height: `${[30, 55, 40, 70, 45, 60, 35][i % 7]}%` }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Line Chart Visual */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-32 bg-slate-200" />
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full flex items-center justify-center">
              <Skeleton className="h-[200px] w-full bg-slate-50 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* (Optional) Leaderboard Table Skeleton for Monitoring View */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 py-4">
          <Skeleton className="h-5 w-48 bg-slate-200" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4 p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-10 w-10 rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3 bg-slate-200" />
                  <Skeleton className="h-3 w-1/4 bg-slate-100" />
                </div>
                <Skeleton className="h-6 w-12 bg-slate-200" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
