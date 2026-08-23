"use client";

import { PublicLayout } from "@/components/features/home/home-client";

const sections = [
  {
    title: "1. Pendahuluan",
    content: `PC IPNU IPPNU Kabupaten Magetan berkomitmen untuk melindungi privasi dan keamanan data pribadi setiap pengguna LACI Digital — Layanan Cerdas Administrasi ("Platform"). Kebijakan Privasi ini menjelaskan data apa yang kami kumpulkan, bagaimana data tersebut digunakan, serta langkah perlindungan yang kami terapkan.

Dengan menggunakan Platform, Anda menyetujui praktik-praktik yang dijelaskan dalam Kebijakan Privasi ini.`,
  },
  {
    title: "2. Data yang Kami Kumpulkan",
    content: `Kami mengumpulkan data berikut saat Anda mendaftar dan menggunakan Platform:

Data Akun:
• Nama lengkap
• Alamat email (digunakan untuk verifikasi dan komunikasi)
• Foto profil (opsional)
• Peran pengguna (Sekretaris Cabang atau Sekretaris PAC)

Data Organisasi yang Anda Input:
• Data anggota yang dikelola sesuai wewenang peran Anda
• Arsip surat dan berkas yang Anda unggah
• Data pengajuan PAC, kegiatan, dan presensi

Data Teknis:
• Waktu login dan aktivitas sesi
• Riwayat aktivitas yang tercatat di fitur Riwayat Aktivitas (Audit Log)`,
  },
  {
    title: "3. Cara Kami Menggunakan Data",
    content: `Data yang kami kumpulkan digunakan untuk:

• Autentikasi & Keamanan — verifikasi identitas dan proteksi akun dari akses tidak sah.
• Operasional Fitur — menjalankan seluruh fitur Platform (arsip, pengajuan, anggota, kegiatan, presensi, dll).
• Audit Trail — mencatat riwayat aktivitas pengguna untuk transparansi dan akuntabilitas organisasi. Catatan ini dapat dilihat oleh pengguna di menu Riwayat Aktivitas.
• Komunikasi — mengirimkan email verifikasi akun dan notifikasi penting lainnya.

Kami tidak menggunakan data Anda untuk keperluan komersial atau iklan.`,
  },
  {
    title: "4. Keamanan Data",
    content: `Kami menerapkan langkah keamanan teknis untuk melindungi data Anda:

• Enkripsi Berkas — berkas sensitif yang diunggah dienkripsi sebelum disimpan.
• Penyimpanan Cloud Aman — berkas disimpan di infrastruktur penyimpanan cloud dengan akses terkontrol.
• HTTPS — seluruh komunikasi antara browser dan server dienkripsi secara penuh.
• RBAC (Kontrol Akses Berbasis Peran) — setiap pengguna hanya dapat mengakses data sesuai perannya. Sekretaris PAC tidak dapat mengakses data PAC lain atau fitur tingkat cabang.
• Proteksi Anti-Bot — formulir autentikasi dilindungi dari akses bot otomatis.
• Pembatasan Akses Email Belum Terverifikasi — pengguna yang belum verifikasi email memiliki akses terbatas hingga verifikasi dilakukan.`,
  },
  {
    title: "5. Berbagi Data",
    content: `Laci Digital tidak menjual atau membagikan data pribadi Anda kepada pihak ketiga untuk tujuan komersial.

Data dapat dibagikan hanya dalam kondisi berikut:

• Infrastruktur Teknis — Platform menggunakan layanan penyimpanan berkas dan pengiriman email pihak ketiga yang terikat perjanjian kerahasiaan.
• Kewajiban Hukum — jika diwajibkan oleh hukum atau perintah pengadilan yang berlaku di Indonesia.
• Perlindungan Organisasi — jika pengungkapan diperlukan untuk mencegah penipuan atau bahaya.`,
  },
  {
    title: "6. Riwayat Aktivitas (Audit Log)",
    content: `Laci Digital memiliki fitur Riwayat Aktivitas yang mencatat seluruh aksi pengguna di dalam Platform. Catatan ini meliputi:

• Aktivitas login dan logout
• Penambahan, perubahan, dan penghapusan data
• Unggah dan pengelolaan berkas
• Perubahan status pengajuan PAC

Riwayat aktivitas dapat diakses oleh pengguna melalui menu Riwayat Aktivitas di sidebar dashboard. Tujuannya adalah untuk transparansi dan akuntabilitas internal organisasi.`,
  },
  {
    title: "7. Hak-Hak Anda",
    content: `Sebagai pengguna, Anda memiliki hak-hak berikut:

• Hak Akses — melihat data profil dan riwayat aktivitas Anda melalui dashboard.
• Hak Koreksi — memperbarui data profil (nama, foto) melalui menu Profil di dashboard.
• Hak Penghapusan Akun — meminta penghapusan akun dengan menghubungi Sekretaris Cabang atau tim pengelola Platform.
• Hak Keberatan — mengajukan keberatan terkait pemrosesan data melalui kontak yang tersedia.`,
  },
  {
    title: "8. Cookie dan Sesi Login",
    content: `Platform menggunakan mekanisme sesi browser untuk:

• Menjaga status login agar Anda tidak perlu masuk ulang setiap membuka Platform.
• Menyimpan preferensi tampilan sementara selama sesi berlangsung.

Mekanisme ini bersifat esensial untuk operasional Platform dan tidak digunakan untuk pelacakan lintas situs.`,
  },
  {
    title: "9. Retensi Data",
    content: `Kami menyimpan data Anda selama:

• Akun Aktif — data disimpan selama akun Anda dalam status aktif.
• Setelah Penghapusan Akun — data terkait dapat dihapus secara permanen sesuai permintaan.
• Riwayat Aktivitas — disimpan untuk keperluan audit internal organisasi.`,
  },
  {
    title: "10. Perubahan Kebijakan Privasi",
    content: `Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Perubahan signifikan akan diberitahukan melalui Platform atau email terdaftar. Tanggal pembaruan terakhir selalu ditampilkan di bagian atas halaman ini.`,
  },
  {
    title: "11. Kontak",
    content: `Pertanyaan atau permintaan terkait privasi data dapat disampaikan melalui:

Email     : lacipelajarnumagetan@gmail.com
WhatsApp  : +62 858-5051-2135
Alamat    : Magetan, Jawa Timur, Indonesia`,
  },
];

export default function KebijakanPrivasiClient() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1 text-xs font-semibold text-[#15803d] mb-4">
            Privasi &amp; Keamanan
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Kebijakan Privasi
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Terakhir diperbarui:{" "}
            <span className="font-medium text-slate-700">11 Maret 2026</span>
          </p>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Kami berkomitmen menjaga privasi Anda. Dokumen ini menjelaskan
            bagaimana data Anda dikumpulkan, digunakan, dan dilindungi di
            platform Laci Digital.
          </p>
        </div>

        <div className="h-px bg-slate-200 mb-10" />

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-base font-bold text-slate-900 mb-3">
                {section.title}
              </h2>
              <div className="text-sm leading-relaxed text-slate-600 whitespace-pre-line rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                {section.content}
              </div>
            </section>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
