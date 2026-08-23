"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PublicLayout } from "@/components/features/home/home-client";

const faqs = [
  {
    kategori: "Umum",
    items: [
      {
        q: "Apa itu Laci Digital?",
        a: "LACI Digital (Layanan Cerdas Administrasi) adalah platform manajemen organisasi berbasis web yang dikembangkan khusus untuk PC IPNU IPPNU Kabupaten Magetan. Platform ini membantu pengurus mengelola arsip surat, data anggota, pengajuan dokumen, kegiatan, presensi, dan berbagai administrasi organisasi secara digital dan terpusat.",
      },
      {
        q: "Siapa yang bisa menggunakan Laci Digital?",
        a: "Laci Digital digunakan secara eksklusif oleh pengurus internal PC IPNU IPPNU Kabupaten Magetan. Terdapat dua peran utama:\n\n• Sekretaris Cabang — akses penuh ke seluruh fitur termasuk manajemen pengguna, kegiatan, dan Berkas SP.\n• Sekretaris PAC — akses ke fitur pengajuan, arsip surat, data anggota, presensi, dan berkas di tingkat PAC masing-masing.",
      },
      {
        q: "Apakah Laci Digital bisa diakses dari mana saja?",
        a: "Ya, Laci Digital adalah aplikasi berbasis web yang dapat diakses dari perangkat apapun (komputer, laptop, handphone) selama terhubung dengan internet dan memiliki akun yang aktif. Tidak perlu menginstal aplikasi tambahan.",
      },
    ],
  },
  {
    kategori: "Akun & Registrasi",
    items: [
      {
        q: "Bagaimana cara mendaftar akun Laci Digital?",
        a: "Klik tombol 'Daftar' di halaman utama, lalu isi formulir dengan data diri yang valid. Setelah mendaftar, Anda akan menerima email verifikasi — klik link di email tersebut untuk mengaktifkan akun. Setelah terverifikasi, akun dapat langsung digunakan untuk login.",
      },
      {
        q: "Mengapa saya harus verifikasi email?",
        a: "Verifikasi email wajib dilakukan untuk dapat mengakses seluruh fitur dashboard. Tanpa verifikasi email, akses Anda akan dibatasi hanya pada halaman dashboard utama dan profil. Banner peringatan akan muncul di dashboard jika email belum terverifikasi.",
      },
      {
        q: "Saya lupa password, bagaimana cara mereset?",
        a: "Reset password tidak dapat dilakukan secara mandiri. Silakan hubungi Sekretaris Cabang PC IPNU IPPNU Kabupaten Magetan untuk meminta reset password. Sekretaris Cabang memiliki akses untuk mereset password melalui menu Data User di dashboard. Setelah direset, gunakan password baru yang diberikan dan segera ubah dari menu Profil.",
      },
      {
        q: "Bagaimana cara mengubah data profil saya?",
        a: "Setelah login, klik nama Anda di bagian bawah sidebar, lalu pilih 'Profil' atau akses melalui menu /dashboard/profile. Di sana Anda dapat mengubah nama, foto profil, dan melakukan verifikasi email.",
      },
    ],
  },
  {
    kategori: "Fitur Dashboard",
    items: [
      {
        q: "Apa saja fitur yang tersedia di Laci Digital?",
        a: "Fitur yang tersedia tergantung pada peran Anda:\n\nSekretaris Cabang & PAC:\n• Pengajuan PAC — mengajukan surat pengantar antar tingkatan\n• Arsip Surat — menyimpan surat masuk dan keluar\n• Berkas Pimpinan — dokumen strategis kepengurusan\n• Data Anggota — kelola data anggota organisasi\n• Presensi — absensi berbasis QR code\n• Riwayat Aktivitas — audit log seluruh aktivitas\n• Periode Kepengurusan — kelola data per masa bakti\n\nKhusus Sekretaris Cabang:\n• Kegiatan — kelola agenda kegiatan organisasi cabang\n• Data User — kelola akun pengguna sistem\n• Berkas SP — berkas surat pengantar tingkat cabang",
      },
      {
        q: "Apa itu Pengajuan PAC dan bagaimana alurnya?",
        a: "Pengajuan PAC adalah fitur untuk mengajukan surat pengantar dari tingkat PAC ke tingkat Cabang. Alurnya:\n1. Sekretaris PAC membuat pengajuan baru\n2. Sekretaris Cabang menerima notifikasi dan meninjau pengajuan\n3. Pengajuan dapat diterima atau ditolak dengan keterangan\n4. Status pengajuan dapat dipantau langsung di dashboard",
      },
      {
        q: "Apa perbedaan Arsip Surat, Berkas SP, dan Berkas Pimpinan?",
        a: "• Arsip Surat — untuk menyimpan surat masuk dan surat keluar yang sudah diproses.\n• Berkas SP — khusus Sekretaris Cabang, untuk menyimpan berkas surat pengantar resmi.\n• Berkas Pimpinan — untuk menyimpan dokumen strategis pengurus seperti SK kepengurusan, sertifikat, dan dokumen penting lainnya.",
      },
      {
        q: "Apa itu Periode Kepengurusan?",
        a: "Periode Kepengurusan adalah fitur untuk mengelola data per masa bakti organisasi. Anda dapat beralih antar periode untuk melihat data anggota, arsip, dan statistik pada masa kepengurusan yang berbeda. Setiap pengguna memiliki satu periode aktif yang menentukan konteks data yang ditampilkan.",
      },
      {
        q: "Bagaimana fitur Kegiatan dan Presensi bekerja?",
        a: "• Kegiatan — digunakan untuk membuat dan mengelola agenda kegiatan organisasi.\n• Presensi — menggunakan sistem QR code. Setiap kegiatan memiliki QR yang dapat dipindai anggota untuk mencatat kehadiran secara digital. Fitur ini dapat digunakan baik oleh Sekretaris Cabang maupun Sekretaris PAC.",
      },
    ],
  },
  {
    kategori: "Keamanan & Privasi",
    items: [
      {
        q: "Apakah data saya aman di Laci Digital?",
        a: "Ya. Laci Digital menerapkan enkripsi berlapis untuk berkas sensitif, sistem proteksi anti-bot pada form autentikasi, dan kontrol akses berbasis peran (RBAC). Setiap pengguna hanya dapat mengakses data sesuai wewenang perannya — Sekretaris PAC hanya bisa mengakses data di PAC-nya sendiri, sedangkan Sekretaris Cabang memiliki akses lebih luas.",
      },
      {
        q: "Apakah aktivitas saya di sistem tercatat?",
        a: "Ya. Laci Digital memiliki fitur Riwayat Aktivitas (Audit Log) yang dapat diakses melalui menu 'Riwayat Aktivitas' di sidebar. Seluruh aktivitas pengguna dicatat beserta waktu dan detailnya untuk keperluan transparansi dan akuntabilitas organisasi.",
      },
      {
        q: "Apakah ada batasan akses berdasarkan status email?",
        a: "Ya. Pengguna yang belum melakukan verifikasi email hanya dapat mengakses halaman Dashboard utama dan halaman Profil. Seluruh fitur lainnya dikunci hingga email terverifikasi. Banner peringatan akan tampil di bagian atas dashboard sebagai pengingat.",
      },
    ],
  },
  {
    kategori: "Bantuan Teknis",
    items: [
      {
        q: "Saya mengalami masalah teknis, harus menghubungi siapa?",
        a: "Jika mengalami masalah teknis, hubungi tim pengembang melalui:\n• WhatsApp: +62 858-5051-2135\n• Email: lacipelajarnumagetan@gmail.com\n\nAnda juga dapat menggunakan fitur 'Laporkan Bug' (ikon Bug) yang tersedia di bagian bawah sidebar dashboard.",
      },
      {
        q: "Mengapa halaman saya lambat atau tidak bisa diakses?",
        a: "Periksa koneksi internet Anda terlebih dahulu. Jika masalah berlanjut, coba refresh halaman atau bersihkan cache browser. Jika sistem sedang dalam pemeliharaan, akan ada pemberitahuan resmi dari tim pengelola.",
      },
    ],
  },
];

function AccordionItem({
  q,
  a,
  isOpen,
  onToggle,
}: {
  q: string;
  a: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border transition-all duration-200",
        isOpen
          ? "border-[#bbf7d0] bg-[#f0fdf4]"
          : "border-slate-200 bg-white hover:border-slate-300",
      )}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 p-5 text-left cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-semibold text-slate-900 leading-snug">
          {q}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 flex-shrink-0 text-slate-500 transition-transform duration-200",
            isOpen && "rotate-180 text-[#15803d]",
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[600px]" : "max-h-0",
        )}
      >
        <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600 whitespace-pre-line">
          {a}
        </p>
      </div>
    </div>
  );
}

export default function FAQClient() {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  const toggle = (key: string) => {
    setOpenIndex(openIndex === key ? null : key);
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1 text-xs font-semibold text-[#15803d] mb-4">
            Pusat Bantuan
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Pertanyaan yang Sering Ditanyakan
          </h1>
          <p className="mt-3 text-slate-600 leading-relaxed">
            Temukan jawaban dari pertanyaan umum seputar Laci Digital. Tidak
            menemukan jawaban? Hubungi kami langsung.
          </p>
        </div>

        {/* FAQ List */}
        <div className="space-y-10">
          {faqs.map((section) => (
            <div key={section.kategori}>
              <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                {section.kategori}
              </h2>
              <div className="space-y-3">
                {section.items.map((item, i) => {
                  const key = `${section.kategori}-${i}`;
                  return (
                    <AccordionItem
                      key={key}
                      q={item.q}
                      a={item.a}
                      isOpen={openIndex === key}
                      onToggle={() => toggle(key)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
