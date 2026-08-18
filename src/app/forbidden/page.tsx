import { ErrorPage } from "@/components/errors/error-page";
import { LogIn } from "lucide-react";

export default function Forbidden() {
  return (
    <ErrorPage
      code="403"
      title="ERROR"
      message="Anda tidak memiliki izin untuk mengakses halaman ini!"
      actionButton={{
        label: "Masuk",
        href: "/login",
        icon: LogIn,
      }}
    />
  );
}
