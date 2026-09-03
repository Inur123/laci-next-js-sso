# Laci Mobile API Contract

Dokumen ini adalah kontrak implementasi aplikasi Flutter internal Laci. Sumber
kebenarannya adalah router dan handler Go di `backend/internal/api`, middleware
identitas di `backend/internal/identity`, store di `backend/internal/store`, serta
adapter/action Next.js di `frontend/src`. Bila perilaku UI lama berbeda dengan
otorisasi backend, dokumen ini menyebut keduanya secara eksplisit.

## 1. Batas sistem

- Base URL aplikasi: `${API_BASE_URL}/api/v1`.
- Semua URL client dibaca dari `mobile/.env`; source tidak memiliki fallback
  endpoint. Nilai wajib: `API_BASE_URL`, `FRONTEND_BASE_URL`,
  `MOBILE_REDIRECT_URI`, dan `SSO_PROFILE_URL`.
- Semua business rule, ownership, enkripsi, periode, email, audit, webhook, R2,
  dan realtime tetap dijalankan backend Go.
- Flutter adalah klien internal untuk `SEKRETARIS_PAC` dan
  `SEKRETARIS_CABANG`; aplikasi tidak menyimpan `SSO_CLIENT_SECRET`, API key
  integrasi, cron secret, credential R2, atau credential SMTP.
- Mobile tidak mempunyai landing page publik. Entry flow adalah splash -> login
  SSO -> dashboard.
- Pengelolaan presensi di mobile adalah sisi internal. QR membuka halaman web
  publik `/presensi/{id}` untuk peserta; form dan halaman sukses peserta tidak
  dibuat ulang di Flutter.
- JSON memakai nama field camelCase seperti di contoh. Tanggal/waktu server
  dikirim sebagai RFC 3339; input tanggal resource juga menerima `YYYY-MM-DD`.
  Jam presensi wajib `HH:mm` (24 jam). Rule buka/tutup memakai zona
  `Asia/Jakarta` dan interval inklusif.
- Request biasa dibatasi middleware 30 detik. Stream `/realtime` serta
  `POST /backups` dan `POST /cron/backups` dikecualikan; proses backup memakai
  deadline internal 5 menit.

## 2. Autentikasi mobile

### 2.1 Kontrak final auth bridge

Auth bridge berikut adalah kontrak mobile final yang tersedia di backend. Ia
hidup berdampingan dengan flow cookie web yang sudah ada.

#### `GET /auth/mobile/login`

Memulai Authorization Code + PKCE melalui browser sistem.

Query wajib:

| Query | Aturan |
|---|---|
| `redirect_uri` | Harus sama persis dengan salah satu URI di allowlist backend, default aplikasi `lacidigital://oauth/callback`. |
| `state` | Nilai acak buatan aplikasi, 32-128 karakter URL-safe (`A-Z a-z 0-9 - _ . ~`); dikembalikan tanpa perubahan dan wajib diverifikasi aplikasi. |
| `code_challenge` | Base64url tanpa padding dari SHA-256 `code_verifier`; tepat 43 karakter/32 byte decoded. |
| `code_challenge_method` | Wajib `S256`. |

Respons sukses adalah `302` ke SSO. Setelah callback SSO berhasil, backend
mengarah ke deep link allowlisted:

```text
lacidigital://oauth/callback?code=<one-time-code>&state=<state>
```

Pembatalan/kegagalan diarahkan ke URI yang sama dengan `state` dan salah satu
`error=access_denied|account_inactive|server_error|login_expired|invalid_request`. Access token,
ID token, refresh token provider, dan session token tidak pernah diletakkan di
URL.

Error sebelum redirect SSO: allowlist kosong -> `503 MOBILE_AUTH_DISABLED`,
parameter/redirect/PKCE invalid -> `400 INVALID_AUTH_REQUEST`, kegagalan SSO/DB
-> `502 SSO_LOGIN_FAILED`.

#### `POST /auth/mobile/exchange`

Menukar one-time code dengan session bearer Laci.

```json
{
  "code": "one-time-code",
  "codeVerifier": "original-pkce-verifier",
  "redirectUri": "lacidigital://oauth/callback"
}
```

Ketiga field wajib. `codeVerifier` harus 43-128 karakter URL-safe. Code berumur
2 menit, single-use secara atomik, terikat pada PKCE S256 dan `redirectUri` yang
sama. Code invalid, expired, sudah dipakai, verifier salah, atau redirect berbeda
memberi `400 INVALID_GRANT`; akun yang dinonaktifkan setelah callback memberi
`401 ACCOUNT_INACTIVE`; kegagalan pembuatan session memberi
`500 SESSION_CREATE_FAILED`.

Respons `200`, dengan `Cache-Control: no-store`:

```json
{
  "data": {
    "accessToken": "laci_mob_<opaque>",
    "tokenType": "Bearer",
    "expiresIn": 21600,
    "expiresAt": "2026-08-24T18:00:00Z",
    "user": {
      "id": "...",
      "subject": "...",
      "email": "...",
      "name": "...",
      "image": null,
      "role": "SEKRETARIS_PAC",
      "isActive": true,
      "emailVerified": true,
      "periodeAktifId": "..."
    }
  }
}
```

Backend hanya menyimpan hash SHA-256 token, bukan bearer mentah. Token disimpan
hanya di secure storage perangkat dan dikirim sebagai:

```http
Authorization: Bearer laci_mob_<opaque>
```

Tidak ada refresh endpoint pada kontrak ini. Saat `expiresAt` terlewati atau API
memberi `401`, bersihkan seluruh state sensitif dan jalankan login SSO lagi.

#### `POST /auth/mobile/logout`

Memerlukan bearer mobile. Backend menghapus session mobile dan mengembalikan
`204 No Content`; token kosong, malformed, expired, atau sudah logout juga 204.
Kegagalan DB memberi `500 LOGOUT_FAILED`. Setelah request, Flutter tetap
menghapus token, cache PII, view period, dan state lokal meskipun jaringan gagal.

Konfigurasi deployment yang wajib:

```dotenv
MOBILE_REDIRECT_URIS=lacidigital://oauth/callback
```

Allowlist harus exact-match. `SSO_REDIRECT_URL` backend tetap callback HTTPS
yang terdaftar pada SSO; deep link hanya dipakai setelah callback backend selesai.
Sebelum deployment, jalankan migrasi
`backend/prisma/migrations/20260824000000_add_mobile_auth_bridge` untuk tabel
transaksi dan session mobile.

### 2.2 Flow web yang tetap ada, tetapi tidak dipakai Flutter

| Method/path | Perilaku |
|---|---|
| `GET /auth/login` | Membuat state, nonce, verifier PKCE dalam cookie sementara lalu `302` ke SSO. |
| `GET /auth/callback` | Menukar code, membuat session cookie `laci_session` selama 6 jam, lalu redirect ke frontend web. |
| `GET|POST /auth/logout` | Menghapus session cookie dan redirect ke landing web. |

Flutter tidak mengandalkan cookie HttpOnly ini. Middleware protected API juga
menerima token OIDC provider, tetapi mobile wajib memakai opaque session token
hasil `/auth/mobile/exchange` agar logout, masa hidup, dan pencabutan berada di
backend Laci.

### 2.3 Status akun dan verifikasi email

- Akun `isActive=false` ditolak saat pemetaan identitas/session; callback mobile
  mengirim `error=account_inactive`, sedangkan exchange dan protected API memberi
  `401 ACCOUNT_INACTIVE`.
- Backend dan route guard Flutter sama-sama memblokir fitur internal ketika
  `emailVerified=false`. User tersebut hanya boleh memakai Dashboard, Profile,
  read periode miliknya untuk konteks profil, foto sendiri, realtime, dan
  logout. API backend tetap dapat memiliki kemampuan upload/update profile,
  tetapi UI mobile tidak mengeksposnya karena identitas dikelola oleh SSO.
- Hak akses tetap harus dianggap keputusan server. Menyembunyikan tombol bukan
  pengganti penanganan `403`.

## 3. Header, pagination, response, dan error

### 3.1 Header

| Header | Kapan | Nilai/perilaku |
|---|---|---|
| `Authorization` | Semua protected endpoint | `Bearer <opaque-mobile-token>`. |
| `Content-Type` | Body JSON | `application/json`. Multipart hanya untuk `/files`. |
| `X-View-Period` | Semua protected request ketika user memilih periode historis | ID periode milik user yang sedang dilihat. Backend hanya memakainya pada read period-scoped; pengiriman global menyamai BFF web. |
| `X-Client-Location` | Semua protected request dan exchange Login | String `latitude, longitude` hasil permission foreground. Backend memakainya pada operasi/auth yang dicatat audit; jangan memalsukan nilai. Exchange tetap tanpa bearer. |
| `X-Client-User-Agent` | Semua request | `Laci Mobile`; dipakai backend untuk klasifikasi browser/device pada activity log. |
| `Accept` | Realtime | `text/event-stream`. |
| `X-Client-IP` | Bukan dari aplikasi | Hanya dipercaya backend bila `TrustedProxyHeaders` aktif; harus diisi proxy, bukan Flutter. |
| `X-API-Key` | Integrasi eksternal saja | Dilarang ditanam di APK/IPA. |

Protected CORS web hanya mengizinkan origin frontend yang dikonfigurasi. Native
HTTP biasanya tidak mengirim header `Origin`, sehingga tidak terkena kebijakan
CORS browser. Jangan menjalankan protected API dari WebView dengan origin acak.

### 3.2 Pagination

Endpoint list memakai:

- `page`: default `1`, minimum efektif `1`.
- `limit`: default `10`, minimum efektif `1`, maksimum server `100`.

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

### 3.3 Response mutasi

Mutasi biasanya mengembalikan salah satu bentuk berikut:

```json
{"data": {"id": "..."}, "message": "Data berhasil ditambahkan"}
```

```json
{"message": "Data berhasil diperbarui"}
```

Jangan bergantung pada teks `message` untuk keputusan program; gunakan status
HTTP dan data typed.

### 3.4 Error

Semua error JSON mempunyai envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data belum lengkap",
    "details": {"field": "Wajib diisi"}
  }
}
```

`details` opsional. Mapping minimal Flutter:

| HTTP | Contoh code | Tindakan klien |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Payload/JSON salah; tampilkan pesan, jangan retry otomatis. |
| `401` | `UNAUTHORIZED`, `ACCOUNT_INACTIVE` | Hapus konteks sesi; tampilkan alasan lalu kembali ke login. |
| `401` | `INVALID_TOKEN` | Token file saja kedaluwarsa; mint token unduhan baru dan retry sekali tanpa logout. |
| `401` | `INVALID_API_KEY` | Hanya integrasi publik; jangan dipakai oleh client mobile internal. |
| `403` | `FORBIDDEN`, `EMAIL_UNVERIFIED` | Tampilkan akses ditolak; untuk email belum terverifikasi kembali ke Dashboard/Profile. |
| `404` | `NOT_FOUND`, `FILE_NOT_FOUND`, `IMAGE_NOT_FOUND` | Tampilkan data sudah tidak tersedia lalu refresh list. |
| `409` | `NO_ACTIVE_PERIOD`, `INVALID_TRANSITION`, `ACTIVE_PERIOD`, `DUPLICATE` | Tampilkan konflik rule; refresh state setelah dialog ditutup. |
| `413` | `FILE_TOO_LARGE`, `TOO_MANY_ROWS` | Tolak file/batch tanpa retry. |
| `422` | `VALIDATION_ERROR`, `INVALID_PREFIX`, `INVALID_TARGET` | Petakan `details` ke field bila tersedia. |
| `500` | `INTERNAL_ERROR`, `CRYPTO_ERROR`, `DECRYPT_ERROR` | Pesan generik dan opsi coba lagi. |
| `502/503/504` | storage/SSO/upstream/timeout | Error service; retry hanya untuk operasi aman/idempotent. |

Decoder JSON membatasi body 10 MiB. Struct request menolak field yang tidak
dikenal; resource map mengabaikan kolom yang tidak dikenal. Mobile tetap harus
mengirim hanya field kontrak. Router/middleware standar masih dapat menghasilkan
404/405/500 plain text; parser error harus toleran terhadap body non-JSON dan
memakai fallback berdasarkan status HTTP.

## 4. Periode: rule global

### 4.1 Active period versus view period

- **Active period** adalah tujuan semua create/import/copy yang menyebut periode
  aktif dan periode yang dipakai activity log. Ia dimiliki user login.
- **View period** hanya memengaruhi read endpoint berbasis periode, melalui
  `X-View-Period`.
- Jika `X-View-Period` kosong, tidak ada, tidak valid, atau bukan milik user,
  backend otomatis kembali ke active period.
- Jika user tidak mempunyai active period, read/mutation terkait memberi
  `409 NO_ACTIVE_PERIOD`.
- Query `periodeId` yang masih dikirim beberapa action frontend tidak digunakan
  generic list backend. Flutter harus memakai `X-View-Period`.
- Cabang membaca Anggota dan Wilayah lintas PAC dengan menyamakan **nama**
  periode PAC terhadap nama view period Cabang.
- Pengajuan PAC disimpan dengan dua relasi: `periodeIdPac` (active period PAC)
  dan `periodeId` (active period Cabang saat submit). Cabang membaca pengajuan
  berdasarkan view period Cabang.
- Scope referensi PAC selalu berpindah ke active period Cabang pertama yang
  tersedia, bukan view period PAC.

### 4.2 Period endpoints (authenticated, owner-only)

| Method/path | Input | Respons/rule |
|---|---|---|
| `GET /periods?page=&limit=` | Pagination | Periode milik user, terbaru dahulu. |
| `POST /periods` | `{ "nama": "2026-2028" }` | `nama` wajib non-kosong. Periode pertama otomatis aktif dan mengisi `User.periodeAktifId`. `201`. |
| `GET /periods/{id}` | Path ID | Hanya periode milik user; `{id,nama,isActive}`. |
| `PATCH /periods/{id}` | `{ "nama": "..." }` | Hanya milik user. Backend saat ini trim nama tetapi tidak menolak string kosong; mobile wajib tetap mewajibkan nama. |
| `POST /periods/{id}/activate` | Tanpa body | Atomik: nonaktifkan periode lain, aktifkan target, ubah `periodeAktifId`. |
| `DELETE /periods/{id}` | Tanpa body | Periode aktif ditolak dengan `409 ACTIVE_PERIOD`; relasi periode terhapus cascade untuk periode nonaktif. Wajib konfirmasi keras. |

Create/update/activate/delete menghasilkan activity log `PERIODE` dan event SSE.

## 5. Protected shared endpoints

| Method/path | Akses | Input/query | Respons/catatan |
|---|---|---|---|
| `GET /me` | Auth | - | `{data: User}`; sumber boot session dan route guard. |
| `PATCH /me` | Auth, diri sendiri; tidak diekspos UI mobile | `{name,email?,image?,password?}` | Kapabilitas kompatibilitas backend. Identitas mobile read-only dan perubahan dilakukan melalui SSO. Field `password` diabaikan. |
| `GET /directory/users?role=` | Auth | `role=SEKRETARIS_PAC` default atau `SEKRETARIS_CABANG` | Hanya user aktif + verified, beserta active period; dipakai filter PAC. |
| `POST /files` | Auth | Multipart `file`, `prefix` | Upload terenkripsi dua tahap; lihat bagian file. |
| `GET /images/users/{id}` | Auth | ID user | Decrypt foto, `Cache-Control: private,max-age=300`. Handler tidak memeriksa ownership. |
| `GET /images/anggota/{id}` | Auth | ID anggota | Decrypt foto; handler tidak memeriksa ownership. |
| `GET /realtime` | Auth | SSE | Stream global; detail di bagian realtime. |
| `GET /dashboard` | Auth | `X-View-Period` | Statistik sesuai role/periode. |

`User` minimal: `id`, `subject`, `email`, `name`, `image`, `role`, `isActive`,
`emailVerified`, `periodeAktifId`.

## 6. Generic resource endpoints

Backend memasang pola berikut untuk `wilayah`, `agenda-kegiatan`, `arsip`,
`berkas-pimpinan`, `berkas-sp`, `pengajuan-berkas`, dan `presensi`:

| Method/path | Perilaku umum |
|---|---|
| `GET /{resource}` | List + filter + pagination pada view period. |
| `POST /{resource}` | Create pada active period; role exception di bawah. |
| `GET /{resource}/stats` | Statistik resource pada view period. |
| `GET /{resource}/{id}` | Detail; PAC harus owner, Cabang secara API dapat membaca record apa pun. |
| `PATCH /{resource}/{id}` | Partial update; wajib owner. Field `status` dibuang dari payload generic. |
| `DELETE /{resource}/{id}` | PAC wajib owner; Cabang secara API dapat menghapus record apa pun. UI mobile hanya menawarkan delete pada data yang tampil dalam scope screen. |
| `POST /{resource}/{id}/download-token` | Token 5 menit; PAC owner, Cabang record apa pun. |
| `GET /{resource}/{id}/download?token=` | Binary inline hasil decrypt; masih berada di auth middleware. Token tidak menggantikan bearer, hanya menggantikan ownership check di handler. |

Download route generik juga terpasang pada Wilayah, Agenda, dan Presensi, tetapi
model tersebut tidak punya field file; mobile tidak boleh menampilkan aksi
download untuk ketiganya.

### 6.1 List query

Query bersama:

- `page`, `limit`.
- `search`, case-insensitive, dengan field per resource pada tabel di bawah.
- `userId`: exact owner filter, nilai kosong/`ALL` diabaikan.
- `status`, `organisasi`, `jenisSurat`, `jenis`, `penerima`: exact enum filter,
  nilai kosong/`ALL` diabaikan.
- `sortKey`, `sortDir=asc|desc`. Tanpa `sortKey`, urutan database resource
  dipertahankan. Tanggal disortir sebagai tanggal hanya bila key diawali
  `tanggal` atau sama dengan `createdAt`; field lain lexical.
- `scope`: khusus Pengajuan (`review`/`reference`).

Server saat ini mengambil maksimum 2.000 row resource (3.000 untuk Anggota),
baru melakukan filter/sort/pagination di memory. Karena itu `pagination.total`
dapat terpotong pada dataset yang melewati cap; mobile menampilkan nilai server
dan tidak mengarang total global.

| Resource | Field pencarian |
|---|---|
| Wilayah | `nama`, `ketua` |
| Anggota | `namaLengkap`, `jabatan`, `nik`, `nia`, `noHp` |
| Agenda | `judul`, `deskripsi`, `lokasi` |
| Arsip | `noSurat`, `perihal`, `pengirimPenerima`, `deskripsi` |
| Berkas Pimpinan | `nama`, `catatan` |
| Berkas SP | `nama`, `catatan`, `organisasi` |
| Pengajuan | `noSurat`, `keperluan`, nama pengaju (`user.name`) |
| Presensi | `namaKegiatan`, `tempat`, `penyelenggara` |

Khusus Pengajuan, `sortKey=pengaju` mengurutkan secara lexical berdasarkan
`user.name`; relasi pemilik dimuat sebelum filter, sort, dan pagination.

Untuk Presensi, `status=OPEN` memilih event yang sedang terbuka; nilai non-ALL
lain (UI memakai `CLOSED`) memilih yang tertutup. Status dihitung dari tanggal,
jam, `isActive`, dan waktu server Asia/Jakarta.

Agenda mengembalikan `status` computed (`MENDATANG`, `BERLANGSUNG`, `SELESAI`)
pada list/detail; filter dan sort `status` memakai nilai tersebut. Berkas SP juga
mengembalikan klasifikasi computed `AKTIF`, `HAMPIR_HABIS`, atau `KEDALUWARSA`
dari `tanggalBerakhir` untuk list/detail/filter/sort. UI boleh membedakan label
“Berakhir Hari Ini!” tanpa mengubah klasifikasi server.

### 6.2 Role dan ownership aktual per resource

| Resource | Scope list | Create | Update | Delete | Screen parity |
|---|---|---|---|---|---|
| Wilayah | PAC: own view period. Cabang: semua PAC/Cabang dengan nama periode sama. | Auth apa pun secara API. | Owner. | Owner atau Cabang. | PAC CRUD/copy; Cabang monitoring read-only. |
| Agenda | Own view period. | Cabang saja. | Owner. | Owner atau Cabang. | Cabang CRUD; tidak ada screen PAC. |
| Arsip | Own view period. | PAC/Cabang. | Owner. | Owner atau Cabang. | CRUD masing-masing. |
| Berkas Pimpinan | Own view period. | PAC/Cabang. | Owner. | Owner atau Cabang. | CRUD masing-masing, label Berkas PAC/Cabang. |
| Berkas SP | Own view period. | Cabang saja. | Owner. | Owner atau Cabang. | Hanya Cabang CRUD. |
| Pengajuan | PAC: own `periodeIdPac`. Cabang: semua pada view period Cabang. | PAC saja; selalu `PENDING`. | Owner PAC dan hanya saat masih `PENDING`. | Owner atau Cabang. | PAC create/edit pending/delete; Cabang review/status/delete. |
| Presensi | Own view period. | PAC/Cabang. | Owner. | Owner atau Cabang. | CRUD masing-masing. |

Tabel membedakan rule API aktual dari screen parity. Flutter mengikuti screen
parity dan tetap menangani penolakan backend.

### 6.3 Payload resource

Tanda `*` berarti wajib saat create. PATCH bersifat parsial, tetapi field wajib
yang disertakan tidak boleh kosong.

| Resource | Field yang diterima | Enum/rule | Enrichment respons |
|---|---|---|---|
| Wilayah | `jenis*`, `nama*`, `ketua`, `kontak`, `alamat` | `jenis=RANTING|PK` | `user:{id,name}` |
| Agenda | `judul*`, `deskripsi`, `lokasi`, `warna*`, `tanggalMulai*`, `tanggalSelesai` | Mobile wajib memastikan selesai >= mulai. | `periode:{id,nama}`, `user:{id,name}` |
| Arsip | `noSurat*`, `jenisSurat*`, `tanggal*`, `pengirimPenerima*`, `deskripsi`, `file`, `perihal*`, `organisasi` | `jenisSurat=MASUK|KELUAR`; organisasi opsional `IPNU|IPPNU|BERSAMA|CBP_KPP`. | `periode`, `user` |
| Berkas Pimpinan | `nama*`, `tanggal*`, `catatan`, `file` | Frontend mewajibkan file baru saat create walau backend tidak; mobile mengikuti frontend. | `periode`, `user` |
| Berkas SP | `nama*`, `tanggalMulai*`, `tanggalBerakhir*`, `catatan`, `file`, `organisasi*` | Organisasi enum; mulai tidak boleh sesudah berakhir (validasi FE/mobile). | `periode`, `user` |
| Pengajuan | `noSurat*`, `penerima*`, `tanggal*`, `keperluan*`, `deskripsi`, `file*`, `fileName` | `penerima=IPNU|IPPNU|BERSAMA|CBP_KPP`; server memaksa `status=PENDING`. `fileName` dipakai nama attachment email dan tidak disimpan sebagai kolom. | `user:{id,name,email}`, `periodePac`, `periodeCabang` |
| Presensi | `namaKegiatan*`, `tempat*`, `penyelenggara*`, `tanggal*`, `jamMulai*`, `jamSelesai*`, `isActive`, `isForcedOpen`, `forcedOpenAt` | Jam `HH:mm`. Create default DB `isActive=true`. | `_count:{dataPresensi}` |

Generic create mengembalikan `201`. Create/update/delete membuat activity log dan
event SSE. Mengganti key `file` pada PATCH menghapus object lama setelah update;
untuk mempertahankan file lama, **omit** field `file`. Jangan kirim string kosong.

### 6.4 Stats

`GET /{resource}/stats` selalu mengembalikan `{ "data": {...} }`. Hanya query
`userId` yang diterapkan pada stats umum; filter search/status lain tidak ikut.

| Resource | Field stats |
|---|---|
| Agenda | `total`, `mendatang`, `berlangsung`, `selesai` |
| Arsip | `total`, `masuk`, `keluar`, `ipnu`, `ippnu`, `bersama`, `cbpkpp` |
| Berkas Pimpinan | `total`, `bulanIni` |
| Berkas SP | `total`, `ipnu`, `ippnu` |
| Pengajuan | `total`, `pending`, `diterima`, `ditolak`, `ipnu`, `ippnu`, `bersama`, `cbpKpp` |
| Anggota | Diterima saja: `total`, `lakiLaki`, `perempuan`, plus key lowercase nama perkaderan (mis. `makesta`, `lakmud`). |
| Wilayah/Presensi | Saat ini hanya `total`. |

### 6.5 Wilayah copy workflow

`POST /wilayah/copy` hanya untuk PAC:

```json
{"wilayahIds":["wilayah-lama-1"],"jenis":"RANTING"}
```

- Tujuan selalu active period PAC.
- Setiap source harus milik PAC login, bertipe `jenis` yang diminta, dan berasal
  dari periode lain; source yang tidak cocok dilewati oleh query.
- Cabang ditolak `403 FORBIDDEN`.
- Handler belum memvalidasi list kosong/enum sebelum query. Flutter wajib
  mewajibkan minimal satu ID dan `jenis=RANTING|PK`.
- Tidak ada business unique constraint yang mencegah source sama disalin lagi.
- Respons `200`: `{"message":"1 wilayah berhasil disalin","copied":1}`.
- Side effect: activity `IMPORT` module `WILAYAH` dan SSE mutation.

## 7. File upload, preview, dan download

### 7.1 Upload dua tahap

1. Validasi ekstensi, MIME, dan ukuran di Flutter.
2. `POST /files` multipart dengan field `file` dan `prefix`.
3. Simpan `response.data.key` sementara.
4. Kirim key itu pada field `file`, `image`, atau `foto` payload domain.
5. Bila mutation domain gagal, object upload belum mempunyai rollback otomatis;
   klien tidak boleh menganggap data domain tersimpan.

Respons upload `201`:

```json
{
  "data": {
    "key": "arsip/1720000000000-abcd1234-pdf.enc",
    "name": "surat.pdf",
    "size": 120000
  }
}
```

Server mengenkripsi bytes sebelum menyimpan ke R2. Flutter tidak mengenkripsi
ulang dan tidak menyimpan object key sebagai URL publik.

### 7.2 Prefix dan limit

Multipart keseluruhan dibatasi 6 MiB dan file dibaca maksimal 5 MiB; limit
efektif berikut diterapkan berdasarkan prefix:

| Prefix | Maksimum backend | Parity format frontend | Pemakaian mobile |
|---|---:|---|---|
| `profile` | 2 MiB | Image; hasil crop <=2 MiB | Foto profil |
| `anggota` | 2 MiB | Image | Foto anggota bila flow integrasi memerlukannya; bukan CRUD internal |
| `arsip` | 2 MiB | PDF, DOC/DOCX, PPT/PPTX, JPG/JPEG, PNG, WebP | Arsip surat |
| `berkas-pimpinan` | 5 MiB | PDF, DOC/DOCX, PPT/PPTX, JPG/JPEG, PNG, WebP | Berkas PAC/Cabang |
| `berkas-sp` | 2 MiB | PDF, DOC/DOCX, PPT/PPTX | Berkas SP Cabang |
| `pengajuan` / `pengajuan-berkas` | 2 MiB | PDF, DOC/DOCX, PPT/PPTX, JPG/JPEG, PNG, WebP | Pengajuan; gunakan `pengajuan-berkas` seperti frontend |
| `documents` | 5 MiB | Tidak ada allowlist backend | Prefix default/generik; jangan gunakan bila ada prefix domain yang tepat |

Backend saat ini memeriksa ukuran dan prefix, tetapi tidak mengizinkan/menolak
MIME atau ekstensi tertentu. Karena itu allowlist frontend di tabel adalah rule
wajib Flutter, bukan sekadar hint picker.

### 7.3 Download

1. `POST /{resource}/{id}/download-token` ->
   `{ "token":"...", "expiresIn":300 }`.
2. `GET /{resource}/{id}/download?token=<url-encoded-token>` dengan bearer yang
   sama.
3. Respons binary memakai `Content-Disposition: inline; filename="dokumen.ext"`.

Tanpa query token, owner/Cabang juga dapat download dengan bearer. Mobile harus
memakai token untuk menyamai preview web, tidak menaruh token di log, dan
membersihkan file temp setelah preview/share selesai.

## 8. Anggota (read-only internal + workflow)

Data master Anggota berasal dari sistem eksternal; mobile internal tidak
menyediakan create/edit/delete Anggota.

| Method/path | Akses | Input/query | Rule/respons |
|---|---|---|---|
| `GET /anggota` | Auth | Generic list + `X-View-Period` | PAC own assignment; Cabang semua assignment dari periode bernama sama. Enrichment mencakup `user`, `periode`, `wilayah`, `pendidikans`, `perkaderans`. |
| `GET /anggota/stats` | Auth | `userId?`, `X-View-Period` | Hanya anggota `DITERIMA` dihitung. |
| `GET /anggota/{id}` | Auth | `X-View-Period` | PAC owner; Cabang dapat akses. Detail diselesaikan terhadap assignment view period/same-name period. |
| `PATCH /anggota/{id}/status` | Cabang | `{ "status":"DITERIMA|DITOLAK", "reason":"..." }` | Hanya assignment `PENDING`; reason opsional secara backend. `409 INVALID_TRANSITION` jika sudah diproses. |
| `POST /anggota/copy-period` | Auth | `{anggotaIds,sourcePeriodeId,targetPeriodeId}` | Target wajib periode milik user; sumber != target; list tidak boleh kosong. PAC hanya menyalin assignment miliknya. Cabang dapat memasukkan assignment PAC yang dipilih ke periode Cabang sambil mempertahankan owner asli. History sumber tetap ada. |
| `GET /images/anggota/{id}` | Auth | - | Foto decrypt; tidak ada ownership handler. |

Copy memakai `ON CONFLICT DO NOTHING` dan respons:

```json
{"message":"2 anggota berhasil dimasukkan ke periode tujuan","copied":2}
```

Verifikasi anggota mengenkripsi reason, menulis audit `APPROVE|REJECT`, mengirim
SSE, dan memicu webhook status anggota secara asynchronous.

## 9. Pengajuan workflow dan referensi

### 9.1 Scope list/detail

- PAC normal: `GET /pengajuan-berkas` -> pengajuan miliknya pada view period PAC.
- Cabang review: `GET /pengajuan-berkas?scope=review` -> semua pengajuan yang
  menunjuk view period Cabang; `scope=review` adalah penanda UI, Cabang memang
  sudah mendapat scope ini dari role.
- PAC referensi: `GET /pengajuan-berkas?scope=reference` -> seluruh pengajuan pada
  active period Cabang, dapat difilter `userId` PAC.
- Detail referensi PAC wajib `GET /pengajuan-berkas/{id}?scope=reference` dan
  hanya diizinkan bila record berada pada active period Cabang.

### 9.2 Status

`PATCH /pengajuan-berkas/{id}/status`, Cabang saja:

```json
{"status":"DITERIMA","reason":""}
```

atau:

```json
{"status":"DITOLAK","reason":"Alasan penolakan"}
```

Hanya status `PENDING` dapat berubah. Backend belum mewajibkan reason saat
ditolak, tetapi Flutter wajib meminta alasan sesuai UX review. Update menghasilkan
audit `APPROVE|REJECT`, SSE, dan email status asynchronous kepada PAC.

Create PAC menghasilkan email asynchronous ke pengaju dan admin; bila file dapat
dibaca, attachment menggunakan `fileName`. SMTP failure tidak membatalkan create,
melainkan tercatat di Log Email.

## 10. Presensi internal

### 10.1 Event dan peserta untuk pengelola

Event menggunakan generic `/presensi` CRUD. Tambahan endpoint:

| Method/path | Akses | Respons/rule |
|---|---|---|
| `GET /presensi/{id}/participants` | Owner event saja, termasuk Cabang | `{data:[...],total:n}`; PII nama/email/noHp didekripsi. Cabang tidak dapat melihat peserta event PAC yang bukan miliknya lewat endpoint ini. |
| `GET /presensi/participants/{participantID}` | Owner event saja | `{data: participant}` dengan PII didekripsi. |
| `GET /public/presensi/{id}` | Publik read-only | Detail event, `_count.dataPresensi`, `isOpen`; frontend internal lama memakai endpoint ini lalu mengambil participant protected. Flutter boleh memakai ini untuk status event, tetapi tidak mengirim data peserta. |

Rule `isOpen`:

```text
isActive == true
AND now(Asia/Jakarta) >= tanggal + jamMulai
AND now(Asia/Jakarta) <= tanggal + jamSelesai
```

`isForcedOpen`/`forcedOpenAt` tersimpan, tetapi fungsi server `isOpen` saat ini
tidak membacanya. Aksi tutup manual web mengirim `isActive=false`; kembali auto
mengirim `isActive=true,isForcedOpen=false,forcedOpenAt=null`.

Detail mobile menampilkan QR/deep link web peserta, metadata kegiatan, live
status, jumlah/daftar peserta, export lokal, preview presentasi, edit, tutup/buka,
dan delete owner. QR harus menunjuk URL web publik yang dikonfigurasi, bukan route
Flutter.

### 10.2 Endpoint peserta publik yang sengaja tidak diimplementasikan di mobile

| Method/path | Payload/perilaku |
|---|---|
| `POST /public/presensi/{id}/participants` | `{namaLengkap,email,noHp,organisasi,tingkat?,jabatan?,instansi?}`. Nama 3-100, email valid, HP 10-15 digit, organisasi wajib; event harus open. Duplicate email/HP per event -> `409 DUPLICATE_ATTENDANCE`. |
| `GET /public/presensi/participants/{participantID}` | Halaman sukses web; mengembalikan raw row peserta berdasarkan ID, termasuk PII decrypted serta `emailHash`/`noHpHash`. |

Kedua endpoint ini tetap milik web publik. Flutter internal tidak membuka form
peserta dan tidak menyimpan data form publik.

## 11. Import dan export audit

### `POST /imports/{resource}`

Authenticated. Resource yang didukung hanya `arsip`, `berkas-pimpinan`, dan
`berkas-sp`; lainnya `422 UNSUPPORTED_IMPORT`. Body:

```json
{
  "rows": [{"nama":"Dokumen","tanggal":"24 Agustus 2026"}],
  "fileName": "import.xlsx"
}
```

- Maksimal 3000 row.
- Tujuan selalu active period.
- Format tanggal menerima RFC3339, `YYYY-MM-DD`, `DD/MM/YYYY`, dan nama bulan
  Indonesia.
- Arsip menormalisasi `jenisSurat`; organisasi invalid menjadi null.
- Berkas SP menormalisasi organisasi; invalid menjadi `IPNU`.
- Import memproses partial success, satu per satu, lalu mengembalikan:

```json
{
  "success": 9,
  "failed": 1,
  "errors": ["Baris 3: format tanggal ... tidak valid"],
  "message": "9 data berhasil diimpor"
}
```

Backend menolak import Berkas SP dari PAC dengan `403 FORBIDDEN`; mobile juga
menyembunyikan seluruh Berkas SP dari PAC sesuai frontend.

### `POST /exports/log`

Mencatat export/import lokal yang telah selesai:

```json
{"module":"ARSIP_SURAT","fileName":"Arsip_Cabang.xlsx"}
```

`module` wajib salah satu `ARSIP_SURAT`, `ANGGOTA`, `BERKAS_PIMPINAN`,
`BERKAS_SP`, `AGENDA_KEGIATAN`, `PENGAJUAN_BERKAS`, `PERIODE`, `USER`, `AUTH`,
`PRESENSI`, `WILAYAH`. Membutuhkan active period. Endpoint ini tidak membuat file;
Flutter membuat/export file lokal lebih dulu, lalu mencatatnya.

## 12. Dashboard dan activity log

### `GET /dashboard`

Authenticated, memakai `X-View-Period`.

```json
{
  "data": {
    "role": "PAC|CABANG",
    "emailVerified": true,
    "personal": {
      "anggota": 0,
      "surat": 0,
      "berkasPimpinan": 0,
      "berkasSP": 0,
      "kegiatan": 0,
      "presensi": 0,
      "pengajuan": 0,
      "userCount": 0,
      "periode": 0,
      "globalAnggota": 0,
      "globalArsip": 0,
      "globalPimpinan": 0,
      "globalPengajuan": 0,
      "trend": [{"name":"Aug","value":0}]
    },
    "monitoring": null
  }
}
```

Untuk Cabang, `monitoring` berisi `leaderboard` serta `global` dengan
`totalAnggota`, `totalSurat`, `totalPAC`, `verifikasiPending`, `perkaderan`, dan
`pendidikan`. Beberapa angka `global*` dihitung terhadap seluruh active period,
tidak hanya view period; Flutter tidak menghitung ulang.

### Activity endpoints

| Method/path | Scope/query | Respons/rule |
|---|---|---|
| `GET /activity-logs` | Personal default. Cabang `scope=global`; filter `userId`, `action`, `module`, `search`, `dateFrom|startDate`, `dateTo|endDate`, `sortKey`, `sortDir`, pagination. | List log + user summary. `userId` hanya berlaku pada global Cabang. |
| `GET /activity-logs/stats` | Personal; Cabang `scope=global&userId=` | Map count per module + `TOTAL`. |
| `GET /activity-logs/monitoring?userId=` | Cabang saja | Distribusi module, leaderboard user, timeline 7 hari. |
| `GET /activity-logs/{id}` | Owner log atau Cabang | Detail lengkap termasuk user dan periode. |

Enum action: `CREATE`, `UPDATE`, `DELETE`, `IMPORT`, `EXPORT`, `APPROVE`,
`REJECT`, `LOGIN`, `LOGOUT`. Enum module sama dengan daftar export di atas.

Mutasi generic mencatat module, entity, browser/device, IP, location, user agent,
dan active period. Activity login/logout hanya tercatat bila user mempunyai active
period. Location adalah data audit sensitif; jangan cache permanen di mobile.

## 13. Administrasi Cabang

Semua endpoint berikut berada di middleware `RequireCabang`.

### 13.1 Manajemen user PAC

| Method/path | Input/query | Respons/rule |
|---|---|---|
| `GET /users` | `search`, `status=ACTIVE|INACTIVE`, `emailStatus=VERIFIED|UNVERIFIED`, `sortKey=name|email|createdAt|isActive`, `sortDir`, pagination | Hanya user `SEKRETARIS_PAC`. |
| `GET /users/stats` | - | `{total,aktif,nonaktif,terverifikasi,belumVerifikasi}`. |
| `GET /users/{id}` | ID | API dapat membaca role apa pun berdasarkan ID; screen hanya menautkan PAC dari list. Respons tanpa password, active period, count module, count pendidikan/perkaderan, list perkaderan. |
| `PATCH /users/{id}/status` | `{ "isActive": true }` | Hanya target PAC. Akun sendiri -> `409 SELF_UPDATE`. Audit USER. |
| `DELETE /users/{id}` | - | Hanya target PAC. Akun sendiri -> `409 SELF_DELETE`; relasi cascade. Konfirmasi keras wajib. |

Password/reset tidak tersedia; dikelola SSO.

### 13.2 Log email

| Method/path | Input/query | Respons/rule |
|---|---|---|
| `GET /email-logs` | `search`, `type`, `status`, `dateFrom`, `dateTo`, `sortKey`, `sortDir`, pagination | Search pada tujuan/subject. |
| `GET /email-logs/stats` | - | `{totalAll,totalToday,totalSent,totalFailed,byType}`. |
| `POST /email-logs/{id}/retry` | - | Hanya log `FAILED`; sukses memperbarui status dan `retryCount`, gagal -> `409 EMAIL_RETRY_FAILED`. Attachment asli tidak dikirim ulang oleh retry saat ini. |

Email type: `VERIFICATION`, `VERIFIED_SUCCESS`, `PENGAJUAN_USER`,
`PENGAJUAN_ADMIN`, `PENGAJUAN_STATUS`. Status: `PENDING`, `SENT`, `FAILED`.

### 13.3 Backup

| Method/path | Input/query | Respons/rule |
|---|---|---|
| `GET /backups` | - | `{data:[{key,size,lastModified}]}` dari prefix `backups/`. |
| `POST /backups` | - | Menjalankan `pg_dump`, gzip, upload R2; menyimpan maksimum 10 backup terbaru; `201 {message,key}`. |
| `DELETE /backups?key=` | Key wajib diawali `backups/` | Hapus object. |
| `GET /backups/url?key=` | Key wajib diawali `backups/` | Signed URL 10 menit. Jangan log/share tanpa konfirmasi. |

Backup dapat memakan waktu; tampilkan progress non-deterministik dan jangan
mengirim create dua kali. Endpoint create backup dikecualikan dari timeout global
30 detik dan memakai deadline internal 5 menit. Jika jaringan putus/timeout,
refresh list sebelum menyimpulkan backup gagal.

## 14. Realtime

`GET /realtime` adalah SSE authenticated:

```text
event: connected
data: {}

event: update
data: {"type":"mutation","module":"ARSIP_SURAT","action":"CREATE","entityId":"..."}
```

- Heartbeat comment dikirim tiap 20 detik.
- Event juga dapat bertipe `auth`, `presensi`, `anggota`, atau payload dari
  PostgreSQL `LISTEN laci_realtime`.
- Hub saat ini broadcast global dan tidak memfilter role/owner. Event hanyalah
  sinyal invalidasi; jangan menampilkan payload sebagai data terotorisasi.
- Saat event relevan datang, debounce lalu refetch endpoint protected yang sesuai.
- Reconnect dengan exponential backoff saat jaringan kembali/app foreground;
  hentikan koneksi saat logout.

## 15. Public dan operational endpoint inventory

Bagian ini mencegah endpoint publik ikut terbawa ke UI mobile tanpa sengaja.

| Method/path | Proteksi | Pemakaian mobile internal |
|---|---|---|
| `GET /public/stats` | Publik | Tidak; milik landing web yang tidak ada di mobile. |
| `GET /public/agenda` | Publik | Tidak diperlukan; gunakan protected agenda. |
| `GET /public/wilayah?jenis=&pacId=` | Publik | Tidak; gunakan protected wilayah. |
| `GET /public/phbi?year=YYYY` | Publik | Ya, opsional untuk layer hari libur kalender Agenda Cabang. Year 2000-2100; upstream failure -> `502`. |
| `GET /public/presensi/{id}` | Publik | Read-only boleh untuk status/detail internal seperti frontend; form peserta tetap web. |
| `POST /public/presensi/{id}/participants` | Publik | Tidak; web peserta saja. |
| `GET /public/presensi/participants/{participantID}` | Publik | Tidak; halaman sukses web saja. |
| `GET /public/organisasi` | `X-API-Key` | Tidak; integrasi pendaftaran anggota eksternal. |
| `POST /public/anggota` | `X-API-Key` | Tidak; sumber create anggota eksternal. |
| `GET /public/data` | `X-API-Key` | Tidak; dump integrasi berisi PII. |
| `POST /cron/backups` | `Authorization: Bearer <CRON_SECRET>` | Tidak; scheduler server saja. |
| `GET /health/live` | Publik, di luar `/api/v1` | Diagnostik; `{status:"ok",service:"laci-api"}`. |
| `GET /health/ready` | Publik, di luar `/api/v1` | Diagnostik DB; `503 DATABASE_UNAVAILABLE` bila gagal. |
| `GET /openapi.json` | Publik, di luar `/api/v1` | Dokumentasi developer minimal; saat ini tidak lengkap dan method resource ditulis GET, jadi bukan source of truth/client generation. |

Payload external `POST /public/anggota` menerima `targetRole=PAC|CABANG`,
`targetId`, field Anggota, serta array `perkaderans`/`pendidikans`, membuat status
`PENDING` pada active period target. Secret `X-API-Key` tidak boleh dipakai untuk
menjadikan fitur ini bagian aplikasi Flutter.

## 16. Audit side effects summary

| Aksi | DB/domain | Audit | SSE | Async lain |
|---|---|---|---|---|
| Generic create/update/delete | Mutasi active/current record | Ya | Ya | Pengajuan: email |
| Activate/create/update/delete periode | Mutasi periode | Ya | Ya | - |
| Verify anggota | Assignment pending -> final | APPROVE/REJECT | Ya | Webhook member status |
| Review pengajuan | Pending -> final | APPROVE/REJECT | Ya | Email status |
| Copy/import | Batch/assignment | IMPORT | Ya lewat side effect | - |
| Export log | Hanya log | EXPORT | Tidak melalui hub saat ini | - |
| Profile/user admin | User | UPDATE/DELETE | Ya | Hapus foto lama bila berubah |
| Public participant | Insert peserta | Tidak | Ya | - |
| File upload/download | R2/read | Tidak | Tidak | Enkripsi/dekripsi server |
| Backup | R2/database | Tidak | Tidak | Rotasi maksimum 10 |
| Login/logout | Session | Bila ada active period | Ya | `lastLogoutAt` saat logout web/session |

## 17. Known contract caveats yang harus diuji

1. Cabang mempunyai akses generic detail/delete lebih luas daripada list UI;
   mobile tidak boleh mengekspos pencarian ID atau aksi di luar screen scope.
2. Import Berkas SP dan seluruh route generic Agenda/Berkas SP mempunyai guard
   Cabang; PAC harus menerima `403 FORBIDDEN`.
3. Backend upload belum memvalidasi MIME/extension; mobile wajib memakai allowlist.
4. Token download tidak membuat route publik karena auth middleware tetap aktif.
5. `isForcedOpen` belum memengaruhi kalkulasi `isOpen` server.
6. Stats generic tidak mengikuti seluruh filter list.
7. Active period dan view period tidak boleh tertukar pada mutation.
8. Realtime event global tidak boleh dianggap data authorized.
9. Secret integrasi/cron tidak pernah menjadi configuration flavor Flutter.
10. Public participant detail saat ini mengembalikan PII/hash berdasarkan ID;
    mobile internal tidak boleh memanggil atau menyebarkan endpoint itu.

Setiap perubahan backend pada path, role, enum, header periode, response envelope,
atau file limit wajib memperbarui dokumen ini dan contract test Flutter pada commit
yang sama.
