"use client";

import { Spinner } from "@/components/ui/spinner";
import { usePathname } from "next/navigation";

export default function Loading() {
  const pathname = usePathname();

  // Don't show global spinner for dashboard routes
  if (pathname?.startsWith("/dashboard")) {
    return null;
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-white">
      <Spinner className="size-8 text-[#16a34a]" />
    </div>
  );
}
