"use client";

import { AlertTriangle } from "lucide-react";
import { ErrorView } from "@/components/features/error/error-view";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body className="antialiased font-sans">
        <ErrorView
          title="Fatal System Error"
          description="Terjadi kesalahan fatal pada sistem aplikasi. Mohon maaf atas ketidaknyamanan ini. Silakan coba muat ulang aplikasi."
          icon={<AlertTriangle size={48} className="text-red-600" />}
          buttonColor="bg-red-700 hover:bg-red-800 shadow-red-100"
          resetText="Muat Ulang Aplikasi"
          onReset={reset}
          errorDigest={error.digest}
        />
      </body>
    </html>
  );
}
