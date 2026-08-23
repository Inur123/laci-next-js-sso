"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

// Load SwaggerUI secara dinamis hanya di client-side
// Gunakan default export dari swagger-ui-react dan casting untuk menghindari TS error
const SwaggerUI = dynamic<any>(
  () => import("swagger-ui-react").then((mod) => mod.default),
  {
    ssr: false,
  },
);

export default function ApiDocsPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="container mx-auto pb-20">
        <SwaggerUI url="/api/docs" />
      </div>
    </div>
  );
}
