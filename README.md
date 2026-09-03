<div align="center">
  <h1>🗄️ Laci IPNU IPPNU</h1>
  <p><strong>Sistem Administrasi Cerdas & Single Sign-On (SSO) Terpusat</strong></p>
</div>

---

## 📖 Tentang Aplikasi
**Laci** adalah ekosistem aplikasi terpusat yang dirancang khusus untuk memodernisasi dan mendigitalkan seluruh tata kelola administrasi organisasi IPNU (Ikatan Pelajar Nahdlatul Ulama) dan IPPNU (Ikatan Pelajar Putri Nahdlatul Ulama). 

Fungsi utama Laci adalah sebagai **Single Sign-On (SSO) Identity Provider**, di mana satu akun Laci dapat digunakan oleh pimpinan (Cabang, PAC, Ranting) maupun anggota untuk masuk (login) dan terhubung ke berbagai sistem atau aplikasi turunan lainnya (seperti Sistem Anggota, Sistem Presensi, dll) tanpa perlu mendaftar berulang kali.

## 🏗️ Arsitektur Sistem
Sejak versi `v0.3.0`, Laci telah bertransformasi dari sistem monolitik menjadi arsitektur modern yang terpisah (*Decoupled Architecture*) untuk menjamin performa, keamanan, dan skalabilitas:

- ⚙️ **Backend (Golang):** Berperan sebagai otak (REST API) yang memproses seluruh logika bisnis, transaksi *database* (melalui Prisma), dan sistem otentikasi.
- 💻 **Frontend Web (Next.js):** Menyajikan antarmuka (*User Interface*) berbasis web modern yang cepat dan responsif untuk para Admin/Pimpinan.
- 📱 **Mobile App (Flutter / React Native - *Preparation*):** Sistem telah didesain dengan modul `mobile/` dan API khusus yang siap diintegrasikan dengan aplikasi ponsel pintar (Android/iOS) di masa mendatang.

## ✨ Fitur Utama

### 1. 🔐 Sistem Single Sign-On (SSO) Terpusat
Menggunakan standar otentikasi modern (OAuth2/OIDC), Laci bertindak sebagai gerbang utama. Pengurus hanya perlu satu kredensial untuk mengakses berbagai portal aplikasi IPNU-IPPNU secara aman.

### 2. 🗺️ Manajemen Struktur Wilayah
Sistem hierarki wilayah yang lengkap dan berjenjang. Pimpinan dapat mengelola, memantau, dan menambahkan struktur di bawahnya:
- **Pimpinan Cabang (PC)**
- **Pimpinan Anak Cabang (PAC)**
- **Pimpinan Ranting (PR) / Pimpinan Komisariat (PK)**

### 3. 👥 Manajemen & Verifikasi Anggota
Mengelola *database* anggota secara terpusat dengan sistem verifikasi berjenjang. Setiap pendaftaran anggota baru melalui sistem eksternal akan masuk ke Laci dalam status *PENDING* untuk kemudian diverifikasi (Diterima/Ditolak) oleh pimpinan yang berwenang.

### 4. 🪝 Integrasi Webhook Real-time
Laci dilengkapi dengan sistem *Webhook* cerdas. Setiap kali ada perubahan penting (misalnya: status anggota diverifikasi oleh Cabang), Laci akan secara otomatis (*real-time*) menembakkan data JSON ke *endpoint* sistem eksternal (seperti Web Sistem Anggota) agar data selalu sinkron di seluruh ekosistem aplikasi.

### 5. 📂 Pengarsipan & Pengajuan Berkas (E-Filing)
Sistem penyimpanan dokumen digital cerdas. Menggantikan proses manual pengajuan Surat Pengesahan (SP) dan pengarsipan berkas pimpinan menjadi sistem digital yang aman, terlacak, dan mudah diunduh kapan saja.

---
*Dibangun dengan ❤️ untuk kemajuan pelajar Nahdlatul Ulama.*
