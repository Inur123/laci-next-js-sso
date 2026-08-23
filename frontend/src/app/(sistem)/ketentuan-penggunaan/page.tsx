import type { Metadata } from "next";
import KetentuanClient from "@/components/features/ketentuan/ketentuan-client";

export const metadata: Metadata = {
  title: "Ketentuan Penggunaan",
  description:
    "Ketentuan dan syarat penggunaan platform Laci Digital untuk PC IPNU IPPNU Kabupaten Magetan. Baca sebelum menggunakan layanan kami.",
};

export default function KetentuanPage() {
  return <KetentuanClient />;
}
