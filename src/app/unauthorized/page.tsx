import { ErrorPage } from "@/components/errors/error-page";
import { LogIn } from "lucide-react";

export default function Unauthorized() {
  return (
    <ErrorPage
      code="401"
      title="ERROR"
      message="Anda perlu login untuk mengakses halaman ini!"
      actionButton={{
        label: "Masuk Sekarang",
        href: "/login",
        icon: LogIn,
      }}
    />
  );
}
