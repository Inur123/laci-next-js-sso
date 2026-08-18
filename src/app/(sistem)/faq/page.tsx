import type { Metadata } from "next";
import FAQClient from "@/components/features/faq/faq-client";

export const metadata: Metadata = {
  title: "FAQ - Pertanyaan Umum",
  description:
    "Temukan jawaban dari pertanyaan yang sering ditanyakan seputar Laci Digital, platform manajemen organisasi PC IPNU IPPNU Kabupaten Magetan.",
};

export default function FAQPage() {
  return <FAQClient />;
}
