# 🗄️ Laci Digital - PC IPNU IPPNU Magetan

<div align="center">
  <img src="public/images/readme-preview.webp" alt="Laci Digital Preview" width="100%" style="border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
  
  <p align="center">
    <img src="https://img.shields.io/badge/Versi%20Sistem-v1.0.0-22c55e?style=for-the-badge" alt="Versi Sistem">
  </p>
  
  <p align="center">
    <strong>Sistem Informasi Manajemen Terintegrasi untuk PC IPNU IPPNU Kabupaten Magetan.</strong>
    <br />
    <em>Kelola Organisasi Lebih Modern, Efisien, dan Transparan.</em>
  </p>
</div>

---

## 🌟 Tentang Proyek

**Laci Digital** adalah solusi manajemen digital yang dikembangkan untuk mendigitalisasi proses administrasi dan manajemen data di lingkungan **PC IPNU IPPNU Kabupaten Magetan**. Fokus utama platform ini adalah menyatukan data anggota, mempercepat alur surat-menyurat, serta memberikan insight keaktifan organisasi secara real-time.

## ️ Fitur Unggulan

### 1. 📊 Dashboard & Monitoring

- **Monitoring Cabang**: Pantau statistik anggota, PAC aktif, dan verifikasi tertunda secara real-time.
- **Top 5 Leaderboard**: Klasemen otomatis PAC paling aktif berdasarkan skor aktivitas organisasi.
- **Visualisasi Data**: Grafik interaktif untuk distribusi data dan tren perkembangan.

### 3. 🛡️ Keamanan & Autentikasi Modern

- **Multi-Auth System**: Mendukung login tradisional (Email & Password) dan shortcut login via **Google Social Login**.
- **Registration-First Policy**: Keamanan tinggi di mana login Google hanya diizinkan bagi user yang sudah terdaftar secara manual oleh admin.
- **Better Auth Integration**: Manajemen sesi tingkat lanjut dengan proteksi CSRF dan penanganan token yang aman.

### 4. 👥 Manajemen Keanggotaan

- **Data Terpusat**: Database anggota terstruktur per masa khidmah (periode).
- **Profil Mandiri**: Setiap user memiliki kontrol penuh atas data profil dan pengaturan keamanan.
- **Verifikasi Email**: Memastikan autentisitas user untuk melindungi data sensitif melalui OTP.

### 5. 📂 Sistem Arsip & Administrasi

- **Arsip Surat Terorganisir**: Manajemen Surat Masuk dan Keluar dengan lampiran file.
- **Berkas Pimpinan**: Ruang penyimpanan digital khusus untuk dokumen-dokumen strategis pimpinan.
- **Smart Upload**: Dukungan Drag & Drop dengan validasi tipe dan ukuran file otomatis.

### 6. 📨 Sistem Pengajuan Dokumen

- **Workflow Mandiri**: Alur pengajuan dari tingkat PAC yang langsung masuk ke antrean verifikasi di tingkat Cabang.
- **Update Status**: Notifikasi visual terkait status approval dokumen.

### 7. 📜 Log Aktivitas & Realtime

- **Realtime Monitoring**: Pembaruan data aktivitas secara langsung (Broadcasting) tanpa perlu refresh halaman.
- **Pelacakan Transparan**: Mencatat setiap aktivitas user (Login, Logout, Create, Update, Delete) secara detail.

### 8. 📋 Presensi Digital

- **Form Publik via QR Code**: Peserta scan QR dan mengisi presensi mandiri tanpa login dengan proteksi anti-duplikat.
- **Kontrol Status**: Tiga mode pengelolaan sesi — Otomatis (jam), Buka Paksa (10 menit), atau Tutup Manual.

## 🔒 Sistem Keamanan Berlapis

Laci Digital menerapkan standar keamanan terbaru untuk melindungi data organisasi:

1.  **Server-Side Hooks**: Memvalidasi setiap pembuatan user untuk mencegah pendaftaran otomatis melalui provider luar (seperti Google).
2.  **Middleware Guards**: Memproteksi rute `/dashboard` secara instan; user non-aktif otomatis dialihkan keluar sistem meskipun memiliki sesi aktif.
3.  **Status Check Logic**: Verifikasi `isActive` di semua level (Client, Middleware, dan Server Actions).
4.  **SEO & Metadata**: Optimalisasi mesin pencari dengan judul halaman dan meta description yang dinamis untuk setiap modul.

## 🚀 Teknologi Utama

- **Framework**: Next.js 15+ (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Better Auth
- **Styling**: Tailwind CSS & Shadcn UI
- **Realtime**: WebSocket Integration

## 📄 Akses & Privasi

Proyek ini adalah sistem internal milik **PC IPNU IPPNU Kabupaten Magetan**.

- **Private Repository**: Kode sumber tidak diizinkan untuk dikloning, disalin, atau didistribusikan ulang tanpa izin resmi.
- **Internal Use Only**: Aplikasi ini hanya digunakan untuk keperluan internal organisasi.

---

_Laci Digital - Memberdayakan Organisasi Melalui Teknologi Digital._
