# Release v0.3.0: Pemisahan Arsitektur (Backend-Frontend Decoupling) & Persiapan Mobile

> [!NOTE]
> **Catatan Sejarah Proyek (Mengapa Rilis Pertama Langsung v0.3.0?):**
> Jika Anda melihat ini sebagai satu-satunya rilis di repositori ini, hal tersebut sangat wajar! Pada versi `v0.1.0` dan `v0.2.0` sebelumnya, keseluruhan proyek ini masih menggunakan arsitektur **Fullstack Next.js (Monolitik)** murni, yang dikembangkan pada repositori terpisah: [Inur123/laci-next-js](https://github.com/Inur123/laci-next-js).
> 
> Mulai dari versi **v0.3.0** ini, model arsitektur telah dirombak total dan dipisah menjadi Backend (Golang) dan Frontend (Next.js). Perubahan masif ini dipindahkan ke repositori baru (`laci-next-js-sso`) sebagai titik tolak awal untuk mengembangkan ekosistem yang lebih besar, terutama untuk persiapan integrasi dengan aplikasi *Mobile*.

Rilis ini menandai transisi besar dari arsitektur monolitik Next.js (Fullstack) sebelumnya menjadi arsitektur terpisah yang lebih terukur, aman, dan siap untuk diintegrasikan dengan aplikasi *mobile*.

## 🚀 Fitur Baru (New Features)
- **Pemisahan Arsitektur (Decoupling):** Arsitektur sistem kini telah dipisah secara penuh menjadi dua entitas utama:
  - **Backend:** Menggunakan **Golang** sebagai REST API yang kuat dan cepat.
  - **Frontend:** Tetap menggunakan **Next.js** untuk menyajikan antarmuka pengguna (UI) yang interaktif.
  - Hal ini merupakan langkah awal yang esensial untuk mendukung integrasi dengan sistem eksternal dan aplikasi *Mobile* (Flutter/React Native) di masa depan.
- **Inisiasi Modul Mobile:** Menambahkan direktori dan modul `mobile/` beserta API khusus otentikasi *mobile* sebagai fondasi aplikasi ponsel.
- **Webhook Status Anggota:** Menambahkan fitur trigger *webhook* (*real-time HTTP POST*) yang akan menembak *endpoint* eksternal saat status pendaftaran anggota berubah menjadi Diterima atau Ditolak.
- **Modul Manajemen Wilayah Lengkap:** Fitur baru untuk mengelola struktur wilayah secara hierarkis (Cabang, PAC, Ranting, PK).

## 🛠 Perbaikan (Fixes)
- **Konsolidasi Autentikasi SSO:** Memperbaiki sistem *redirect* login, *logout*, dan pengecekan sesi (termasuk *callback* OAuth2) agar diarahkan dengan mulus ke beranda tanpa *error routing*.
- **Penyelarasan Enum Status (Webhook):** Memperbaiki validasi status persetujuan anggota (penggunaan `DITERIMA`/`DITOLAK` menyesuaikan enum database) agar sinkron dan tidak terjadi kegagalan (HTTP 500) pada saat Laci mengirim *webhook* ke sistem anggota eksternal.
- **Penyelesaian Error API File Download:** Memperbaiki rute proxy dan API unduhan berkas (Arsip, Berkas Pimpinan, Pengajuan Berkas) agar terhubung dengan benar ke backend Go.

## ⚡ Optimasi (Optimizations)
- **Peningkatan Performa (Migrasi ke Go):** Pemrosesan logika bisnis kini jauh lebih ringan dan aman karena dieksekusi di *backend* Golang, tidak lagi membebani *Server Actions* Next.js. 
- **Pembersihan Kode Lama:** Menghapus komponen autentikasi, templat email, dan rute API usang yang telah tergantikan oleh ekosistem SSO baru.

*Terima kasih telah menggunakan Laci!*
