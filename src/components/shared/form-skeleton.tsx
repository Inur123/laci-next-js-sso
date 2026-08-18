import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function FormSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="border-b">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
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
