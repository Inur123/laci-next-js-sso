# Laci Mobile Feature Parity Matrix

Dokumen ini menetapkan perilaku dan cakupan layar Flutter. Parity berarti data,
validasi, hak akses, ownership, periode, workflow, filter, side effect, dan error
sama dengan frontend Next.js + backend Go. Layout desktop tidak disalin; tabel
menjadi card/list/detail yang sesuai layar sentuh.

Kontrak HTTP rinci berada di [API_CONTRACT.md](./API_CONTRACT.md).

## 1. Keputusan produk yang tidak boleh berubah

### Entry flow

```text
Cold start
   -> native splash (logo Laci saja)
   -> restore secure session
      -> sesi valid: /dashboard
      -> tanpa/expired session: /login
   -> tombol SSO (ikon logo SSO)
   -> system browser + PKCE
   -> deep link callback
   -> exchange one-time code
   -> /dashboard sesuai role
```

- Tidak ada landing page `/` versi mobile.
- User yang sudah login tidak melihat login lagi saat membuka aplikasi.
- User yang membatalkan SSO tetap di Login dengan pesan non-teknis.
- User inactive kembali ke Login dengan pesan akun tidak aktif.
- Logout selalu membersihkan secure storage dan seluruh cache sensitif, lalu
  kembali ke Login.
- Back navigation dari Dashboard tidak boleh kembali ke callback/Login.

### Aset

Hanya dua bitmap frontend yang dipakai:

| Aset mobile | Sumber frontend | Pemakaian tunggal |
|---|---|---|
| `assets/images/logo_laci.webp` | `frontend/public/images/logo-laci.webp` | Tengah splash screen. |
| `assets/images/logo_sso.webp` | `frontend/public/images/logo-sso.webp` | Leading icon tombol Login SSO. |

Banner auth, media, preview README, ilustrasi landing, dan asset frontend lain
tidak ikut. Font memakai font sistem perangkat.

### Public web boundary

- Flutter adalah aplikasi pengelola internal.
- Mobile boleh menampilkan QR/link presensi, tetapi targetnya halaman web publik
  `/presensi/{id}`.
- Form peserta, validasi peserta, dan halaman sukses peserta tetap web.
- Mobile tidak mempunyai Public Stats, Public Agenda, Public Wilayah, pendaftaran
  Anggota publik, FAQ landing, Ketentuan, maupun Kebijakan Privasi sebagai
  landing flow. Link legal eksternal boleh dibuka dari About bila kelak diperlukan,
  tetapi bukan bagian scope parity internal.

## 2. Guard global dan source of truth

Urutan guard setelah restore/exchange:

1. Tidak ada token -> Login.
2. `GET /me` memberi `401` -> hapus session -> Login.
3. `isActive=false` -> hapus session -> Login + pesan inactive.
4. `emailVerified=false` -> hanya Dashboard dan Profile.
5. Cocokkan role persis `SEKRETARIS_PAC` atau `SEKRETARIS_CABANG`.
6. Terapkan menu role; route yang tidak sah kembali Dashboard dan tampilkan
   akses ditolak.
7. Muat daftar Periode. Read module yang period-scoped memakai view period;
   mutation resource yang period-scoped tetap menuju active period.

Backend tetap otoritas terakhir. Flutter tidak mengandalkan state lokal untuk
menentukan ownership/status workflow dan selalu menangani `401/403/409/422`.
Seluruh URL client berasal dari `mobile/.env`; perubahan environment tidak boleh
membutuhkan edit source Flutter.

## 3. Master screen matrix

Legenda:

- **CRUD**: create, read, update, delete sesuai ownership.
- **Monitor**: read lintas PAC pada scope backend; tanpa tombol mutasi frontend.
- **Review**: read + terima/tolak workflow.
- **Own**: data milik user pada view period.
- **-**: route/menu tidak tersedia.

| Screen/fitur | PAC verified | Cabang verified | Unverified kedua role | Endpoint utama |
|---|---|---|---|---|
| Splash | Ya | Ya | Ya | Local + session restore |
| Login SSO | Ya | Ya | Ya | `/auth/mobile/login`, `/exchange` |
| Dashboard personal | Ya | Ya | Ya | `GET /dashboard` |
| Dashboard monitoring global | - | Ya | - | `GET /dashboard` |
| Profile | Read-only; kelola di SSO | Read-only; kelola di SSO | Read-only; kelola di SSO | `GET /me`, user image, `SSO_PROFILE_URL` |
| Pengajuan Berkas | Own CRUD; edit hanya pending | Review seluruh PAC, status, delete | - | `/pengajuan-berkas` |
| Referensi Pengajuan | Read-only semua PAC | - | - | `scope=reference` |
| Data Anggota | Own read/history/copy period | Monitor lintas PAC + review status + copy | - | `/anggota` |
| Wilayah Ranting | Own CRUD + copy | Monitor lintas PAC read-only | - | `/wilayah?jenis=RANTING` |
| Wilayah PK | Own CRUD + copy | Monitor lintas PAC read-only | - | `/wilayah?jenis=PK` |
| Agenda Kegiatan | - | Own CRUD + kalender | - | `/agenda-kegiatan`, `/public/phbi` |
| Presensi internal | Own CRUD, QR, participants | Own CRUD, QR, participants | - | `/presensi` |
| Arsip Surat | Own CRUD + import/export | Own CRUD + import/export | - | `/arsip` |
| Berkas PAC/Cabang | Own CRUD + import/export | Own CRUD + import/export | - | `/berkas-pimpinan` |
| Berkas SP | - | Own CRUD + import/export | - | `/berkas-sp` |
| Periode | Own CRUD/activate/view | Own CRUD/activate/view | - | `/periods` |
| Riwayat Aktivitas personal | Ya | Ya | - | `/activity-logs` |
| Monitoring aktivitas global | - | Ya | - | `/activity-logs?scope=global` |
| Manajemen User PAC | - | List/detail/status/delete | - | `/users` |
| Log Email | - | List/stats/retry failed | - | `/email-logs` |
| Backup Database | - | List/create/download/delete | - | `/backups` |
| Logout | Ya | Ya | Ya | `POST /auth/mobile/logout` |
| Form peserta presensi publik | Web saja | Web saja | Web saja | Bukan route Flutter |

Catatan penting: generic backend memberi beberapa hak lebih luas daripada UI
(misalnya Cabang dapat generic delete record berdasarkan ID). Mobile mengikuti
matrix screen di atas dan tidak mengekspos aksi tersembunyi tersebut.

## 4. Navigation model

Menu dibentuk dari `/me`, bukan hard-coded satu menu untuk semua user.

### PAC verified

Urutan fitur setara sidebar web:

1. Dashboard
2. Arsip
   - Arsip Surat
   - Berkas PAC
3. Pengajuan Berkas
4. Referensi Pengajuan
5. Wilayah
   - Ranting
   - PK
6. Data Anggota
7. Presensi
8. Periode
9. Riwayat Aktivitas
10. Profile dan Logout

### Cabang verified

1. Dashboard
2. Arsip
   - Arsip Surat
   - Berkas SP
   - Berkas Cabang
3. Pengajuan Berkas
4. Wilayah
   - Ranting
   - PK
5. Data Anggota
6. Agenda Kegiatan
7. Presensi
8. Manajemen User
9. Periode
10. Riwayat Aktivitas
11. Log Email
12. Backup Database
13. Profile dan Logout

### Unverified

Hanya Dashboard, Profile, dan Logout. Tampilkan banner tetap “Akses Terbatas”
seperti web. Deep link/menu shortcut ke fitur lain harus ditolak sebelum request
data.

Bottom navigation memuat Beranda, Layanan, dan Akun. Tab Layanan menampung semua
fitur sesuai role; pada layar lebar pola yang sama berubah menjadi navigation
rail. Pengelompokan dan semua route di atas tetap harus ada.

## 5. Shell, role theme, dan period context

### Visual identity

| Token | PAC | Cabang |
|---|---|---|
| Primary accent | `#08783E` | `#166A8F` |
| Role label | `PAC` | `CABANG` |
| App title | `Laci PAC` | `Laci Cabang` |

Latar utama `#F3F6F4`, kartu putih, teks utama `#14211A`, teks sekunder
`#64748B`. Warna status domain tidak berubah karena role: amber pending, green
diterima/sukses/open, red ditolak/gagal/closed.

### Period strip

Semua screen data menampilkan:

- badge **Periode Aktif**;
- badge amber **Melihat: {nama}** bila view period berbeda;
- action memilih view period;
- CTA membuat/mengaktifkan periode bila belum ada active period.

Memilih **Tampilkan** hanya mengganti local view period dan header
`X-View-Period`. Memilih **Aktifkan** melakukan mutation server, menghapus pilihan
historis, lalu refetch seluruh provider/module. View period invalid otomatis
kembali active period tanpa error blocking.

## 6. Shared list/detail behavior

Setiap daftar setara frontend mempunyai:

- search debounce;
- filter sheet/dropdown sesuai module;
- sort key + asc/desc;
- pagination server, default 10 per halaman;
- pull-to-refresh;
- loading skeleton;
- empty state berbeda antara “belum ada data” dan “filter tidak menemukan data”;
- retry state untuk network/server error;
- tombol reset filter;
- total item/halaman;
- export bila tersedia di matrix;
- mutation loading yang mencegah double-submit.

Desktop table diubah menjadi card list. Seluruh kolom penting tetap hadir di
card; metadata lengkap dan aksi berada pada detail screen atau overflow menu.
Filter tidak boleh dilakukan hanya pada halaman yang sedang terlihat bila API
menyediakan filter server.

Delete selalu memakai dialog konfirmasi dengan nama/nomor record. Untuk Periode,
User, dan Backup gunakan penekanan destruktif tambahan karena cascade/data tidak
dapat dipulihkan dari aplikasi.

## 7. Dashboard parity

### PAC

Tampilkan data `personal` dari server:

- total Anggota;
- Arsip Surat;
- Berkas PAC/Pimpinan;
- Pengajuan;
- Periode;
- Presensi;
- ringkasan chart per module;
- trend Arsip enam bulan.

Quick action hanya aktif bila `emailVerified=true`. Bila belum verified, card
tetap boleh terlihat tetapi terkunci dan tidak menavigasi ke fitur.

### Cabang

Tampilkan personal cards Cabang ditambah:

- Berkas SP;
- Agenda Kegiatan;
- Manajemen User/PAC aktif;
- monitoring total Anggota, administrasi, PAC aktif, verifikasi pending;
- total Perkaderan: Makesta, Lakmud, Latin, Latpel, Lakut, Diklatama, Diklatmad;
- total Pendidikan: SD, MI, SMP, MTs, SMA, SMK, MAN, Kuliah;
- Top 5/ranking PAC dan breakdown activity score.

Jangan menghitung ulang angka global dari list lokal; pakai response Dashboard
karena scope beberapa count memang berbeda.

## 8. Profile parity dan kepemilikan data SSO

Screen menampilkan avatar, nama, email, role, status verified, dan active period.

Action:

- buka profile SSO eksternal untuk mengelola identitas dan credential;
- logout.

Nama, email, foto profil, dan password tidak dapat diedit dari Flutter karena SSO
adalah sumber kebenaran identitas. Endpoint backend yang mendukung perubahan
profil tidak diekspos sebagai action UI mobile.

## 9. Periode parity

List card menampilkan nama, tanggal dibuat, badge active, dan badge sedang
ditampilkan.

Action kedua role:

- tambah periode; pertama otomatis active;
- tampilkan periode historis;
- aktifkan periode nonaktif;
- edit nama;
- hapus periode nonaktif setelah konfirmasi;
- active period tidak mempunyai action delete.

Setelah activate, view period kembali mengikuti active. Setelah delete, refetch
period list dan semua cache yang mungkin menunjuk ID tersebut. Duplicate nama
ditangani sebagai conflict backend.

## 10. Pengajuan Berkas parity

### Daftar bersama

- Stats: total, pending, diterima, ditolak, kategori penerima.
- Search: nomor surat/keperluan.
- Filter: status dan penerima.
- Cabang/Referensi: filter PAC (`userId`).
- Sort: nomor surat, penerima, tanggal, keperluan, status.
- Export ke spreadsheet lalu `POST /exports/log`.
- Preview/download/share dokumen melalui download token.

### PAC own

- Membuat pengajuan hanya bila active period PAC dan active period Cabang ada.
- Form: nomor surat, penerima, tanggal, keperluan, deskripsi opsional, file wajib.
- File maksimum 2 MiB: PDF, DOC/DOCX, PPT/PPTX, JPG/JPEG, PNG, WebP.
- Status selalu `PENDING`; mobile tidak mengirim status create.
- Edit hanya saat pending. Omit file saat tidak mengganti dokumen.
- Delete own record dengan konfirmasi.
- Detail menampilkan status, alasan penolakan, periode PAC/Cabang, dan dokumen.

### Cabang review

- List seluruh pengajuan yang menuju view period Cabang.
- Tampilkan pengirim PAC/user.
- Detail pending mempunyai action **Terima** dan **Tolak**.
- Penolakan wajib meminta alasan pada UX meski backend menerima reason kosong.
- Setelah review, disable action, refetch detail/list/stats, dan tunggu SSE hanya
  sebagai invalidation tambahan.
- Cabang boleh delete dari list sesuai parity web setelah konfirmasi.

### Referensi PAC

- Menu khusus PAC verified.
- Read-only seluruh pengajuan PAC pada active period Cabang.
- Filter/search/sort/PAC selector dan detail/download tetap ada.
- Tidak ada create, edit, delete, atau review.
- Detail wajib memakai `scope=reference`.

## 11. Anggota parity

Anggota internal adalah read-only karena create berasal dari sistem eksternal.

### List dan stats

- Tab `PENDING`, `DITERIMA`, `DITOLAK`.
- Search nama, jabatan, NIK, NIA, atau nomor HP.
- Cabang mempunyai filter PAC; PAC melihat assignment sendiri.
- Sort/data: nama, periode, jenis kelamin, nomor HP, pembuat.
- Stats accepted: total, laki-laki, perempuan, serta perkaderan.
- Export spreadsheet + audit export.
- Copy anggota ke periode bila user mempunyai lebih dari satu periode.

### Detail

Tampilkan:

- foto dan identitas;
- NIK, NIA, email, HP, RFID;
- tempat/tanggal lahir, jenis kelamin, alamat;
- jabatan, pekerjaan, hobi;
- wilayah dan periode assignment;
- pendidikan dan instansi;
- seluruh riwayat Pendidikan dan Perkaderan;
- status serta alasan penolakan.

Cabang melihat action Terima/Tolak hanya pada status pending. PAC tidak mempunyai
action status.

### Copy period

- Pilih source period, target period berbeda, cari/pilih banyak anggota.
- History source tidak berubah.
- Tampilkan jumlah benar-benar tersalin dari response `copied`, bukan jumlah
  checkbox (duplicate dapat dilewati).
- Wilayah assignment target dapat null sesuai backend; jangan menyalin nilai
  lokal secara asumsi.

## 12. Wilayah Ranting dan PK parity

Kedua screen memakai model sama, dibedakan `jenis`.

Card/list menampilkan nama, ketua, kontak, alamat; Cabang juga menampilkan PAC
pemilik. Search nama/ketua, filter PAC untuk Cabang, sort nama/ketua/kontak/alamat.

### PAC

- create, edit, delete own;
- form nama wajib, ketua/kontak/alamat opsional;
- `jenis` berasal dari screen dan tidak dipilih bebas saat edit;
- salin beberapa wilayah historis dengan jenis sama ke active period;
- tampilkan count aktual `copied`.

### Cabang

- monitor semua PAC yang nama periodenya sama dengan view period Cabang;
- tidak ada add/edit/delete/copy pada UI meskipun sebagian generic endpoint
  backend secara teknis mengizinkannya.

## 13. Agenda Kegiatan parity (Cabang)

Hanya Cabang verified.

- Mode list dan kalender.
- Overlay hari libur/PHBI dari `/public/phbi?year=`; kegagalan upstream tidak
  boleh memblokir agenda internal.
- Stats mendatang, berlangsung, selesai.
- Search judul/deskripsi/lokasi; filter status; sort judul/tanggal/lokasi/status.
- Status dihitung dari tanggal mulai/selesai dan waktu sekarang, bukan field DB.
- Form: judul wajib, lokasi/deskripsi opsional, warna wajib, rentang tanggal/jam.
- Pastikan selesai tidak mendahului mulai.
- CRUD own, export spreadsheet + audit export.

Tidak ada upload dokumen pada Agenda walau frontend action menggunakan helper
form generik.

Backend mengirim field `status` computed pada list/detail Agenda dan menerapkan
filter/sort terhadap nilai waktu tersebut. Mobile tetap boleh menghitung fallback
dari tanggal bila menghadapi backend versi lama, tetapi response server menjadi
sumber utama untuk pagination dan filter.

## 14. Arsip dan dokumen parity

### Arsip Surat — kedua role

- Stats total, masuk, keluar, dan organisasi.
- Search nomor, perihal, pengirim/penerima, deskripsi.
- Filter organisasi dan jenis surat; sort semua kolom utama.
- Form wajib: nomor, organisasi (parity frontend), pengirim/penerima, jenis,
  tanggal, perihal; deskripsi/file opsional.
- File maksimum 2 MiB: PDF, Word, PowerPoint, JPG/JPEG, PNG, WebP.
- CRUD own, detail, preview/download/share.
- Import spreadsheet partial-success dan tampilkan failed rows.
- Export spreadsheet + audit.

Catatan: organisasi optional di backend create, tetapi frontend mewajibkannya;
Flutter mengikuti frontend.

### Berkas PAC/Cabang (`berkas-pimpinan`) — kedua role

- Label “Berkas PAC” untuk PAC dan “Berkas Cabang” untuk Cabang.
- Search nama/catatan; sort nama/tanggal/catatan; stats total/bulan ini.
- Form nama dan tanggal wajib, catatan opsional, file wajib saat create menurut
  frontend parity.
- File maksimum 5 MiB: PDF, Word, PowerPoint, JPG/JPEG, PNG, WebP.
- CRUD own, preview/download/share, import partial-success, export + audit.

### Berkas SP — Cabang saja

- Stats total/IPNU/IPPNU.
- Search nama/catatan/organisasi; filter organisasi; sort nama, organisasi,
  tanggal mulai/berakhir, status, catatan.
- Form nama, organisasi, tanggal mulai, tanggal akhir wajib; catatan/file opsional.
- Tanggal mulai <= tanggal akhir.
- File maksimum 2 MiB: PDF, Word, PowerPoint (tanpa image).
- CRUD own, preview/download/share, import partial-success, export + audit.
- PAC tidak boleh masuk screen/import; backend juga menolak import dengan
  `403 FORBIDDEN`.

Status Berkas SP berasal dari `tanggalBerakhir`. Backend mengirim klasifikasi
computed `AKTIF`, `HAMPIR_HABIS`, atau `KEDALUWARSA` pada list/detail dan memakai
nilai itu untuk filter/sort; UI boleh memberi label khusus “berakhir hari ini”
dari tanggal yang sama tanpa mengubah klasifikasi server.

### Shared file behavior

- File dipilih -> validasi extension, MIME, size -> upload `/files` -> mutation
  domain memakai object key.
- Edit tanpa file baru harus mempertahankan key lama dengan menghilangkan field
  file dari payload.
- Preview file temp tidak disimpan permanen. Share membutuhkan action eksplisit.
- Expired download token diperbarui sekali; `401` sesi tetap memicu login ulang.

## 15. Presensi internal parity

Kedua role mengelola event miliknya sendiri.

### List

- Search nama kegiatan/tempat/penyelenggara.
- Filter `ALL|OPEN|CLOSED`.
- Sort nama, tanggal, jam mulai, tempat, active.
- Card menampilkan kegiatan, penyelenggara, tempat, tanggal/jam, status, jumlah
  peserta.
- Add, detail, edit, delete own.

### Form event

- Nama kegiatan, penyelenggara, tempat, tanggal, jam mulai, jam selesai wajib.
- Jam selesai harus masuk akal terhadap jam mulai pada hari yang sama; backend
  hanya memvalidasi format, sehingga Flutter harus mencegah interval invalid.
- Create default active.

### Detail pengelola

- metadata event dan live status Asia/Jakarta;
- count + daftar peserta decrypted dengan pencarian lima field, lima opsi sort,
  dan pagination 10 item pada detail maupun fullscreen;
- participant detail;
- QR, salin/share link web `/presensi/{id}`, dan simpan QR PNG 2048 px;
- mode presentasi QR/fullscreen yang disesuaikan mobile;
- action edit, delete, tutup manual, kembali otomatis;
- export peserta spreadsheet dan audit export.

Polling/tick UI boleh memperbarui badge waktu, tetapi keputusan submit peserta
tetap server. `isForcedOpen` saat ini tidak membuka event di kalkulasi backend;
UI tidak boleh menjanjikan forced-open yang tidak didukung.

### Batas publik

Flutter tidak memanggil submit participant dan tidak menampilkan success page.
User eksternal selalu menyelesaikan presensi di browser web dari QR/link.

## 16. Riwayat Aktivitas parity

### Personal — kedua role

- Stats total per module.
- List/filter: action, module, search, date range, sort, pagination.
- Detail: description, action, module, entity, timestamp, periode, user,
  browser/device, IP, location, user agent bila tersedia.
- Location/IP adalah PII audit; tidak masuk cache permanen.

### Global — Cabang

- Toggle personal/global.
- Filter PAC/user.
- Monitoring 7 hari: distribusi module, leaderboard user, timeline.
- Cabang dapat membuka detail log user lain.

Login mobile hanya dilanjutkan setelah permission foreground dan koordinat
tersedia, sama seperti Login web. Jika izin ditolak/ditolak permanen atau layanan
lokasi mati, tampilkan langkah pemulihan dan jangan membuka SSO. Setelah sesi
aktif, jangan pernah memalsukan lokasi bila konteks audit tidak tersedia.

## 17. Manajemen User parity (Cabang)

- Stats total, aktif, nonaktif, verified, belum verified.
- Search nama/email.
- Filter status account dan status email.
- Sort nama/email/created/status.
- List hanya PAC.
- Detail: identity/status/active period, count module, pendidikan/perkaderan,
  riwayat perkaderan.
- Toggle aktif/nonaktif dengan konfirmasi.
- Delete PAC dengan konfirmasi destruktif/cascade.
- Tidak ada reset password; SSO yang mengelola.
- Akun Cabang sendiri tidak boleh diubah/dihapus lewat screen ini.

Setelah deactivate/delete, refetch list/stats dan invalidasi directory PAC yang
dipakai filter screen lain.

## 18. Log Email parity (Cabang)

- Stats total, hari ini, sent, failed, distribusi type.
- Search tujuan/subject.
- Filter type, status, date range.
- Sort tanggal, tujuan, subject, type, status.
- Card/detail menampilkan tujuan, subject, type, status, error, retry count,
  timestamp.
- Retry hanya muncul untuk `FAILED`.
- Setelah retry selalu refetch karena retry count naik saat sukses maupun gagal.
- Jangan menjanjikan attachment pada retry; backend retry saat ini mengirim ulang
  body tanpa attachment.

## 19. Backup Database parity (Cabang)

- List filename/key, size, last modified.
- Create backup dengan single-flight loading; proses dapat berlangsung lama.
- Setelah respons atau timeout/network error, refresh list sebelum menawarkan
  retry untuk mencegah duplikat.
- Download memakai signed URL 10 menit dan action user eksplisit.
- Delete memakai key `backups/...` dan dialog konfirmasi.
- Backend mempertahankan maksimum 10 file setelah create.
- Signed URL/file backup tidak dimasukkan log, analytics, clipboard otomatis,
  atau cache permanen.

## 20. Realtime, lifecycle, dan offline

- Buka satu SSE connection setelah login; tutup saat logout.
- Event adalah invalidation signal, bukan record authorized.
- Debounce event beruntun dan refetch provider screen aktif/stats terkait.
- Reconnect exponential backoff saat app foreground/jaringan pulih.
- Saat background, hentikan aktivitas yang tidak perlu; saat foreground,
  revalidate `/me`, active/view period, lalu screen aktif.
- Read screen boleh menampilkan cache memory terakhir dengan label offline.
- Mutation tidak diantrekan otomatis secara offline karena ownership/status/view
  period mungkin telah berubah.
- Jangan retry create/update/delete otomatis setelah connection timeout kecuali
  idempotensi telah dipastikan dengan refetch.

## 21. Shared validation parity

| Domain | Validasi mobile sebelum request |
|---|---|
| Periode | Nama trim tidak kosong. |
| Profile | Tidak ada mutation; perubahan data dilakukan di SSO. |
| Resource dates | Wajib sesuai field; end >= start. |
| Presensi time | `HH:mm`; interval valid. |
| Enum | Kirim raw enum API, tampilkan label Indonesia. |
| Pengajuan | File wajib create, <=2 MiB, allowlist format. |
| Arsip | Organisasi wajib menurut FE; file opsional <=2 MiB. |
| Berkas Pimpinan | File wajib create <=5 MiB. |
| Berkas SP | File opsional <=2 MiB, non-image. |
| Penolakan | Alasan wajib di UI untuk Anggota/Pengajuan. |
| Import | <=3000 rows; tampilkan partial failure per row. |

Server error details tetap dipetakan ke field. Validasi mobile memperbaiki UX,
tetapi tidak menggantikan respons backend.

## 22. Loading, empty, error, dan accessibility

Semua screen harus mempunyai:

- skeleton yang menyerupai card akhir;
- empty state dengan CTA yang sah untuk role;
- no-result state + reset filter;
- offline/timeout/server error + retry;
- unauthorized handler global;
- destructive confirmation;
- snackbar/toast sukses dan error;
- disabled + progress pada tombol submit;
- keyboard-safe form, autofocus yang wajar, dan scroll ke error pertama;
- touch target minimal 44-48 dp;
- semantic label untuk icon, status, avatar, dan QR;
- text scaling tanpa clipping;
- kontras status tidak bergantung warna saja;
- pull-to-refresh dan back behavior konsisten.

## 23. Acceptance matrix

Implementasi belum dianggap parity sebelum skenario berikut lulus.

### Auth dan navigation

- [ ] Cold start tanpa sesi: splash -> Login, tanpa landing.
- [ ] Tombol Login menampilkan logo SSO; splash hanya logo Laci.
- [ ] Lokasi denied/deniedForever/service-off memblokir SSO dan memberi langkah pemulihan.
- [ ] PKCE/deep link/exchange sukses -> Dashboard.
- [ ] State salah, code expired/reused, redirect tidak allowlisted ditolak.
- [ ] Cancel SSO, account inactive, token expired, logout tertangani.
- [ ] Restore sesi valid langsung Dashboard.
- [ ] Profil hanya baca dan tombol kelola membuka `SSO_PROFILE_URL`.
- [ ] PAC/Cabang melihat menu persis matrix.
- [ ] Unverified hanya Dashboard/Profile/Logout, termasuk deep link guard.

### Period dan scope

- [ ] Periode pertama otomatis active.
- [ ] View historical period tidak mengubah tujuan create.
- [ ] Header invalid fallback active.
- [ ] Activate mereset view period dan seluruh cache.
- [ ] Active period tidak bisa dihapus.
- [ ] Cabang Anggota/Wilayah mengikuti nama periode lintas PAC.
- [ ] Pengajuan PAC menyimpan periode PAC dan Cabang yang tepat.

### Workflow

- [ ] PAC create/edit pending/delete Pengajuan; non-pending tidak bisa diedit.
- [ ] Cabang menerima/menolak Pengajuan pending saja.
- [ ] Referensi PAC benar-benar read-only dan memakai scope reference.
- [ ] Anggota internal tidak mempunyai add/edit/delete.
- [ ] Cabang verify Anggota pending saja.
- [ ] PAC Wilayah CRUD/copy; Cabang Wilayah monitor tanpa mutasi.
- [ ] Agenda/Berkas SP/Admin screen tidak dapat dibuka PAC.

### File dan data

- [ ] Semua prefix/limit/format sesuai matrix.
- [ ] Edit tanpa file mempertahankan file lama.
- [ ] Token download expired diperbarui; session expired tidak disalahartikan.
- [ ] Import partial success menampilkan failed rows.
- [ ] Export menghasilkan file lalu mencatat audit.
- [ ] Temp preview dan cache PII dibersihkan saat logout.

### Presensi

- [ ] Status open/closed cocok server Asia/Jakarta pada boundary waktu.
- [ ] Owner melihat participant dan participant detail.
- [ ] QR membuka halaman web peserta.
- [ ] Tidak ada form participant Flutter.
- [ ] Close/auto mode, edit, delete, export bekerja sesuai ownership.

### Admin dan lifecycle

- [ ] Cabang user status/delete, email retry, backup flow lulus.
- [ ] PAC menerima route denied untuk endpoint/screen admin.
- [ ] SSE reconnect dan refetch tidak membocorkan event global.
- [ ] Offline tidak mengantrikan mutation berbahaya.
- [ ] Android/iOS background-foreground merevalidasi sesi.

Perubahan UX boleh membuat flow lebih ringkas untuk mobile, tetapi tidak boleh
mengurangi data penting, mengubah status/periode, memperluas role, atau melewati
konfirmasi dan validasi yang ditetapkan dokumen ini.
