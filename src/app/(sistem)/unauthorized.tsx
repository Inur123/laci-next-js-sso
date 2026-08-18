import { UserLock } from "lucide-react";
import { ErrorView } from "@/components/features/error/error-view";

export default function Unauthorized() {
  return (
    <ErrorView
      code="401"
      title="Perlu Autentikasi"
      description="Sesi Anda mungkin telah berakhir atau Anda belum login ke sistem. Silakan masuk kembali untuk melanjutkan."
      icon={<UserLock size={48} className="text-green-600" />}
      buttonText="Login Sekarang"
      buttonHref="/login"
      buttonColor="bg-green-700 hover:bg-blue-800 shadow-blue-100"
    />
  );
}
