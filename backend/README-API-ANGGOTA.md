# Master Plan Sistem Anggota IPNU IPPNU

> Status: **rencana implementasi untuk repository baru**  
> Dokumen ini bukan implementasi di repository Laci. Sistem Anggota akan dibuat sebagai aplikasi mandiri, lalu terhubung ke Laci melalui API server-to-server.

## 1. Ringkasan

Sistem Anggota adalah portal mandiri bagi anggota IPNU IPPNU untuk masuk menggunakan SSO, melihat dan memperbarui profil, memilih organisasi tujuan, serta mengirim data ke Laci untuk diverifikasi pengurus yang berwenang.

Teknologi utama:

- Frontend: Next.js dan TypeScript.
- Backend: Go.
- Database: PostgreSQL.
- Autentikasi: SSO IPNU IPPNU ID memakai OAuth 2.0 Authorization Code dan PKCE S256.
- Integrasi Laci: REST API server-to-server dengan API key dan webhook status.
- UI: design system dan komponen custom, tanpa shadcn/ui.

Target alur pengguna:

1. Pengunjung membuka landing page Sistem Anggota.
2. Pengunjung menekan **Masuk dengan IPNU IPPNU ID**.
3. SSO mengautentikasi pengguna.
4. Setelah login, pengguna masuk ke halaman profil anggota.
5. Pengguna melengkapi data dan memilih Cabang/PAC serta Ranting/PK jika diperlukan.
6. Backend Sistem Anggota mengirim data ke Laci.
7. Laci menempatkan data pada periode aktif organisasi tujuan.
8. Status verifikasi Laci tampil kembali di Sistem Anggota.
9. Riwayat periode lama tetap tersimpan ketika anggota masuk ke periode baru.

## 2. Scope versi pertama

### Termasuk

- Landing page publik.
- Login, callback, session, dan logout melalui SSO.
- Halaman profil anggota setelah login.
- Form profil lengkap dan validasi.
- Pemilihan Cabang atau PAC.
- Pemilihan Ranting/PK berdasarkan PAC.
- Pengambilan organisasi dan periode aktif dari Laci.
- Pengiriman data anggota ke Laci.
- Penyimpanan ID referensi dari Laci.
- Status `DRAFT`, `PENDING`, `DITERIMA`, dan `DITOLAK`.
- Webhook perubahan status dari Laci.
- Riwayat pengiriman dan riwayat periode anggota.
- Audit log, observability, rate limit, dan dokumentasi API.
- Testing backend, frontend, integrasi, dan end-to-end.
- Konfigurasi development, staging, dan production.

### Tidak termasuk

- Modul arsip, agenda, presensi, atau administrasi Laci.
- Verifikasi anggota oleh pengurus di Sistem Anggota; verifikasi tetap dilakukan di Laci.
- Menyimpan API key Laci di browser.
- Menentukan `periodeId` Laci secara manual dari frontend.
- Menghapus periode lama ketika anggota masuk ke periode baru.

## 3. Arsitektur

Sistem Anggota dibuat pada repository baru dan terpisah dari repository Laci.

```text
Browser
   │
   ├── HTTPS ──> Next.js Frontend
   │                  │
   │                  │ HTTPS + cookie session
   │                  ▼
   └──────────────> Go Backend
                          │
                          ├── PostgreSQL Sistem Anggota
                          ├── SSO IPNU IPPNU ID
                          └── Laci API
                                  │
                                  └── PostgreSQL Laci
```

Prinsip:

- Frontend hanya menangani tampilan dan interaksi.
- Semua secret, token exchange, dan komunikasi dengan Laci dilakukan backend.
- Backend Sistem Anggota tidak mengakses database Laci langsung.
- Laci menjadi sumber kebenaran organisasi, periode aktif, dan status verifikasi.
- Sistem Anggota menjadi sumber kebenaran profil mandiri dan riwayat sinkronisasi anggota.

## 4. Struktur repository baru

```text
sistem-anggota/
├── backend/
│   ├── cmd/api/
│   ├── internal/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── config/
│   │   ├── crypto/
│   │   ├── database/
│   │   ├── laci/
│   │   ├── member/
│   │   ├── middleware/
│   │   ├── observability/
│   │   └── session/
│   ├── migrations/
│   ├── .env.example
│   ├── go.mod
│   └── README.md
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   ├── styles/
│   │   └── types/
│   ├── .env.example
│   ├── package.json
│   └── README.md
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── SECURITY.md
│   └── RUNBOOK.md
├── compose.yaml
├── Makefile
├── .gitignore
└── README.md
```

## 5. Tanggung jawab sistem

### Sistem Anggota

- Mengelola akun hasil SSO dan session.
- Menyimpan profil anggota secara aman.
- Menampilkan pilihan organisasi dari Laci.
- Mengirim pendaftaran anggota ke Laci.
- Menyimpan ID anggota yang diberikan Laci.
- Menerima dan menampilkan status verifikasi.
- Menampilkan periode terkini dan riwayat periode lama.

### Laci

- Menyediakan data Cabang, PAC, Ranting, PK, dan periode aktif.
- Menentukan periode berdasarkan organisasi tujuan.
- Menyimpan pengajuan sebagai `PENDING`.
- Menampilkan data hanya kepada Sekretaris PAC/Cabang yang berwenang.
- Memproses penerimaan atau penolakan.
- Mengirim perubahan status ke Sistem Anggota.

### SSO IPNU IPPNU ID

- Mengautentikasi pengguna.
- Menyediakan subject, nama, email, dan foto jika tersedia.
- Tidak menggantikan data profil keanggotaan di Sistem Anggota.

## 6. Alur SSO

Wajib menggunakan Authorization Code dengan PKCE S256.

```text
Landing page
   │ klik login
   ▼
GET /api/v1/auth/login
   │ buat state, nonce, code_verifier, code_challenge
   ▼
SSO authorize page
   │ pengguna memilih akun / menyetujui akses
   ▼
GET /api/v1/auth/callback?code=...&state=...
   │ validasi state
   │ tukar code + code_verifier
   │ validasi issuer, nonce, subject, dan token
   ▼
Buat/update user dan session
   ▼
Redirect ke /profile
```

Aturan keamanan autentikasi:

- `state` acak, sekali pakai, berumur pendek, dan disimpan sebagai hash.
- `code_verifier` tidak pernah dikirim ke frontend.
- `code_challenge_method` wajib `S256`.
- Session menggunakan cookie `HttpOnly`, `SameSite=Lax`, dan `Secure` di production.
- Token SSO tidak disimpan di localStorage.
- Database hanya menyimpan hash session token.
- Tombol batal dari SSO kembali ke landing page dengan pesan informatif.
- Session memiliki idle timeout dan absolute timeout.
- Logout menghapus session server dan cookie browser.

## 7. Rencana UI custom

UI dibuat tanpa shadcn/ui. Button, input, select, dialog, badge, toast, skeleton, table, dan dropdown dibangun sebagai design system internal.

### Arah visual

- Modern, terpercaya, institusional, dan ramah bagi anggota muda.
- Palet hijau organisasi, hijau gelap, putih hangat, abu netral, dan aksen emas secukupnya.
- Status: biru untuk informasi/draft, kuning untuk pending, hijau untuk diterima, merah untuk ditolak.
- Tipografi memiliki hierarki kuat dan tidak menyerupai dashboard template generik.
- Satu keluarga ikon yang konsisten.
- Fokus keyboard, kontras, label form, dan pesan error mengikuti WCAG 2.1 AA.
- Responsif untuk ponsel, tablet, laptop, dan desktop.

### Landing page

- Header logo dan nama Sistem Anggota.
- Hero yang menjelaskan manfaat portal.
- Tombol utama **Masuk dengan IPNU IPPNU ID**.
- Tiga langkah: login, lengkapi profil, tunggu verifikasi.
- Penjelasan keamanan dan penggunaan data.
- Footer bantuan, kebijakan privasi, dan versi aplikasi.

### Halaman profil

- Identitas SSO: foto, nama, dan email.
- Status kelengkapan profil.
- Status sinkronisasi/verifikasi Laci.
- Informasi personal.
- Informasi pendidikan/pekerjaan.
- Informasi organisasi.
- Periode terbaru.
- Riwayat periode dan perubahan status.
- Tombol simpan draft dan kirim untuk verifikasi.

### Field profil

- Nama lengkap.
- Jenis kelamin.
- NIK dan NIA.
- Email.
- Tempat dan tanggal lahir.
- Alamat lengkap.
- Nomor HP.
- Hobi/minat bakat.
- Pekerjaan.
- Jenjang dan instansi pendidikan.
- Jabatan.
- Nomor RFID jika tersedia.
- Target Cabang atau PAC.
- Ranting/PK jika target adalah PAC.

Perilaku form:

- Mendukung simpan draft.
- Validasi frontend untuk UX dan backend untuk keamanan.
- Data sensitif ditampilkan dalam bentuk tersamarkan setelah disimpan.
- Ranting/PK hanya berasal dari PAC terpilih.
- Jika memilih Cabang, pilihan Ranting/PK disembunyikan.
- Tampilkan review sebelum submit.
- Ketika data `PENDING`, perubahan organisasi dibuat sebagai revisi, bukan menimpa proses berjalan.

Setiap halaman harus memiliki state loading, empty, error, offline, session berakhir, forbidden, dan success.

## 8. Model data PostgreSQL

### `users`

- `id` UUID primary key.
- `sso_subject` unique.
- `email`, `display_name`, `avatar_url`.
- `last_login_at`, `created_at`, `updated_at`.

### `member_profiles`

- `id` UUID primary key dan `user_id` unique foreign key.
- `full_name` dan `gender`.
- `nik_encrypted`, `nia_encrypted`, `phone_encrypted`.
- `birth_place_encrypted`, `birth_date_encrypted`, `address_encrypted`.
- `rfid_encrypted`.
- `hobby`, `occupation`, `education_level`, `education_institution`, `position`.
- `profile_status`: `DRAFT`, `PENDING`, `DITERIMA`, atau `DITOLAK`.
- `profile_version` untuk optimistic locking.
- `created_at` dan `updated_at`.

### `organization_selections`

- `member_profile_id`.
- `target_role`: `CABANG` atau `PAC`.
- `target_id` dan snapshot `target_name` dari Laci.
- `wilayah_id`, `wilayah_type`, dan `wilayah_name` nullable.
- `active`, `created_at`, `updated_at`.

### `membership_periods`

- `member_profile_id`.
- `laci_member_id`.
- `laci_period_id` dan `period_name`.
- Snapshot organisasi dan wilayah tujuan.
- `verification_status` dan `rejection_reason`.
- `is_current`.
- `submitted_at`, `verified_at`, `created_at`, `updated_at`.
- Unique constraint anggota + `laci_period_id`.

### `sessions`

- `user_id`, `token_hash` unique.
- `expires_at`, `last_seen_at`, `revoked_at`.
- `ip_hash` dan `user_agent` untuk audit.

### `oauth_transactions`

- `state_hash`, `nonce_hash`.
- `code_verifier_encrypted`.
- `return_to`, `expires_at`, `consumed_at`.

### `sync_attempts`

- `member_profile_id`.
- `idempotency_key` unique.
- `direction`: `TO_LACI` atau `FROM_LACI`.
- `operation`, `http_status`, `result_status`.
- `attempt_count`, `next_retry_at`.
- Referensi request yang tidak memuat data sensitif mentah.

### `audit_logs`

- Actor, action, entity type, dan entity ID.
- Metadata JSONB yang sudah disanitasi.
- IP hash dan waktu kejadian.

## 9. Periode dan riwayat anggota

- Identitas anggota disimpan satu kali.
- Satu anggota dapat memiliki banyak riwayat periode.
- Menambahkan anggota ke periode baru tidak menghapus periode lama.
- Hanya periode terbaru yang memiliki `is_current=true`.
- Sistem Anggota menampilkan periode terbaru sebagai utama dan periode lama sebagai riwayat.
- Laci menentukan periode berdasarkan periode aktif organisasi tujuan.
- Sistem Anggota tidak mengirim `periodeId` pada pendaftaran biasa.
- Jika periode organisasi berubah, anggota dapat diajukan ke periode baru.
- Penambahan periode harus idempotent agar retry/klik ganda tidak membuat duplikasi.

## 10. API Backend Sistem Anggota

Prefix API: `/api/v1`.

### Health dan metadata

```http
GET /health/live
GET /health/ready
GET /api/v1/meta
```

### Autentikasi

```http
GET  /api/v1/auth/login
GET  /api/v1/auth/callback
POST /api/v1/auth/logout
GET  /api/v1/auth/session
```

### Profil

```http
GET   /api/v1/me
GET   /api/v1/profile
PATCH /api/v1/profile
POST  /api/v1/profile/submit
GET   /api/v1/profile/periods
GET   /api/v1/profile/history
```

### Organisasi

```http
GET /api/v1/organizations
```

Backend mengambil data dari Laci, menyaring response, lalu mengirim data aman ke frontend. Organisasi boleh di-cache singkat, tetapi periode aktif wajib diperiksa lagi sebelum submit.

### Webhook Laci

```http
POST /api/v1/integrations/laci/member-status
```

Contoh payload:

```json
{
  "eventId": "evt_01...",
  "eventType": "member.verification.updated",
  "occurredAt": "2026-08-21T10:00:00Z",
  "data": {
    "laciMemberId": "ID_ANGGOTA_LACI",
    "status": "DITERIMA",
    "reason": null,
    "periodeId": "ID_PERIODE_LACI",
    "periodeNama": "2025-2027"
  }
}
```

## 11. Kontrak integrasi Laci

Kontrak berikut adalah baseline. Sebelum implementasi proyek baru, kontrak harus diverifikasi terhadap OpenAPI dan integration test Laci.

### Mengambil organisasi

```http
GET /api/v1/public/organisasi
X-API-Key: <LACI_API_KEY>
```

Contoh response:

```json
{
  "success": true,
  "data": {
    "cabang": {
      "id": "ID_USER_CABANG",
      "name": "Sekretaris Cabang",
      "role": "SEKRETARIS_CABANG",
      "periodeAktif": { "id": "ID_PERIODE", "nama": "2025-2027" },
      "wilayah": []
    },
    "pac": [
      {
        "id": "ID_USER_PAC",
        "name": "Sekretaris PAC Magetan",
        "role": "SEKRETARIS_PAC",
        "periodeAktif": { "id": "ID_PERIODE_PAC", "nama": "2025-2027" },
        "wilayah": [
          { "id": "ID_RANTING", "jenis": "RANTING", "nama": "Ranting Desa X" },
          { "id": "ID_PK", "jenis": "PK", "nama": "PK Sekolah Y" }
        ]
      }
    ]
  }
}
```

Aturan:

- Cabang menggunakan `cabang.id` sebagai `targetId`.
- PAC menggunakan `pac[].id` sebagai `targetId`.
- Ranting/PK hanya dari `wilayah` PAC yang dipilih.
- Jika target Cabang, `wilayahId` harus kosong.
- Data hanya masuk ke Sekretaris Cabang/PAC tujuan, bukan semua user Laci.

### Mengirim anggota

```http
POST /api/v1/public/anggota
Content-Type: application/json
X-API-Key: <LACI_API_KEY>
Idempotency-Key: <UUID>
```

Contoh request:

```json
{
  "targetRole": "PAC",
  "targetId": "ID_USER_PAC",
  "wilayahId": "ID_RANTING_ATAU_PK",
  "namaLengkap": "Nama Lengkap Anggota",
  "jenisKelamin": "LAKI_LAKI",
  "nik": "3520xxxxxxxxxxxx",
  "nia": "NIA-001",
  "email": "anggota@example.com",
  "tempatLahir": "Magetan",
  "tanggalLahir": "2005-08-21",
  "alamatLengkap": "Alamat lengkap",
  "noHp": "08xxxxxxxxxx",
  "hobi": "Membaca",
  "jabatan": "Anggota",
  "noRfid": "RFID-001",
  "pekerjaan": "Pelajar",
  "jenjangPendidikan": "SMA",
  "namaInstansiPendidikan": "Nama Sekolah"
}
```

Nilai yang diizinkan:

- `targetRole`: `PAC` atau `CABANG`.
- `jenisKelamin`: `LAKI_LAKI` atau `PEREMPUAN`.

Contoh response:

```json
{
  "data": {
    "id": "ID_ANGGOTA_LACI",
    "targetRole": "PAC",
    "targetId": "ID_USER_PAC",
    "periodeId": "ID_PERIODE_AKTIF"
  },
  "message": "Data anggota berhasil dikirim dan menunggu verifikasi Cabang."
}
```

Backend Sistem Anggota menyimpan `data.id` sebagai `laci_member_id` dan `data.periodeId` sebagai referensi riwayat periode.

### Pekerjaan tambahan di Laci sebelum production

- Tambahkan dukungan `Idempotency-Key`.
- Tambahkan webhook perubahan status.
- Gunakan signature HMAC, timestamp, dan event ID unik.
- Dokumentasikan retry policy dan response webhook.
- Sediakan OpenAPI sebagai kontrak formal.
- Dukung rotasi API key tanpa downtime.

## 12. Sinkronisasi dan kegagalan

### Pengiriman ke Laci

1. Validasi profil dan target.
2. Ambil ulang periode aktif dari Laci.
3. Buat `idempotency_key`.
4. Simpan sync attempt.
5. Kirim dengan timeout dan correlation ID.
6. Jika berhasil, simpan ID Laci, periode, dan status `PENDING`.
7. Jika gagal sementara, retry dengan exponential backoff dan jitter.
8. Error permanen seperti `400`, `401`, `403`, dan `422` tidak di-retry otomatis.

### Menerima webhook

1. Validasi signature dan timestamp.
2. Tolak replay atau signature salah.
3. Proses `eventId` secara idempotent.
4. Cari profil melalui `laci_member_id`.
5. Perbarui status dalam satu transaksi.
6. Simpan audit log.
7. Beri response cepat; pekerjaan tambahan berjalan asinkron.

### Rekonsiliasi

Sediakan job untuk memeriksa data `PENDING` terlalu lama. Jika Laci memiliki endpoint status, lakukan rekonsiliasi otomatis. Jika belum, tandai untuk pemeriksaan admin tanpa mengubah status secara spekulatif.

## 13. Keamanan dan privasi

- Semua environment nonlokal wajib HTTPS.
- API key Laci dan secret SSO hanya berada di backend/secret manager.
- NIK, NIA, nomor HP, alamat, tanggal lahir, dan RFID dienkripsi per field memakai AES-256-GCM atau KMS.
- Log tidak boleh memuat token, secret, NIK, atau payload personal lengkap.
- Terapkan CSRF protection untuk cookie session.
- CORS memakai allowlist, bukan wildcard dengan credentials.
- Terapkan secure headers dan Content Security Policy.
- Rate limit login, update profil, submit, dan webhook.
- Gunakan parameterized SQL.
- Validasi ukuran body dan semua field.
- Redirect URL menggunakan allowlist.
- Jalankan dependency scanning, secret scanning, dan static analysis.
- Audit login, logout, perubahan profil, submit, webhook, dan status.
- Tetapkan kebijakan retensi, koreksi, ekspor, dan penghapusan data.
- Backup terenkripsi dan proses restore wajib diuji.

## 14. Environment

### Backend

```env
APP_ENV=development
HTTP_ADDR=:8090
FRONTEND_URL=http://localhost:3100
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/sistem_anggota?sslmode=disable

SSO_ISSUER=https://api.pelajarnumagetan.id
SSO_CLIENT_ID=ganti_dengan_client_id_sistem_anggota
SSO_CLIENT_SECRET=ganti_dengan_client_secret_sistem_anggota
SSO_REDIRECT_URL=http://localhost:8090/api/v1/auth/callback

SESSION_COOKIE_NAME=anggota_session
SESSION_COOKIE_SECURE=false
SESSION_TTL=24h
ENCRYPTION_KEY=ganti_dengan_base64_key_32_byte

LACI_API_URL=http://localhost:8080/api/v1
LACI_API_KEY=ganti_dengan_api_key_laci
LACI_WEBHOOK_SECRET=ganti_dengan_webhook_secret
```

### Frontend

```env
NEXT_PUBLIC_APP_NAME=Sistem Anggota IPNU IPPNU
NEXT_PUBLIC_API_URL=http://localhost:8090
```

Local, staging, dan production memakai secret berbeda. File `.env` tidak boleh di-commit.

## 15. Observability

- Structured JSON log dengan request ID dan correlation ID.
- Metrics request rate, error rate, latency, login, submit, retry, dan webhook.
- Correlation ID diteruskan antara Sistem Anggota dan Laci.
- Alert ketika login gagal tinggi, Laci unavailable, retry menumpuk, atau webhook gagal.
- Readiness memeriksa database/dependency dengan timeout pendek.
- Liveness tidak bergantung pada layanan eksternal.
- Dashboard operasional tidak memuat data sensitif.
- Runbook untuk kegagalan SSO, Laci, API key, webhook, dan database.

## 16. Strategi testing

### Backend Go

- Unit test config, PKCE, state/nonce, cookie, encryption, validation, dan mapping payload.
- Repository test dengan PostgreSQL sementara.
- Handler test untuk response sukses dan error.
- Contract test response Laci.
- Test idempotency, retry, webhook replay, dan race condition.
- Test migration pada database kosong dan database berisi fixture.
- Coverage domain kritis minimal 80%.

### Frontend Next.js

- Unit test utility dan validator.
- Component test form, dialog, status badge, dan error state.
- Accessibility test otomatis.
- Responsive test pada viewport utama.
- Verifikasi tidak ada secret/API key di browser bundle.

### End-to-end

- Login SSO berhasil dan dibatalkan.
- Session kedaluwarsa.
- Simpan draft profil.
- Pilih Cabang.
- Pilih PAC lalu Ranting/PK.
- Submit menjadi `PENDING`.
- Laci menolak data invalid.
- Webhook mengubah status menjadi `DITERIMA` atau `DITOLAK`.
- Anggota masuk periode baru tanpa kehilangan periode lama.
- Retry tidak membuat duplikasi.

### Quality gate CI

- Go format, vet, test, dan vulnerability check lulus.
- TypeScript typecheck, lint, test, dan production build lulus.
- Migration, secret scan, dependency scan, dan container scan lulus.

## 17. Deployment

- Local: Docker Compose untuk PostgreSQL, backend, dan frontend.
- Staging: SSO client, database, API key, dan domain khusus staging.
- Production: frontend/backend terpisah, managed PostgreSQL, TLS, secret manager, backup, monitoring, dan alerting.

Urutan release:

1. Backup dan verifikasi restore point.
2. Jalankan migration melalui job khusus.
3. Deploy backend.
4. Smoke test health, SSO, database, dan Laci.
5. Deploy frontend.
6. Jalankan end-to-end smoke test.
7. Pantau error rate dan latency.
8. Siapkan rollback aplikasi dan migration backward-compatible.

## 18. Tahapan dan checklist

### Fase 0 — Validasi kontrak

- [ ] Bekukan scope versi pertama.
- [ ] Verifikasi discovery, authorize, token, dan userinfo SSO.
- [ ] Daftarkan SSO client khusus Sistem Anggota.
- [ ] Sepakati domain dan redirect URI setiap environment.
- [ ] Verifikasi API organisasi dan anggota Laci.
- [ ] Sepakati webhook, signature, retry, dan idempotency.
- [ ] Buat OpenAPI awal.

### Fase 1 — Fondasi repository

- [ ] Buat repository baru.
- [ ] Scaffold backend Go dan frontend Next.js.
- [ ] Tambahkan PostgreSQL dan migration tool.
- [ ] Buat Makefile dan Docker Compose.
- [ ] Buat `.env.example` tanpa secret nyata.
- [ ] Siapkan CI backend/frontend.
- [ ] Tambahkan logging, request ID, recovery, timeout, CORS, dan secure headers.

### Fase 2 — Database dan domain

- [ ] Implementasikan migration awal.
- [ ] Implementasikan repository user, profil, periode, session, sync attempt, dan audit.
- [ ] Implementasikan enkripsi field sensitif.
- [ ] Implementasikan optimistic locking.
- [ ] Buat fixture dan migration test.

### Fase 3 — SSO dan session

- [ ] Implementasikan discovery SSO.
- [ ] Implementasikan Authorization Code + PKCE S256.
- [ ] Implementasikan state, nonce, callback, dan cancel.
- [ ] Implementasikan cookie session dan logout.
- [ ] Implementasikan middleware autentikasi.
- [ ] Tambahkan test autentikasi.

### Fase 4 — Integrasi Laci

- [ ] Buat client Laci dengan timeout dan correlation ID.
- [ ] Ambil Cabang/PAC/Ranting/PK.
- [ ] Implementasikan cache singkat organisasi.
- [ ] Implementasikan submit anggota.
- [ ] Implementasikan idempotency dan retry.
- [ ] Implementasikan webhook status.
- [ ] Implementasikan rekonsiliasi.
- [ ] Tambahkan contract dan integration test.

### Fase 5 — Frontend custom

- [ ] Tetapkan color, typography, spacing, radius, shadow, dan motion tokens.
- [ ] Buat button, input, select, dialog, badge, alert, toast, table, dan skeleton custom.
- [ ] Buat landing page.
- [ ] Buat login/logout.
- [ ] Buat layout profil responsif.
- [ ] Buat form profil dan validasi.
- [ ] Buat selector Cabang/PAC/Ranting/PK.
- [ ] Buat review sebelum submit.
- [ ] Buat tampilan status dan riwayat periode.
- [ ] Lengkapi loading, empty, error, offline, dan expired-session state.
- [ ] Audit accessibility dan responsive.

### Fase 6 — Hardening dan dokumentasi

- [ ] Security review dan threat model.
- [ ] Load test endpoint utama.
- [ ] Audit query dan index.
- [ ] Verifikasi backup/restore.
- [ ] Lengkapi README, API, deployment, security, dan runbook.
- [ ] Buat metrics dashboard dan alert.
- [ ] Uji rotasi secret/API key.

### Fase 7 — UAT dan rilis

- [ ] UAT dengan akun anggota, PAC, dan Cabang.
- [ ] Uji data target tidak tampil ke organisasi lain.
- [ ] Uji pergantian periode dan riwayat lama.
- [ ] Uji cancel login dan error penting.
- [ ] Uji staging end-to-end dengan Laci.
- [ ] Dapatkan persetujuan UAT.
- [ ] Deploy production dan smoke test.
- [ ] Pantau masa stabilisasi.

## 19. Definition of Done

Proyek baru selesai hanya jika:

- Checklist wajib fase 0–7 selesai atau memiliki keputusan tertulis.
- SSO Authorization Code + PKCE aman dan pembatalan login tertangani.
- Profil dapat dibuat, disimpan, diubah, dan ditampilkan.
- Data sensitif terenkripsi dan tidak bocor ke log.
- Organisasi berasal dari Laci dan terfilter sesuai kepemilikan.
- Submit server-to-server tidak membocorkan API key.
- Periode aktif ditentukan Laci.
- ID anggota/periode Laci tersimpan.
- Status kembali lewat webhook idempotent.
- Riwayat periode lama tidak hilang.
- Isolasi data organisasi lolos UAT.
- Semua test, production build, security gate, migration, dan backup/restore lulus.
- Accessibility, responsive layout, monitoring, dokumentasi, dan runbook diverifikasi.
- Staging end-to-end dan production smoke test lulus.

## 20. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kontrak API Laci berubah | Sinkronisasi gagal | OpenAPI, versioning, contract test |
| Submit berulang | Anggota duplikat | Idempotency key dan unique constraint |
| Webhook hilang | Status tidak sinkron | Retry, event log, reconciliation |
| Periode berubah saat form terbuka | Periode hasil berbeda | Refresh sebelum submit dan tampilkan hasil Laci |
| API key bocor | Integrasi disalahgunakan | Secret manager, rotasi, audit |
| Data pribadi bocor | Risiko privasi tinggi | Encryption, redaction, least privilege |
| SSO unavailable | Pengguna tidak dapat login | Error state, retry terbatas, monitoring |
| Salah memilih organisasi | Data masuk target salah | Review sebelum submit |

## 21. Keputusan sebelum eksekusi

- Domain frontend/backend staging dan production.
- SSO client ID/secret khusus Sistem Anggota.
- Redirect URI yang didaftarkan.
- API key Laci khusus Sistem Anggota.
- Webhook secret dan callback URL.
- Logo/aset resmi dan persetujuan palet.
- Kebijakan data pribadi dan retensi.
- PIC Sistem Anggota, Laci, SSO, dan infrastruktur.

Dokumen ini adalah sumber rencana utama untuk membangun Sistem Anggota pada repository terpisah. Perubahan kontrak Sistem Anggota–Laci harus dicatat di OpenAPI kedua sistem sebelum implementasi diubah.
