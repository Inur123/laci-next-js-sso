import type { Metadata } from "next";
import KebijakanPrivasiClient from "@/components/features/kebijakan-privasi/kebijakan-privasi-client";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Kebijakan privasi platform Laci Digital. Pelajari bagaimana data Anda dikumpulkan, digunakan, dan dilindungi oleh PC IPNU IPPNU Kabupaten Magetan.",
};

export default function KebijakanPrivasiPage() {
  return <KebijakanPrivasiClient />;
}
