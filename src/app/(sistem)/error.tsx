"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { ErrorView } from "@/components/features/error/error-view";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorView
      title="Terjadi Kesalahan"
      description="Waduh! Ada sedikit kendala teknis. Jangan panik, tim kami sedang memantaunya."
      icon={<AlertTriangle size={48} className="text-orange-600" />}
      onReset={reset}
      errorDigest={error.digest}
      hideButton={true}
    />
  );
}
