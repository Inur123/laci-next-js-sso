"use client";

import { PublicLayout } from "@/components/features/home/home-client";

const sections = [
  {
    title: "1. Penerimaan Ketentuan",
    content: `Dengan mengakses atau menggunakan platform Laci Digital ("Platform"), Anda menyatakan telah membaca, memahami, dan menyetujui Ketentuan Penggunaan ini. Jika Anda tidak menyetujui ketentuan ini, Anda tidak diizinkan untuk menggunakan Platform.

Laci Digital adalah sistem informasi manajemen organisasi internal yang dikembangkan dan dikelola oleh PC IPNU IPPNU Kabupaten Magetan.`,
  },
  {
    title: "2. Eligibilitas dan Hak Akses Pengguna",
    content: `Laci Digital dirancang eksklusif untuk penggunaan internal PC IPNU IPPNU Kabupaten Magetan. Anda hanya diizinkan menggunakan Platform apabila:

• Anda merupakan pengurus aktif PC IPNU IPPNU Kabupaten Magetan yang telah mendaftarkan akun.
• Akun Anda telah berhasil melakukan verifikasi email.
• Anda menggunakan Platform sesuai peran yang ditetapkan (Sekretaris Cabang atau Sekretaris PAC).

Platform berhak menolak atau mencabut hak akses kapan saja jika terdapat pelanggaran ketentuan ini.`,
  },
  {
    title: "3. Peran Pengguna dan Batasan Akses",
    content: `Terdapat dua peran pengguna dengan perbedaan hak akses:

Sekretaris Cabang:
• Akses penuh ke seluruh fitur Platform
• Dapat mengelola akun pengguna lain (aktivasi, reset password)
• Dapat mengelola Kegiatan, Berkas SP, dan Data User
• Dapat mengantau dan mencatat Presensi Kegiatan
• Dapat menerima/menolak Pengajuan PAC

Sekretaris PAC:
• Dapat membuat dan memantau Pengajuan PAC
• Dapat mengelola Data Anggota di PAC-nya
• Dapat melakukan presensi kegiatan yang diselenggarakan PAC
• Tidak memiliki akses ke fitur manajemen pengguna dan berkas SP cabang

Pengguna yang belum memverifikasi email hanya dapat mengakses halaman Dashboard utama dan Profil.`,
  },
  {
    title: "4. Akun dan Keamanan",
    content: `Anda bertanggung jawab penuh atas:

• Kerahasiaan kata sandi dan kredensial akun Anda.
• Seluruh aktivitas yang dilakukan menggunakan akun Anda.
• Segera menghubungi Sekretaris Cabang jika menduga akun Anda diakses secara tidak sah.

Anda dilarang membagikan kredensial akun kepada pihak lain. Setiap akun hanya boleh digunakan oleh satu orang yang berwenang.

Reset password tidak dapat dilakukan secara mandiri — hanya dapat dilakukan oleh Sekretaris Cabang melalui menu Data User di dashboard.`,
  },
  {
    title: "5. Penggunaan yang Diizinkan",
    content: `Platform ini boleh Anda gunakan untuk:

• Membuat dan memantau Pengajuan PAC sesuai peran Anda.
• Mengarsipkan surat masuk dan keluar dalam fitur Arsip Surat.
• Menyimpan dan mengelola Berkas Pimpinan.
• Mengelola Data Anggota organisasi.
• Memantau kegiatan dan mencatat presensi.
• Mengelola Periode Kepengurusan.
• Memantau Riwayat Aktivitas untuk keperluan audit internal.
• Melaporkan bug atau masalah teknis melalui tombol Laporkan Bug di sidebar.`,
  },
  {
    title: "6. Larangan Penggunaan",
    content: `Anda dilarang untuk:

• Menggunakan Platform untuk tujuan di luar kepentingan organisasi PC IPNU IPPNU Kabupaten Magetan.
• Mencoba mengakses fitur atau data di luar wewenang peran Anda.
• Mengunggah berkas yang mengandung konten berbahaya atau melanggar hukum.
• Melakukan tindakan yang dapat mengganggu atau merusak sistem Platform.
• Mendistribusikan, menyalin, atau menjual data dari Platform tanpa izin.
• Menyebarkan informasi yang bersifat SARA, fitnah, atau melanggar hukum Indonesia.`,
  },
  {
    title: "7. Data dan Berkas yang Diunggah",
    content: `Data dan berkas yang Anda unggah ke Platform (termasuk surat, dokumen, foto profil, dan informasi anggota) merupakan milik dan tanggung jawab PC IPNU IPPNU Kabupaten Magetan.

Dengan mengunggah konten, Anda menyatakan bahwa konten tersebut:
• Tidak melanggar hak cipta atau privasi pihak lain.
• Merupakan data yang sah dan valid sesuai kepentingan organisasi.

Seluruh aktivitas unggah dan pengelolaan berkas tercatat dalam Riwayat Aktivitas untuk keperluan audit internal.`,
  },
  {
    title: "8. Ketersediaan Layanan",
    content: `Laci Digital berupaya menjaga ketersediaan Platform 24 jam sehari, 7 hari seminggu. Namun, Platform dapat mengalami downtime karena:

• Pemeliharaan dan pembaruan sistem yang dijadwalkan.
• Gangguan teknis atau keadaan di luar kendali tim pengembang.

Laci Digital tidak bertanggung jawab atas kerugian akibat ketidaktersediaan sementara Platform.`,
  },
  {
    title: "9. Pelanggaran dan Sanksi",
    content: `Pelanggaran terhadap ketentuan ini dapat mengakibatkan:

• Peringatan kepada pengguna yang bersangkutan.
• Penonaktifan sementara akun oleh Sekretaris Cabang.
• Pencabutan hak akses secara permanen.
• Pelaporan kepada pihak berwenang jika pelanggaran bersifat pidana.

Sekretaris Cabang memiliki wewenang untuk mengaktifkan, menonaktifkan, atau menghapus akun pengguna kapan saja melalui menu Data User.`,
  },
  {
    title: "10. Perubahan Ketentuan",
    content: `Laci Digital berhak memperbarui Ketentuan Penggunaan ini kapan saja. Perubahan akan diberitahukan melalui Platform atau email yang terdaftar. Penggunaan Platform setelah pembaruan dianggap sebagai penerimaan atas ketentuan yang baru.`,
  },
  {
    title: "11. Hukum yang Berlaku",
    content: `Ketentuan Penggunaan ini tunduk pada hukum yang berlaku di Republik Indonesia. Segala sengketa diselesaikan secara musyawarah mufakat, atau melalui jalur hukum di wilayah Kabupaten Magetan, Jawa Timur.`,
  },
  {
    title: "12. Kontak",
    content: `Pertanyaan mengenai Ketentuan Penggunaan dapat disampaikan melalui:

Email     : lacipelajarnumagetan@gmail.com
WhatsApp  : +62 858-5051-2135
Alamat    : Magetan, Jawa Timur, Indonesia`,
  },
];

export default function KetentuanClient() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1 text-xs font-semibold text-[#15803d] mb-4">
            Legal
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ketentuan Penggunaan
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Terakhir diperbarui:{" "}
            <span className="font-medium text-slate-700">11 Maret 2026</span>
          </p>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Harap baca ketentuan ini dengan seksama sebelum menggunakan platform
            Laci Digital. Dengan mengakses Platform, Anda menyetujui ketentuan
            yang tercantum di bawah ini.
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
