# API Spec Laci Digital (Draft untuk Backend Terpisah)

Dokumen ini menjelaskan alur kerja per menu dan rancangan endpoint API agar backend bisa dipisahkan dari Next.js. Seluruh aturan bisnis mengikuti perilaku sistem saat ini.

## 1) Asumsi Dasar

- **Base URL**: `https://api.laci-digital.id/v1`
- **Auth**: Bearer token (JWT access) + refresh token (opsional).
- **Role**: `SEKRETARIS_PAC` dan `SEKRETARIS_CABANG`.
- **Periode aktif** adalah scope utama data. Banyak endpoint menolak request jika tidak ada periode aktif.
- **Realtime** disediakan via SSE `GET /realtime` atau WebSocket.
- **Enkripsi** dilakukan di server untuk field sensitif dan file.

## 1.1) Konvensi Teknis

- **Header Auth**: `Authorization: Bearer <accessToken>`
- **Timezone**: simpan di UTC, tampil di lokal.
- **Format tanggal**: ISO 8601 (`YYYY-MM-DD` atau `YYYY-MM-DDTHH:mm:ssZ`)
- **Pagination default**: `page=1`, `limit=10`
- **Upload file**: multipart/form-data
- **Ukuran file**: maksimal 2MB
- **Tipe file umum**: pdf, doc, docx, ppt, pptx (sesuai validasi saat ini)

## 1.2) Enum & Konstanta

- **Organisasi**: `IPNU`, `IPPNU`, `BERSAMA`
- **JenisSurat**: `MASUK`, `KELUAR`
- **StatusPengajuan**: `PENDING`, `DITERIMA`, `DITOLAK`
- **Role**: `SEKRETARIS_PAC`, `SEKRETARIS_CABANG`
- **LogAction**: `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `REJECT`, `EXPORT`, `LOGIN`
- **LogModule**: `ARSIP_SURAT`, `ANGGOTA`, `BERKAS_PIMPINAN`, `BERKAS_SP`, `KEGIATAN`, `PENGAJUAN_PAC`, `PERIODE`, `USER`, `AUTH`

## 2) Format Response Standar

### Sukses

```json
{
  "success": true,
  "message": "OK",
  "data": {},
  "meta": {}
}
```

### Error

```json
{
  "success": false,
  "message": "Error message",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

### Pagination

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 120,
    "totalPages": 12
  }
}
```

## 3) Auth & Session

### Auth Flow

- **Login**: user submit email + password.
- Server mengembalikan `accessToken` + `refreshToken` (Bearer JWT).
- Semua klien (web/mobile) memakai header `Authorization: Bearer <accessToken>`.
- **Refresh flow**:
  - Client memanggil `POST /auth/refresh` dengan `refreshToken`
  - Server mengembalikan pasangan token baru
  - Lama berlaku access token singkat (mis. 15–30 menit), refresh token lebih panjang (mis. 7–30 hari)

### Endpoint

- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /auth/me`

### Request/Response Detail

- `POST /auth/register`
  - Body:
    ```json
    { "name": "string", "email": "string", "password": "string", "recaptchaToken": "string" }
    ```
  - Aturan:
    - name min 2
    - password min 6
    - recaptcha wajib
  - Response: success (akun PAC dibuat, status nonaktif) atau error validation

- `POST /auth/login`
  - Body:
    ```json
    { "email": "string", "password": "string", "recaptchaToken": "string" }
    ```
  - Response:
    ```json
    { "accessToken": "jwt", "refreshToken": "jwt", "expiresIn": 1800 }
    ```

- `POST /auth/refresh`
  - Body:
    ```json
    { "refreshToken": "jwt" }
    ```
  - Response: token baru

- `GET /auth/me`
  - Response: profil user + role + status verifikasi

### Keamanan Token

- **Simpan access token**: di memory (React state) atau secure storage (mobile).
- **Jangan simpan access token** di localStorage jika tidak perlu; untuk web, prefer httpOnly cookie hanya untuk refresh token jika ingin web UX lebih aman.
- **Rotasi refresh token**: setiap refresh, kirim refresh token baru dan blacklist yang lama.
- **Revoke**: endpoint untuk revoke refresh token saat logout.

### Aturan

- User belum terverifikasi **hanya** boleh akses Dashboard dan Profil.
- Middleware / policy harus cek `emailVerified` pada banyak endpoint.

## 4) Periode (Core Rule)

### Alur Bisnis

- User bisa membuat banyak periode, tetapi hanya satu yang **aktif**.
- Periode aktif dipakai untuk semua data utama: arsip, anggota, kegiatan, berkas, pengajuan, log.
- Periode aktif **tidak boleh dihapus**.

### Endpoint

- `GET /periodes` → list periode user
- `POST /periodes` → create periode
- `PUT /periodes/:id` → update nama
- `POST /periodes/:id/activate` → set aktif
- `DELETE /periodes/:id` → hapus (jika tidak aktif)

### Request/Response Detail

- `POST /periodes`
  - Body: `{ "nama": "string" }`
  - Response: success + data { id, isActive }

- `PUT /periodes/:id`
  - Body: `{ "nama": "string" }`

- `POST /periodes/:id/activate`
  - Response: success (periode aktif di-set)

## 5) Arsip Surat

### Alur Bisnis

- Periode aktif wajib.
- Tipe surat: `MASUK` / `KELUAR`.
- Organisasi: `IPNU` / `IPPNU` / `BERSAMA`.
- File lampiran disimpan terenkripsi.

### Endpoint

- `GET /arsip-surat`
  - Query: `q`, `organisasi`, `jenis`, `page`, `limit`
- `POST /arsip-surat`
  - Multipart form: data + file
- `GET /arsip-surat/:id`
- `PUT /arsip-surat/:id`
  - Multipart form
- `DELETE /arsip-surat/:id`
- `GET /arsip-surat/:id/download`
- `GET /arsip-surat/stats`

### Request/Response Detail

- `POST /arsip-surat`
  - Request (multipart):
    - organisasi: `IPNU|IPPNU|BERSAMA` (opsional)
    - noSurat: string (wajib)
    - jenisSurat: `MASUK|KELUAR` (wajib)
    - tanggal: `YYYY-MM-DD` (wajib)
    - pengirimPenerima: string (wajib)
    - perihal: string (wajib)
    - deskripsi: string (opsional)
    - file: pdf/doc/docx/ppt/pptx (<= 2MB, opsional)
  - Response:
    - success + data { id }
    - atau error: `NO_ACTIVE_PERIODE`, `FILE_TOO_LARGE`, `INVALID_FILE_TYPE`

- `PUT /arsip-surat/:id`
  - Sama seperti POST, field opsional untuk update; file baru menimpa lama.

- `GET /arsip-surat/stats`
  - Response:
    ```json
    { "total": 10, "masuk": 4, "keluar": 6, "ipnu": 3, "ippnu": 4, "bersama": 3 }
    ```

## 6) Berkas Pimpinan

### Alur Bisnis

- Periode aktif wajib.
- File disimpan terenkripsi.

### Endpoint

- `GET /berkas-pimpinan`
  - Query: `q`, `page`, `limit`
- `POST /berkas-pimpinan`
- `GET /berkas-pimpinan/:id`
- `PUT /berkas-pimpinan/:id`
- `DELETE /berkas-pimpinan/:id`
- `GET /berkas-pimpinan/:id/download`

### Request/Response Detail

- `POST /berkas-pimpinan`
  - Request (multipart):
    - nama: string (wajib)
    - tanggal: `YYYY-MM-DD` (wajib)
    - catatan: string (opsional)
    - file: pdf/doc/docx/ppt/pptx (<= 5MB, wajib)
  - Response:
    - success + data { id }
    - error: `NO_ACTIVE_PERIODE`, `FILE_TOO_LARGE`, `INVALID_FILE_TYPE`

## 7) Berkas SP

### Alur Bisnis

- Periode aktif wajib.
- Organisasi: `IPNU`, `IPPNU`, `BERSAMA`.
- File terenkripsi.

### Endpoint

- `GET /berkas-sp`
  - Query: `q`, `organisasi`, `page`, `limit`
- `POST /berkas-sp`
- `GET /berkas-sp/:id`
- `PUT /berkas-sp/:id`
- `DELETE /berkas-sp/:id`
- `GET /berkas-sp/:id/download`
- `GET /berkas-sp/stats`

### Request/Response Detail

- `POST /berkas-sp`
  - Request (multipart):
    - organisasi: `IPNU|IPPNU|BERSAMA` (wajib)
    - nama: string (wajib)
    - tanggalMulai: `YYYY-MM-DD` (wajib)
    - tanggalBerakhir: `YYYY-MM-DD` (wajib)
    - catatan: string (opsional)
    - file: pdf/doc/docx/ppt/pptx (<= 2MB, opsional)
  - Response:
    - success + data { id }
    - error: `NO_ACTIVE_PERIODE`, `FILE_TOO_LARGE`, `INVALID_FILE_TYPE`, `ROLE_FORBIDDEN`
  - Aturan: hanya `SEKRETARIS_CABANG`

## 8) Anggota

### Alur Bisnis

- Periode aktif wajib.
- Cabang bisa filter anggota berdasarkan user PAC.
- Field sensitif terenkripsi.

### Endpoint

- `GET /anggota`
  - Query: `q`, `page`, `limit`, `userId`
- `POST /anggota`
- `GET /anggota/:id`
- `PUT /anggota/:id`
- `DELETE /anggota/:id`
- `GET /anggota/:id/image` (avatar / foto)
- `GET /anggota/stats`
  - Query: `userId` (khusus Cabang)

### Request/Response Detail

- `POST /anggota`
  - Request (multipart):
    - namaLengkap: string (wajib)
    - jenisKelamin: `LAKI_LAKI|PEREMPUAN` (wajib)
    - nik, nia, email, tempatLahir, alamatLengkap, noHp, hobi, jabatan, noRfid: string (opsional)
    - tanggalLahir: `YYYY-MM-DD` (opsional)
    - foto: image (<= 2MB, opsional)
  - Response:
    - success
    - error: `NO_ACTIVE_PERIODE`, `FILE_TOO_LARGE`, `VALIDATION_ERROR`

## 9) Kegiatan

### Alur Bisnis

- Periode aktif wajib.
- Status dihitung otomatis: `MENDATANG`, `BERLANGSUNG`, `SELESAI`.

### Endpoint

- `GET /kegiatan`
  - Query: `q`, `page`, `limit`
- `POST /kegiatan`
- `GET /kegiatan/:id`
- `PUT /kegiatan/:id`
- `DELETE /kegiatan/:id`
- `GET /kegiatan/stats`

### Request/Response Detail

- `POST /kegiatan` (Cabang only)
  - Request (json / form):
    - judul: string (wajib)
    - deskripsi: string (opsional)
    - lokasi: string (opsional)
    - warna: string (wajib)
    - tanggalMulai: `YYYY-MM-DDTHH:mm:ssZ` (wajib)
    - tanggalSelesai: `YYYY-MM-DDTHH:mm:ssZ` (opsional)
  - Response:
    - success + data { id }
    - error: `NO_ACTIVE_PERIODE`, `ROLE_FORBIDDEN`, `VALIDATION_ERROR`

## 10) Pengajuan PAC

### Alur Bisnis

- Periode aktif wajib.
- Status awal: `PENDING`.
- PAC hanya boleh edit saat status `PENDING`.
- Cabang bisa `APPROVE` / `REJECT`.
- Jika `REJECT`, alasan wajib diisi.
- Email notifikasi dikirim ke PAC setelah keputusan.

### Endpoint PAC

- `GET /pengajuan-pac`
  - Query: `q`, `page`, `limit`, `status`, `penerima`
- `POST /pengajuan-pac`
- `GET /pengajuan-pac/:id`
- `PUT /pengajuan-pac/:id` (hanya jika PENDING)
- `DELETE /pengajuan-pac/:id`
- `GET /pengajuan-pac/:id/download`
- `GET /pengajuan-pac/stats`

### Request/Response Detail

- `POST /pengajuan-pac` (PAC only)
  - Request (multipart):
    - noSurat: string (wajib)
    - penerima: `IPNU|IPPNU|BERSAMA` (wajib)
    - tanggal: `YYYY-MM-DD` (wajib)
    - keperluan: string (wajib)
    - deskripsi: string (opsional)
    - file: pdf/doc/docx/ppt/pptx (<= 2MB, wajib)
  - Response:
    - success + data { id, status: "PENDING" }
    - error: `NO_ACTIVE_PERIODE`, `FILE_TOO_LARGE`, `ROLE_FORBIDDEN`

- `PUT /pengajuan-pac/:id`
  - Aturan: hanya boleh saat status `PENDING`

- `POST /pengajuan-pac/:id/approve` (Cabang)
  - Response: success atau error: `NOT_FOUND`, `ROLE_FORBIDDEN`

- `POST /pengajuan-pac/:id/reject` (Cabang)
  - Body: { alasanPenolakan: string (wajib) }
  - Response: success atau error: `INVALID_STATUS_TRANSITION`, `ROLE_FORBIDDEN`

### Endpoint Cabang

- `GET /pengajuan-pac/cabang`
  - Query: `q`, `page`, `limit`, `status`, `penerima`, `pacId`
- `POST /pengajuan-pac/:id/approve`
- `POST /pengajuan-pac/:id/reject`
  - Body: `alasanPenolakan`

## 11) Log Aktivitas (Audit)

### Alur Bisnis

- Log tercatat otomatis untuk create/update/delete, login, export, approve/reject.
- Cabang bisa melihat log global.

### Endpoint

- `GET /logs`
  - Query: `search`, `action`, `module`, `startDate`, `endDate`, `page`, `limit`
- `GET /logs/global`
  - Query sama, khusus Cabang
- `GET /logs/stats`
- `GET /logs/stats/global`
- `GET /logs/monitoring` (distribusi, leaderboard, timeline)

### Response Contoh

- `GET /logs`
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "action": "CREATE",
        "module": "ARSIP_SURAT",
        "description": "Membuat arsip surat: 001/PC/2026",
        "createdAt": "2026-02-04T10:00:00Z",
        "user": { "id": "u1", "name": "PAC A", "email": "a@x.id", "role": "SEKRETARIS_PAC" },
        "periode": { "id": "p1", "nama": "2025-2026" }
      }
    ],
    "meta": { "page": 1, "limit": 10, "total": 50, "totalPages": 5 }
  }
  ```

## 12) User (Cabang)

### Alur Bisnis

- Cabang bisa melihat dan mengelola user PAC.
- Bisa aktif/nonaktif dan reset password.

### Endpoint

- `GET /users/pac`
  - Query: `q`, `status`, `emailVerified`, `page`, `limit`
- `GET /users/pac/:id`
- `POST /users/pac/:id/toggle-active`
- `POST /users/pac/:id/reset-password`
- `GET /users/:id/image`
- `GET /users/stats`

### Request/Response Detail

- `POST /users/pac/:id/toggle-active`
  - Response: success atau error: `NOT_FOUND`, `ROLE_FORBIDDEN`
- `POST /users/pac/:id/reset-password`
  - Response: success atau error: `NOT_FOUND`, `ROLE_FORBIDDEN`

### Response Contoh

```json
{
  "data": [
    {
      "id": "u1",
      "name": "PAC A",
      "email": "a@x.id",
      "role": "SEKRETARIS_PAC",
      "isActive": true,
      "emailVerified": "2026-02-01T08:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 25, "totalPages": 3 }
}
```

## 13) Profil & Verifikasi Email

### Alur Bisnis

- Update profil bisa mengubah email → memicu reset status verifikasi.
- Verifikasi via token berlaku 24 jam.

### Endpoint

- `GET /profile`
- `PUT /profile`
- `POST /email/verify`
  - Body: `token`
- `POST /email/resend`

### Request/Response Detail

- `PUT /profile`
  - Request (multipart):
    - name: string (wajib)
    - email: string (wajib)
    - password: string (opsional, min 6)
    - image: image (<= 2MB, opsional)
  - Catatan:
    - Jika email berubah, verifikasi direset dan email verifikasi dikirim ulang.

- `POST /email/verify`
  - Body: `{ "token": "string" }`
  - Response: success jika token valid (<= 24 jam)

- `POST /email/resend`
  - Body: `{ "email": "string" }`

## 13.1) Akses & Policy Ringkas

- **PAC**: hanya data milik sendiri pada periode aktif.
- **Cabang**: dapat melihat data PAC (anggota, pengajuan, log global, user).
- **Unverified**: hanya Dashboard dan Profil.

## 13.2) Matriks Akses Endpoint (Ringkas)

| Endpoint | PAC | Cabang | Unverified |
| --- | --- | --- | --- |
| `/periodes` | ✅ | ✅ | ✅ |
| `/arsip-surat/*` | ✅ | ✅ | ❌ |
| `/berkas-pimpinan/*` | ✅ | ✅ | ❌ |
| `/berkas-sp/*` | ❌ | ✅ | ❌ |
| `/anggota/*` | ✅ | ✅ | ❌ |
| `/kegiatan/*` | ❌ | ✅ | ❌ |
| `/pengajuan-pac` | ✅ | ✅ (list global) | ❌ |
| `/logs` | ✅ | ✅ | ❌ |
| `/users/pac/*` | ❌ | ✅ | ❌ |
| `/profile` | ✅ | ✅ | ✅ |

## 13.3) JSON Schema Ringkas (Request)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "definitions": {
    "AuthLogin": {
      "type": "object",
      "required": ["email", "password", "recaptchaToken"],
      "properties": {
        "email": { "type": "string", "format": "email" },
        "password": { "type": "string", "minLength": 6 },
        "recaptchaToken": { "type": "string", "minLength": 1 }
      }
    },
    "AuthRefresh": {
      "type": "object",
      "required": ["refreshToken"],
      "properties": { "refreshToken": { "type": "string", "minLength": 10 } }
    },
    "AuthRegister": {
      "type": "object",
      "required": ["name", "email", "password", "recaptchaToken"],
      "properties": {
        "name": { "type": "string", "minLength": 2 },
        "email": { "type": "string", "format": "email" },
        "password": { "type": "string", "minLength": 6 },
        "recaptchaToken": { "type": "string", "minLength": 1 }
      }
    },
    "PeriodeCreate": {
      "type": "object",
      "required": ["nama"],
      "properties": { "nama": { "type": "string", "minLength": 1 } }
    },
    "ArsipSuratCreate": {
      "type": "object",
      "required": ["noSurat", "jenisSurat", "tanggal", "pengirimPenerima", "perihal"],
      "properties": {
        "organisasi": { "type": "string", "enum": ["IPNU", "IPPNU", "BERSAMA"] },
        "noSurat": { "type": "string", "minLength": 1 },
        "jenisSurat": { "type": "string", "enum": ["MASUK", "KELUAR"] },
        "tanggal": { "type": "string", "format": "date" },
        "pengirimPenerima": { "type": "string", "minLength": 1 },
        "perihal": { "type": "string", "minLength": 1 },
        "deskripsi": { "type": "string" }
      }
    },
    "BerkasPimpinanCreate": {
      "type": "object",
      "required": ["nama", "tanggal"],
      "properties": {
        "nama": { "type": "string", "minLength": 1 },
        "tanggal": { "type": "string", "format": "date" },
        "catatan": { "type": "string" }
      }
    },
    "BerkasSPCreate": {
      "type": "object",
      "required": ["organisasi", "nama", "tanggalMulai", "tanggalBerakhir"],
      "properties": {
        "organisasi": { "type": "string", "enum": ["IPNU", "IPPNU", "BERSAMA"] },
        "nama": { "type": "string", "minLength": 1 },
        "tanggalMulai": { "type": "string", "format": "date" },
        "tanggalBerakhir": { "type": "string", "format": "date" },
        "catatan": { "type": "string" }
      }
    },
    "AnggotaCreate": {
      "type": "object",
      "required": ["namaLengkap", "jenisKelamin"],
      "properties": {
        "namaLengkap": { "type": "string", "minLength": 1 },
        "jenisKelamin": { "type": "string", "enum": ["LAKI_LAKI", "PEREMPUAN"] },
        "nik": { "type": "string" },
        "nia": { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "tempatLahir": { "type": "string" },
        "tanggalLahir": { "type": "string", "format": "date" },
        "alamatLengkap": { "type": "string" },
        "noHp": { "type": "string" },
        "hobi": { "type": "string" },
        "jabatan": { "type": "string" },
        "noRfid": { "type": "string" }
      }
    },
    "KegiatanCreate": {
      "type": "object",
      "required": ["judul", "warna", "tanggalMulai"],
      "properties": {
        "judul": { "type": "string", "minLength": 1 },
        "deskripsi": { "type": "string" },
        "lokasi": { "type": "string" },
        "warna": { "type": "string", "pattern": "^#?[0-9a-fA-F]{6}$" },
        "tanggalMulai": { "type": "string", "format": "date-time" },
        "tanggalSelesai": { "type": "string", "format": "date-time" }
      }
    },
    "PengajuanPACCreate": {
      "type": "object",
      "required": ["noSurat", "penerima", "tanggal", "keperluan"],
      "properties": {
        "noSurat": { "type": "string", "minLength": 1 },
        "penerima": { "type": "string", "enum": ["IPNU", "IPPNU", "BERSAMA"] },
        "tanggal": { "type": "string", "format": "date" },
        "keperluan": { "type": "string", "minLength": 1 },
        "deskripsi": { "type": "string" }
      }
    },
    "PengajuanReject": {
      "type": "object",
      "required": ["alasanPenolakan"],
      "properties": { "alasanPenolakan": { "type": "string", "minLength": 1 } }
    },
    "ProfileUpdate": {
      "type": "object",
      "required": ["name", "email"],
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "email": { "type": "string", "format": "email" },
        "password": { "type": "string", "minLength": 6 }
      }
    }
  }
}
```

## 14) Realtime

### SSE

- `GET /realtime`
  - Mengirim event JSON:
    ```json
    { "type": "mutation", "model": "ArsipSurat", "action": "create" }
    ```
  - Atau log:
    ```json
    { "type": "log", "action": "CREATE", "module": "ARSIP_SURAT" }
    ```

### Aturan

- Client menyaring event berdasarkan model/tipe.
- Realtime hanya notifikasi, client melakukan fetch ulang data.

## 14.1) Skema Event Realtime

```json
{
  "type": "mutation",
  "model": "ArsipSurat",
  "action": "create",
  "entityId": "uuid"
}
```

```json
{
  "type": "log",
  "action": "CREATE",
  "module": "ARSIP_SURAT",
  "entityId": "uuid"
}
```

### Realtime di Mobile

- Mobile app dapat memakai SSE (jika didukung) atau WebSocket.
- Payload event sama; client cukup men-trigger re-fetch endpoint yang relevan atau update cache lokal.

## 15) Mapping Menu → Aturan Periode

- **Wajib periode aktif**: Arsip Surat, Berkas Pimpinan, Berkas SP, Anggota, Kegiatan, Pengajuan PAC, Log Aktivitas.
- **Tidak wajib**: Dashboard (tetap bisa akses, tapi fitur lain dibatasi), Profile.

## 16) Status Code Rekomendasi

- `200` OK
- `201` Created
- `400` Validation Error
- `401` Unauthorized
- `403` Forbidden (role mismatch / belum verifikasi)
- `404` Not Found
- `409` Conflict (periode aktif dihapus, duplicate)
- `500` Server Error

## 16.1) Kode Error yang Direkomendasikan

- `NO_ACTIVE_PERIODE`
- `UNVERIFIED_EMAIL`
- `NOT_FOUND`
- `ROLE_FORBIDDEN`
- `INVALID_STATUS_TRANSITION`
- `FILE_TOO_LARGE`
- `INVALID_FILE_TYPE`

## 16.2) Mapping Field Response (Decrypt View)

Catatan: field sensitif disimpan terenkripsi di DB dan didekripsi sebelum dikirim ke client.

- **ArsipSurat**
  - DB: `noSurat`, `pengirimPenerima`, `perihal`, `deskripsi` (terenkripsi)
  - Response: nilai asli (plain text)
- **Anggota**
  - DB: `namaLengkap`, `nik`, `nia`, `tempatLahir`, `alamatLengkap`, `noHp`, `hobi`, `jabatan`, `noRfid` (terenkripsi)
  - Response: nilai asli (plain text)
- **BerkasPimpinan**
  - DB: `nama`, `catatan` (terenkripsi)
  - Response: nilai asli (plain text)
- **BerkasSP**
  - DB: `nama`, `catatan` (terenkripsi)
  - Response: nilai asli (plain text)
- **PengajuanPAC**
  - DB: `noSurat`, `keperluan`, `deskripsi`, `alasanPenolakan` (terenkripsi)
  - Response: nilai asli (plain text)
- **Kegiatan**
  - DB: `judul`, `deskripsi`, `lokasi` (terenkripsi)
  - Response: nilai asli (plain text)

## 16.3) Contoh Response Utama

- `GET /arsip-surat`
  ```json
  {
    "data": [
      {
        "id": "a1",
        "organisasi": "IPNU",
        "noSurat": "001/PC/2026",
        "jenisSurat": "MASUK",
        "tanggal": "2026-02-01",
        "pengirimPenerima": "PC IPNU",
        "perihal": "Undangan Rapat",
        "deskripsi": "Catatan singkat",
        "file": "arsip/enc-file.pdf",
        "createdAt": "2026-02-01T10:00:00Z"
      }
    ],
    "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
  }
  ```

- `GET /pengajuan-pac/:id`
  ```json
  {
    "data": {
      "id": "p1",
      "noSurat": "002/PAC/2026",
      "penerima": "IPPNU",
      "tanggal": "2026-02-02",
      "keperluan": "Pengajuan program",
      "deskripsi": "Rincian",
      "status": "PENDING",
      "file": "pengajuan-pac/enc.pdf"
    }
  }
  ```

- `GET /anggota/:id`
  ```json
  {
    "data": {
      "id": "m1",
      "namaLengkap": "Ahmad",
      "jenisKelamin": "LAKI_LAKI",
      "nik": "1234567890",
      "nia": "IPNU001",
      "tanggalLahir": "2005-01-01",
      "alamatLengkap": "Jl. Contoh",
      "noHp": "0812xxxx",
      "jabatan": "Sekretaris"
    }
  }
  ```

- `GET /periodes`
  ```json
  {
    "data": [
      { "id": "p1", "nama": "2025-2026", "isActive": true, "createdAt": "2026-01-01T00:00:00Z" },
      { "id": "p2", "nama": "2023-2024", "isActive": false, "createdAt": "2024-01-01T00:00:00Z" }
    ]
  }
  ```

- `GET /auth/me`
  ```json
  {
    "data": {
      "id": "u1",
      "name": "PAC A",
      "email": "a@x.id",
      "role": "SEKRETARIS_PAC",
      "isActive": true,
      "emailVerified": "2026-02-01T08:00:00Z"
    }
  }
  ```

- `GET /profile`
  ```json
  {
    "data": {
      "id": "u1",
      "name": "PAC A",
      "email": "a@x.id",
      "image": "profile/enc.jpg"
    }
  }
  ```

- `GET /logs/stats`
  ```json
  {
    "data": {
      "TOTAL": 50,
      "ARSIP_SURAT": 12,
      "ANGGOTA": 8,
      "BERKAS_PIMPINAN": 5,
      "BERKAS_SP": 4,
      "KEGIATAN": 6,
      "PENGAJUAN_PAC": 7,
      "PERIODE": 3,
      "USER": 3,
      "AUTH": 2
    }
  }
  ```

- `GET /logs/monitoring`
  ```json
  {
    "data": {
      "distribution": [
        { "label": "ARSIP_SURAT", "count": 12 },
        { "label": "ANGGOTA", "count": 8 }
      ],
      "leaderboard": [
        { "id": "u1", "name": "PAC A", "score": 25 }
      ],
      "timeline": [
        { "date": "1 Feb", "count": 5 },
        { "date": "2 Feb", "count": 4 }
      ]
    }
  }
  ```

## 16.3.1) Daftar Field Response per Endpoint

- `GET /arsip-surat`
  - id, organisasi, noSurat, jenisSurat, tanggal, pengirimPenerima, perihal, deskripsi, file, createdAt
- `GET /arsip-surat/:id`
  - id, organisasi, noSurat, jenisSurat, tanggal, pengirimPenerima, perihal, deskripsi, file, periode
- `GET /berkas-pimpinan`
  - id, nama, tanggal, catatan, file, createdAt
- `GET /berkas-pimpinan/:id`
  - id, nama, tanggal, catatan, file, periode
- `GET /berkas-sp`
  - id, organisasi, nama, tanggalMulai, tanggalBerakhir, catatan, file, createdAt
- `GET /berkas-sp/:id`
  - id, organisasi, nama, tanggalMulai, tanggalBerakhir, catatan, file, periode
- `GET /anggota`
  - id, namaLengkap, jenisKelamin, nik, nia, email, tempatLahir, tanggalLahir, alamatLengkap, noHp, hobi, jabatan, noRfid, foto, user, periode
- `GET /anggota/:id`
  - id, namaLengkap, jenisKelamin, nik, nia, email, tempatLahir, tanggalLahir, alamatLengkap, noHp, hobi, jabatan, noRfid, foto
- `GET /kegiatan`
  - id, judul, deskripsi, lokasi, warna, tanggalMulai, tanggalSelesai, status
- `GET /kegiatan/:id`
  - id, judul, deskripsi, lokasi, warna, tanggalMulai, tanggalSelesai
- `GET /pengajuan-pac`
  - id, noSurat, penerima, tanggal, keperluan, deskripsi, file, status, periodePac, periodeCabang
- `GET /pengajuan-pac/:id`
  - id, noSurat, penerima, tanggal, keperluan, deskripsi, file, status, alasanPenolakan, user, periodePac, periodeCabang
- `GET /logs`
  - id, action, module, description, createdAt, user, periode

- `GET /kegiatan`
  ```json
  {
    "data": [
      {
        "id": "k1",
        "judul": "Rapat Koordinasi",
        "deskripsi": "Koordinasi rutin",
        "lokasi": "Aula",
        "warna": "#22c55e",
        "tanggalMulai": "2026-02-10T09:00:00Z",
        "tanggalSelesai": "2026-02-10T11:00:00Z",
        "status": "MENDATANG"
      }
    ],
    "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
  }
  ```

- `GET /berkas-pimpinan/:id`
  ```json
  {
    "data": {
      "id": "bp1",
      "nama": "SK Pengurus",
      "tanggal": "2026-01-10",
      "catatan": "Dokumen resmi",
      "file": "berkas-pimpinan/enc.pdf"
    }
  }
  ```

- `GET /berkas-sp/:id`
  ```json
  {
    "data": {
      "id": "bs1",
      "organisasi": "IPNU",
      "nama": "Ketua PC",
      "tanggalMulai": "2026-01-01",
      "tanggalBerakhir": "2027-01-01",
      "catatan": "Masa bakti",
      "file": "berkas-sp/enc.pdf"
    }
  }
  ```

- `GET /users/stats`
  ```json
  {
    "data": {
      "total": 50,
      "aktif": 40,
      "nonaktif": 10,
      "terverifikasi": 35,
      "belumVerifikasi": 15
    }
  }
  ```

- `GET /arsip-surat/stats`
  ```json
  {
    "data": {
      "total": 10,
      "masuk": 4,
      "keluar": 6,
      "ipnu": 3,
      "ippnu": 4,
      "bersama": 3
    }
  }
  ```

- `GET /pengajuan-pac/stats`
  ```json
  {
    "data": {
      "total": 12,
      "ipnu": 4,
      "ippnu": 5,
      "bersama": 3,
      "pending": 2,
      "diterima": 7,
      "ditolak": 3
    }
  }
  ```

## 16.4) Contoh Error Response

- Periode tidak aktif
  ```json
  {
    "success": false,
    "message": "Tidak ada periode aktif",
    "error": { "code": "NO_ACTIVE_PERIODE" }
  }
  ```

- Tidak punya akses (role)
  ```json
  {
    "success": false,
    "message": "Akses ditolak",
    "error": { "code": "ROLE_FORBIDDEN" }
  }
  ```

- File terlalu besar
  ```json
  {
    "success": false,
    "message": "Ukuran file maksimal 2MB",
    "error": { "code": "FILE_TOO_LARGE" }
  }
  ```

- Validasi field
  ```json
  {
    "success": false,
    "message": "Validasi gagal",
    "error": {
      "code": "VALIDATION_ERROR",
      "details": {
        "fields": {
          "namaLengkap": "Nama Lengkap wajib diisi",
          "jenisKelamin": "Jenis Kelamin wajib diisi"
        }
      }
    }
  }
  ```

- Belum login
  ```json
  {
    "success": false,
    "message": "Belum terautentikasi",
    "error": { "code": "UNAUTHORIZED" }
  }
  ```

- Email belum verifikasi
  ```json
  {
    "success": false,
    "message": "Email belum terverifikasi",
    "error": { "code": "UNVERIFIED_EMAIL" }
  }
  ```

- Status tidak valid
  ```json
  {
    "success": false,
    "message": "Tidak dapat mengubah status",
    "error": { "code": "INVALID_STATUS_TRANSITION" }
  }
  ```

## 17) Catatan Migrasi Backend

- Semua logic server actions dipindah ke service backend.
- Frontend hanya melakukan fetch API.
- Prisma/DB tetap di backend.
- SSE/WebSocket berjalan di backend dan dipakai frontend.

## 18) Catatan Implementasi Opsional

- **Rate limit**: misalnya 60 req/menit per user.
- **Idempotency key** untuk create yang sensitif (pengajuan/arsip).
- **Audit log** wajib untuk aksi mutasi kritis.
