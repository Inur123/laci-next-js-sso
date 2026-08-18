import { ShieldOff } from "lucide-react";
import { ErrorView } from "@/components/features/error/error-view";

export default function Forbidden() {
  return (
    <ErrorView
      code="403"
      title="Akses Ditolak"
      description="Maaf, Anda tidak memiliki izin untuk mengakses halaman ini. Halaman ini mungkin hanya bisa diakses oleh role tertentu."
      icon={<ShieldOff size={48} className="text-rose-600" />}
      buttonColor="bg-slate-800 hover:bg-slate-900 shadow-slate-200"
    />
  );
}
