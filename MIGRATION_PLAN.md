# Migration Plan: Next.js Frontend + Go Backend + Existing SSO

Status dokumen: migrasi arsitektur selesai dan terverifikasi lokal; deployment/observation production menunggu jadwal rilis  
Tanggal audit: 20 Agustus 2026  
Baseline repository: commit `cfca79a` (`main`)  
Prinsip: implementasi Next.js yang berjalan adalah source of truth. Temuan inkonsistensi dicatat untuk diuji, bukan diperbaiki diam-diam.

## 1. Ringkasan Eksekutif

Aplikasi saat ini adalah monolit Next.js 15 App Router. UI React, Server Components, server actions, REST route handlers, autentikasi, business logic, akses PostgreSQL, enkripsi, penyimpanan file, email, logging, realtime, dan backup berada dalam satu proses/repository.

Hal paling penting dari audit:

- SSO sebenarnya sudah digunakan. Login memakai OIDC discovery melalui Better Auth dengan provider `sso-ipnu`, authorization-code flow, PKCE, dan scope `openid profile email`.
- Session web masih dikelola Better Auth melalui tabel aplikasi `Session` dan cookie `ipnu-laci.*`. Go belum menerima atau memvalidasi access token SSO secara langsung.
- Identitas SSO saat ini dipetakan melalui `Account(providerId, accountId, userId)` dan auto-link berdasarkan email. Belum ada kolom `ssoUserId` pada `User`.
- `User` tetap merupakan application user dan memegang `role`, `isActive`, `periodeAktifId`, serta seluruh relasi domain. Tabel ini tidak boleh dihapus ketika auth dipindahkan.
- UI utama memakai server actions, sedangkan `/api/*` adalah jalur paralel untuk mobile/integrasi/Swagger. Keduanya memiliki beberapa perbedaan authorization, validasi, response, email, file cleanup, dan scope periode.
- Data teks sensitif dan file memakai format kriptografi existing yang harus tetap kompatibel: AES-256-CBC, key hasil `scrypt`, salt tetap, IV per nilai; file dikompresi gzip sebelum dienkripsi. Mengganti format akan membuat data existing tidak terbaca.
- File disimpan di Cloudflare R2. Path legacy `/storage`/`/uploads` dipertahankan tetapi umumnya tidak dapat dibaca pada deployment cloud.
- Hampir semua mutasi Prisma memicu invalidasi tag dan PostgreSQL `NOTIFY`; banyak mutasi juga membuat activity log dan notifikasi eksplisit sehingga event dapat duplikat.
- Belum ada automated test suite atau script `test`. Baseline type-check gagal pada `src/app/sitemap.ts`; lint penuh ikut memeriksa `.next` dan gagal, sedangkan lint `src prisma scripts` hanya gagal pada lima error di script CommonJS.
- Migration history pernah melakukan drop/recreate tabel `Kegiatan` dan `PengajuanPAC` menjadi `AgendaKegiatan` dan `PengajuanBerkas`. Data/schema production harus diinspeksi langsung sebelum migration Go apa pun.

Keputusan tersebut telah dipenuhi: pemilik menyetujui plan. Hasil akhir memakai Go sebagai OIDC client dan pemilik session; Next.js hanya UI/API client serta satu redirect callback tipis tanpa secret.

## 2. Baseline Architecture Sebelum Migrasi

```text
Browser / Mobile / External System
  |
  +-- Next.js pages + client components
  |     +-- Server Components -> Server Actions -> Prisma
  |     +-- Client -> /api/* Route Handlers -> Prisma
  |     +-- EventSource /api/realtime
  |
  +-- Existing SSO (OIDC)
        -> Better Auth callback /api/auth/*
        -> User + Account + Session PostgreSQL

Next.js process
  +-- Authentication/session/route protection
  +-- Authorization and period scoping
  +-- Business logic and validation
  +-- Prisma -> PostgreSQL
  +-- AES encryption/decryption
  +-- Cloudflare R2 file storage
  +-- Nodemailer/SMTP + LogEmail
  +-- PostgreSQL LISTEN/NOTIFY -> SSE
  +-- pg_dump + gzip -> R2 backup

External dependencies
  +-- SSO OIDC discovery/authorization/token service
  +-- PostgreSQL
  +-- Cloudflare R2 (S3-compatible)
  +-- SMTP server
  +-- freeipapi.com (IP geolocation)
  +-- BigDataCloud + OpenStreetMap Nominatim (browser reverse geocoding)
  +-- api-hari-libur.vercel.app (PHBI/libur nasional)
```

### Struktur repository relevan

- `src/app/(sistem)`: landing page, static legal/help pages, dashboard pages.
- `src/app/actions`: seluruh server action UI.
- `src/app/api`: route handlers untuk Better Auth, mobile/integrasi, file, SSE, cron, dan Swagger.
- `src/components/features`: UI per domain.
- `src/lib`: auth, Prisma extension, encryption, R2, email, realtime, logging, JWT, location.
- `prisma/schema.prisma`: 19 model dan 12 enum.
- `prisma/migrations`: lima migration SQL; migration terakhir sinkronisasi besar dan bersifat destruktif terhadap nama tabel lama.
- `scripts`: diagnostic scripts dan cron backup CLI.
- `docs/API_SPEC.md`, `README.md`, `docs/SECURITY_AUTH.md`: dokumentasi sebagian sudah stale dan tidak boleh dijadikan source of truth tanpa mencocokkan kode.

### Environment variable

`DATABASE_URL`, `DIRECT_URL`, `API_KEY`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_URL_INTERNAL` (dipakai kode tetapi tidak terlihat pada `.env`), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SSO_URL` (dipakai kode tetapi tidak terlihat pada `.env`), `SSO_ISSUER`, `SSO_CLIENT_ID`, `SSO_CLIENT_SECRET`, legacy `AUTH_SECRET`/`NEXTAUTH_URL`, `ENCRYPTION_KEY`, SMTP variables, `ADMIN_NOTIFICATION_EMAIL`, R2 variables, `CRON_SECRET`, dan `SEEDING`.

## 3. Baseline Authentication dan Authorization Sebelum Migrasi

### Flow login web

1. Landing page meminta izin geolocation. Login ditolak di client bila cookie `user_lat` dan `user_lng` tidak tersedia.
2. Client memanggil `authClient.signIn.oauth2({ providerId: "sso-ipnu" })`.
3. Better Auth membaca `${SSO_ISSUER}/.well-known/openid-configuration`, memakai client ID/secret, PKCE, prompt consent, scope `openid profile email`, dan nonce statis.
4. Callback Better Auth ditangani `GET/POST /api/auth/[...all]`.
5. `Account` di-auto-link jika email SSO cocok; provider trusted adalah `sso-ipnu`.
6. Hook create user menetapkan `emailVerified=true` dan `isActive=true` kecuali `SEEDING=true`.
7. Better Auth membuat `Session`; cookie memakai prefix `ipnu-laci`, secure cookie, masa session 6 jam, update 1 jam, cookie cache 5 menit.
8. Hook session membuat log LOGIN secara fire-and-forget. Logout membuat log LOGOUT dan mengisi `User.lastLogoutAt`.
9. `src/proxy.ts` melindungi `/dashboard/*`, mengambil session lewat `/api/auth/get-session`, mengalihkan akun tidak aktif, dan mengalihkan user login dari `/` ke `/dashboard`.
10. Dashboard layout kembali mengecek session, keberadaan `User`, `isActive`, dan membatasi user `emailVerified=false` hanya ke dashboard root/profile.

### Auth API/mobile yang masih hidup

- Mayoritas REST lama mewajibkan `x-api-key` **dan** cookie Better Auth atau internal bearer JWT.
- JWT internal ditandatangani HS256 memakai `AUTH_SECRET`, berlaku 24 jam, lalu diverifikasi terhadap `User.lastLogoutAt`.
- Tidak ditemukan caller untuk `createToken()` JWT di repository; jalur bearer kemungkinan untuk klien eksternal/legacy.
- `API_KEY` memiliki fallback hard-coded `laci-digital-secret-key-2026`; ini harus dianggap behavior sekaligus security risk, bukan dibawa ke Go tanpa keputusan eksplisit.
- Image routes, public stats/kegiatan/wilayah/PHBI, Swagger docs, dan SSE tidak memerlukan session. Endpoint anggota public dan absensi public hanya memakai API key.

### Authorization matrix efektif UI

| Area | Cabang | PAC | Catatan aktual |
|---|---:|---:|---|
| Dashboard/profile/periode/log pribadi | Ya | Ya | Fitur selain dashboard/profile disembunyikan untuk email belum verified. |
| Pengajuan | Review semua + status/delete | Buat/edit pending/delete milik sendiri | PAC juga dapat melihat referensi semua pengajuan pada periode Cabang aktif. |
| Anggota | Monitor/filter/verifikasi | Monitor/verifikasi data scope sendiri | Server action detail/delete/verify kurang konsisten dalam ownership check. |
| Wilayah Ranting/PK | Monitor lintas PAC | CRUD/copy scope sendiri | Cabang dapat melihat lintas PAC berdasarkan nama periode. |
| Agenda | CRUD | Tidak ditampilkan | Create action memeriksa Cabang; update/delete hanya ownership. |
| Arsip | CRUD milik sendiri | CRUD milik sendiri | Selalu scoped user + periode. |
| Berkas Pimpinan | CRUD milik sendiri | CRUD milik sendiri | Nama UI berubah: Berkas Cabang/PAC. |
| Berkas SP | CRUD | Tidak ditampilkan | Create memeriksa Cabang; sebagian API/actions mutasi hanya ownership. |
| Presensi | CRUD milik sendiri | CRUD milik sendiri via UI/actions | REST POST justru Cabang-only; ini contract drift. Form peserta publik. |
| User/email log/backup | Ya | Tidak | Cabang-only. |

### Bagian auth yang diganti oleh SSO/Go

- Redirect login, callback authorization code, token refresh/logout identity sesuai contract SSO.
- Validasi access token pada Go (issuer, audience, signature/JWKS, expiry, subject).
- Session/token bridging Next.js -> Go.
- Better Auth `Session`, `Verification`, dan credential password hanya boleh dihentikan setelah semua client memakai SSO contract baru.
- Internal JWT HS256 dan reset password credential adalah kandidat legacy removal, tetapi baru setelah pengguna mobile/integrasi dikonfirmasi.
- Email verification lokal tidak perlu menjadi authentication kedua. Field compatibility dapat dipertahankan sementara.

### Application user yang tetap

`User.id`, `name`, `email`, `image`, `role`, `isActive`, `periodeAktifId`, `lastLogoutAt` (jika masih dipakai revoke/audit), timestamps, dan seluruh relasi domain tetap berada di PostgreSQL aplikasi. `Account(providerId="sso-ipnu", accountId=<subject>)` saat ini merupakan mapping identity. Jangan menambah `ssoUserId` sampai dipastikan apakah `Account.accountId` stabil dan unik terhadap issuer.

### Informasi SSO yang masih dibutuhkan sebelum implementasi

- Contoh access token dan daftar claim tanpa secret; terutama `iss`, `sub`, `aud`, email, email verification, role bila ada.
- Apakah access token berupa JWT yang bisa diverifikasi lokal atau opaque yang perlu introspection.
- JWKS URI, audience/resource Go API, clock-skew policy, masa token, refresh-token rotation, revoke/introspection endpoint.
- Logout: hanya session aplikasi, RP-initiated logout SSO, atau keduanya.
- Apakah Next.js menjadi OIDC client/BFF atau browser mengirim access token langsung ke Go.
- Mapping identity ketika email berubah dan kebijakan account linking.
- Daftar client existing yang masih memakai API key + JWT internal.

## 4. Database Audit

### Model dan operasi

| Model | Pemakaian utama | Operasi penting |
|---|---|---|
| `User` | application user, role/status/profile | Better Auth create; list/count/detail; update status/profile/lastLogout; cascade delete. |
| `Periode` | scope data per user | CRUD; hanya satu aktif secara business rule; aktivasi memakai updateMany + update + update User, belum transaction. |
| `Wilayah` | Ranting/PK per PAC/periode | list/filter, CRUD, copy transaction; relasi opsional Anggota. |
| `Anggota` | data anggota terenkripsi + verifikasi | list/decrypt/filter/sort, create via APIs, update, verify, delete; relations Pendidikan/Perkaderan. |
| `Pendidikan` | riwayat pendidikan anggota | nested create/deleteMany, groupBy statistik. |
| `Perkaderan` | riwayat kaderisasi terenkripsi | nested create/deleteMany, query/decrypt/statistik. |
| `AgendaKegiatan` | agenda Cabang terenkripsi | CRUD, status waktu dinamis, public aggregation. |
| `ArsipSurat` | surat masuk/keluar terenkripsi | CRUD, stats, bulk createMany, encrypted attachment. |
| `BerkasPimpinan` | dokumen pimpinan terenkripsi | CRUD, monthly stats, bulk createMany, required file pada create UI. |
| `BerkasSP` | SP Cabang terenkripsi | CRUD, stats, bulk createMany, attachment opsional. |
| `PengajuanBerkas` | workflow PAC -> Cabang | create pending, edit pending, approve/reject, delete, stats, email, file. |
| `Presensi` | event presensi | CRUD, open/closed calculation, status manual, cascade participant delete. |
| `PresensiData` | peserta terenkripsi | public create, unique `(presensiId,emailHash)` dan `(presensiId,noHpHash)`, decrypt detail/export. |
| `LogActivity` | audit per user/periode | async create/createMany, personal/global list/stats/monitoring. |
| `LogEmail` | outbox-like send history | PENDING -> SENT/FAILED, retry increment, metadata JSON string. |
| `Account`, `Session`, `Verification` | Better Auth | OIDC mapping/token/session/verification. |
| `AllowedOrigin` | seed-only domain list | upsert saat seed; tidak digunakan runtime untuk CORS. |

### Constraint dan compatibility yang wajib dipertahankan

- Semua primary key adalah string/CUID existing.
- Unique: `User.email`, `Periode(nama,userId)`, `Account(providerId,accountId)`, `Session.token`, `Verification(identifier,value)`, participant email/noHp hash per event, `AllowedOrigin.domain`.
- Hampir semua relasi domain memakai `ON DELETE CASCADE`; `Anggota.wilayahId` memakai `SET NULL`.
- Enum existing termasuk `CBP_KPP`, `IMPORT`, `PRESENSI`, `WILAYAH`; dokumentasi lama tidak selalu mencantumkannya.
- Tidak ada foreign key dari `User.periodeAktifId` ke `Periode`; konsistensinya dijaga business logic.
- Aktivasi periode dan beberapa file+DB operation belum atomic. Go harus meniru output existing dahulu, lalu hardening hanya melalui perubahan contract yang disetujui.

### Enkripsi existing

- Text: `AES-256-CBC`, random IV 16 byte, output `ivHex:cipherHex`.
- Key: `scryptSync(ENCRYPTION_KEY, "laci-ipnu-ippnu-salt-2025", 32)`.
- Decrypt text melakukan fallback plaintext bila format bukan encrypted lama.
- File: gzip -> AES-256-CBC -> prefix raw IV; ekstensi asli disimpan dalam key `<timestamp>-<random>-<ext>.enc`.
- Hash dedup presensi: SHA-256 atas lowercase+trim.
- Download token: encrypted `id:expiry`, berlaku 5 menit dan memakai key enkripsi yang sama.

Implementasi Go wajib memiliki golden-vector test lintas Node/Go sebelum membaca atau menulis data production.

## 5. Feature Inventory, Dependency, dan Side Effect

| Fitur | UI utama | Tabel/dependency | Rule inti dan side effect |
|---|---|---|---|
| Landing/public stats | `/` | Anggota, Pengajuan, Periode | Hitung berdasarkan nama periode Cabang aktif; tanpa auth. |
| Auth/session | `/`, dashboard layout, sidebar | User, Account, Session, LogActivity | OIDC SSO, geolocation cookie, active/verified gate, login/logout log. |
| Profile | `/dashboard/profile` | User, Account, R2 | Zod name/email/password; image max 2MB; email change unlinks non-credential account dan memicu verification legacy. |
| Periode/view periode | `/dashboard/periode` | User, Periode, semua domain | Periode pertama autoaktif; active tidak dapat dihapus; cookie view 30 hari memengaruhi read, active period memengaruhi write. |
| User management | `/dashboard/manajemen-user` | User + semua cascade relations | Cabang-only; list PAC, stats, toggle active, delete cascade, legacy password reset. |
| Wilayah | `/dashboard/wilayah/ranting|pk` | Wilayah, Periode, User, Anggota | PAC scope sendiri; Cabang lintas PAC dengan penyamaan nama periode; copy memakai transaction. Activity log. |
| Anggota | `/dashboard/anggota` | Anggota, Pendidikan, Perkaderan, Wilayah, User, Periode, R2 | Encrypted PII, external submit -> PENDING, approve/reject, photo, in-memory search/sort. Activity log/realtime. |
| Agenda | `/dashboard/agenda-kegiatan` | AgendaKegiatan, Periode, User, PHBI | Cabang UI; encrypted title/description/location; dynamic status. Activity log; public PHBI merge. |
| Arsip Surat | `/dashboard/arsip/surat` | ArsipSurat, Periode, R2 | Text/file encrypted; max 2MB; CRUD, stats, Excel import/export, preview/download. Log + realtime/cache. |
| Berkas Pimpinan | `/dashboard/berkas-pimpinan` | BerkasPimpinan, Periode, R2 | Both roles own data; create requires file <=5MB; import tanpa file; monthly stats. Log + realtime. |
| Berkas SP | `/dashboard/berkas-sp` | BerkasSP, Periode, R2 | Cabang UI; organisation/date range; file optional <=2MB; import. Log + realtime. |
| Pengajuan | `/dashboard/pengajuan-berkas`, referensi | PengajuanBerkas, PAC/Cabang Periode, User, R2, Email | PAC create PENDING with required file; edit only pending; Cabang approve/reject; email user/admin/status; log/realtime. |
| Presensi | dashboard + `/presensi/:id` | Presensi, PresensiData, Periode | Public form validation/dedup; time-window open; manual close/auto; QR/display/export; realtime. |
| Dashboard | `/dashboard` | Hampir semua tabel | Role-specific stats, 6-month trend, leaderboard, global active-period counts. |
| Activity log | `/dashboard/log-activity` | LogActivity, User, Periode | Personal/global filters, stats, 7-day monitoring, IP/GPS/browser/device/location, realtime. |
| Email log | `/dashboard/log-email` | LogEmail, User | Cabang-only; stats/list/retry; send state transitions and realtime. |
| Backup | `/dashboard/backup`, cron | PostgreSQL, R2, User/Log | `pg_dump | gzip`, max 10 backups, signed URL 10 menit, Cabang/CRON_SECRET. |
| Realtime | global provider | PostgreSQL NOTIFY, SSE, Prisma extension | One LISTEN connection/process; in-memory fan-out, heartbeat 20 detik, reconnect. Endpoint saat ini tanpa auth. |
| Public/integration API | `/api/public/*`, anggota public, kegiatan/wilayah | Banyak tabel + API key/CORS | Bot sync dapat menerima seluruh decrypted data; anggota external; public stats/calendar. |
| Static/help/API docs | FAQ, privacy, terms, `/api-docs` | none/Swagger | UI informational; Swagger generated dari annotations route. |

### Dependency graph migrasi

```text
SSO contract -> current identity -> application User/role/isActive
                                -> Periode aktif + view periode
                                      |
                +---------------------+--------------------+
                |                     |                    |
             Wilayah               Base domains        Logging context
                |          (arsip/berkas/agenda/etc.)      |
              Anggota                 |                 Realtime
                |                  Pengajuan -> Email       |
                +---------------- Dashboard/Stats ----------+

Encryption + R2 -> semua domain file + profile + email attachment
PostgreSQL + R2 + command runtime -> Backup/Cron
```

## 6. Behavioral Contracts

Contract di bawah adalah baseline UI/server-action. REST lama dicatat terpisah karena tidak selalu identik.

### Auth dan current user

- Input: browser geolocation granted, OIDC redirect/callback dari SSO.
- Validation: Better Auth memvalidasi OIDC; dashboard mensyaratkan session, User ada, `isActive=true`; selain dashboard/profile juga `emailVerified=true`.
- DB: auto-create/link `User` dan `Account`; create/delete `Session`; update `lastLogoutAt`.
- Side effects: LOGIN/LOGOUT activity log; IP/GPS/browser/device/location; redirect dan toast query string.
- Error: inactive, unregistered/auth error, expired session.
- SSO target: Go hanya mempercayai token/identity dari SSO; role/status/periode dibaca dari application User.

### Periode

- Input: `nama`; activate/delete/update by period ID; selected-view ID/null.
- Validation: authenticated; ownership; duplicate `(nama,userId)`; active period cannot be deleted.
- DB: first period autoactive dan `User.periodeAktifId` diisi; activation menonaktifkan semua lalu mengaktifkan target.
- Read scope: `view_periode_id` bila ada, fallback active period. Write scope selalu active period.
- Side effects: clear/set view cookie, cache revalidation, activity log.
- Response: server actions memakai `{success: string, data?}` atau `{error: string}`.

### User management/profile

- List/stats/toggle/delete/reset hanya Cabang; detail dapat Cabang atau user sendiri.
- Profile validates name 2..100 dengan whitelist, valid lowercase email <=255, optional password 6..128, image <=2MB.
- Profile image dienkripsi dan di-upload ke `profile/`; image lama R2 dihapus setelah upload baru.
- Email change harus unik; existing code menandai unverified, menghapus account non-credential, dan mencoba kirim verification.
- Delete user cascade menghapus data relational di DB tetapi tidak membersihkan seluruh object R2 terkait.
- SSO target: password reset dan verification lokal tidak dipindahkan kecuali client legacy terbukti membutuhkan.

### Wilayah

- Input: jenis `RANTING|PK`, nama wajib, ketua/kontak/alamat opsional.
- PAC read/write milik sendiri dalam target/active period. Cabang read dapat lintas user dan mencocokkan nama periode.
- Update/delete mewajibkan owner; copy mengambil ID sumber lalu membuat salinan ke active period user saat ini dalam transaction.
- Side effects: activity log dan UI revalidation.
- Risk parity: copy tidak memverifikasi ownership source sebelum membaca; jangan memperluas behavior tanpa approval.

### Anggota

- External create memerlukan API key, `pacId`, nama, gender; period PAC aktif wajib; status selalu PENDING.
- Authenticated API create memerlukan active period dan nama/gender; photo opsional; nested Perkaderan. UI tidak memiliki create form internal.
- PII text dienkripsi; email dan beberapa categorical field tetap plaintext; photo terenkripsi di R2.
- Read mendekripsi dan melakukan search/sort memory pada batas 3.000 baris; Cabang melakukan cross-PAC period-name matching.
- Verify mengubah `PENDING|...` ke DITERIMA/DITOLAK dan menyimpan alasan bila ditolak.
- Delete menghapus photo R2 best-effort lalu row (cascade Pendidikan/Perkaderan).
- Side effects: log/realtime; tidak ada email verifikasi anggota.
- Risk parity: server-action detail/delete/verify tidak selalu memeriksa ownership/role; REST detail GET juga dapat membaca ID apa pun setelah auth+API key.

### Agenda

- Cabang create: judul, warna, tanggal mulai wajib; optional deskripsi/lokasi/tanggal selesai; fields text encrypted.
- Update/delete scoped owner tetapi action tidak mengulang role check; UI pages Cabang-only.
- Status: MENDATANG, BERLANGSUNG sampai end date/end-of-day, lalu SELESAI.
- Search/sort encrypted fields dilakukan in-memory, maksimum 2.000.
- Public endpoints dapat menggabungkan seluruh agenda dengan PHBI tahun kini+berikutnya.
- Side effects: activity log, Prisma realtime/cache.

### Arsip Surat

- Active period required. Organisation required pada form (`IPNU|IPPNU|BERSAMA|CBP_KPP`), jenis `MASUK|KELUAR`, perihal required; current action tidak secara eksplisit memvalidasi semua field lain.
- File optional <=2MB, gzip+encrypted, R2 key `arsip/`.
- Update/delete owner-only; replacement/deletion R2 best-effort; DB and object storage are not transactional.
- Import accepts ISO, DD/MM/YYYY, atau tanggal Indonesia; required columns; invalid organisation becomes null; createMany valid rows.
- Search encrypted fields max 2.000; stats by jenis/organisation.
- Download decrypts and sets inline/attachment filename from number; legacy local file fails.
- Side effects: activity/import/export logs, cache/realtime.

### Berkas Pimpinan

- Active period; nama/tanggal/file required on create; max file 5MB. Update does not require replacement file.
- Encrypted nama/catatan/file; owner-only CRUD/download; import nama+tanggal without file.
- Stats total/current calendar month.
- Side effects: activity/import/export log, R2, cache/realtime.

### Berkas SP

- Cabang-only create in server action; active period; organisation/nama required; date range parsed; file optional <=2MB.
- Owner-only list/detail/update/delete; UI Cabang-only. Import has no explicit role check and defaults invalid/missing organisation to IPNU.
- Search encrypted fields max 2.000; status sorting maps to `tanggalBerakhir`; stats total/IPNU/IPPNU.
- Side effects: activity/import/export log, R2, cache/realtime.

### Pengajuan Berkas

- PAC-only create; PAC active period and one active Cabang period required.
- Required noSurat, penerima, keperluan, file <=2MB; status initial PENDING; text/file encrypted.
- Owner PAC may edit only while PENDING. Cabang may approve/reject; reject requires reason. Both Cabang and owner PAC may delete.
- Cabang lists submissions by its target period; PAC own list uses PAC target period; PAC reference view uses globally found active Cabang period.
- Side effects on create: upload file, create DB row, log, send email to submitter and configured admin with decrypted attachment. Status change logs and emails submitter. Email is background/best-effort.
- Email logs transition PENDING -> SENT/FAILED and emit realtime.
- Download permits owner or Cabang; temporary token intended 5 minutes.
- Risk parity: first active Cabang period is selected without uniqueness guarantee; status transition is not restricted from terminal to another terminal; REST PATCH omits reject-reason validation/email and accepts arbitrary status cast.

### Presensi

- Event fields all required; active period required; server action permits either role, REST POST permits Cabang only.
- Public open rule actually implemented: `isActive` must be true, event date must be today, current local server minutes between start/end inclusive. `isForcedOpen/forcedOpenAt` are not used in the open calculation.
- Public form server action validates name 3..100, valid normalized email, numeric phone 10..15, organisation required. REST public endpoint only checks presence and does not apply equal Zod validation.
- Participant name/email/phone encrypted; normalized hashes enforce duplicate email/phone per event.
- Status action supports only AUTO (active true) and MANUAL_CLOSE (active false); forced-open mode described in README is absent.
- Detail/participant server actions do not authenticate; public page depends on this behavior.
- Side effects: participant/event realtime; event activity logs are incorrectly recorded under `AGENDA_KEGIATAN` by server actions, while API uses `PRESENSI`.

### Dashboard/log/realtime/email/backup

- Dashboard aggregates current target period personal stats; Cabang monitoring uses all users' active periods, leaderboard, training/education aggregation, and pending user count.
- Activity log is non-blocking/best-effort. If user has no active period, log is silently skipped. AUTH duplicate window is 3 seconds.
- Location priority: GPS cookies/address, else IP lookup with 3-second timeout.
- Prisma extension emits cache invalidation + PG notify after every model mutation. Explicit domain notifications may duplicate.
- SSE `/api/realtime` is unauthenticated, holds in-memory listeners, heartbeat 20 seconds, and relies on one PostgreSQL LISTEN connection per process.
- Email retry rebuilds body from metadata, increments retry count, and updates original log. Current metadata often lacks submission ID/user fields, so retry detail URLs/content can differ.
- Backup Cabang/manual or `CRON_SECRET`; `pg_dump | gzip` temp file, upload R2, retain max 10, signed download 10 minutes, activity log under module USER.

## 7. Inventaris Seluruh Server Action

| File | Exported action dan fungsi |
|---|---|
| `periode-actions.ts` | `createPeriode`, `activatePeriode`, `deletePeriode`, `getPeriode`, `getPeriodes`, `updatePeriode` |
| `view-periode-actions.ts` | `setViewPeriode` |
| `wilayah-actions.ts` | `getWilayahList`, `createWilayah`, `updateWilayah`, `deleteWilayah`, `copyWilayahToCurrentPeriode` |
| `anggota-actions.ts` | `getAnggotaList`, `getActiveUsers`, `getAnggotaById`, `deleteAnggota`, `verifikasiAnggota`, `getAnggotaStats` |
| `agenda-kegiatan-actions.ts` | `getAgendaKegiatanList`, `getKegiatanById`, `createKegiatan`, `updateKegiatan`, `deleteKegiatan`, `getAgendaKegiatanStats` |
| `arsip-actions.ts` | `getArsipSurats`, `getArsipStats`, `getArsipSuratById`, `createArsipSurat`, `updateArsipSurat`, `deleteArsipSurat`, `downloadArsipFile`, `bulkImportArsipSurat`, `getArsipDownloadToken` |
| `berkas-pimpinan-actions.ts` | `getBerkasPimpinans`, `getBerkasPimpinanById`, `createBerkasPimpinan`, `updateBerkasPimpinan`, `deleteBerkasPimpinan`, `downloadBerkasPimpinanFile`, `bulkImportBerkasPimpinan`, `getBerkasPimpinanStats`, `getBerkasPimpinanDownloadToken` |
| `berkas-sp-actions.ts` | `getBerkasSPs`, `getBerkasSPStats`, `getBerkasSPById`, `createBerkasSP`, `updateBerkasSP`, `deleteBerkasSP`, `downloadBerkasSPFile`, `bulkImportBerkasSP`, `getBerkasSPDownloadToken` |
| `pengajuan-berkas-actions.ts` | `getActivePacUsers`, `getActivePacUsersForReferensi`, `getPengajuanBerkass`, `getVerifikasiPengajuanForCabang`, `getPengajuanForReferensiPac`, `getPengajuanBerkasStatsForReferensi`, `getPengajuanBerkasDetailForReferensi`, `getPengajuanBerkasById`, `getPengajuanBerkasDetail`, `createPengajuanBerkas`, `updatePengajuanBerkas`, `deletePengajuanBerkas`, `updateStatusPengajuan`, `getPengajuanBerkasStats`, `downloadPengajuanFile`, `getPengajuanDownloadToken` |
| `presensi-actions.ts` | `getPresensiList`, `getPresensiDetail`, `createPresensi`, `isPresensiOpen`, `updatePresensi`, `submitPresensiData`, `deletePresensi`, `updatePresensiStatus`, `getParticipantDetail` |
| `dashboard-actions.ts` | `getDashboardStats`, `getPublicStats` |
| `auth-actions.ts` | deprecated `verifyOTP`; `resendVerificationAction`, `checkEmailVerificationStatus`, `sendVerifiedSuccessEmailAction`, `getPACUsers`, `getUserStats`, `getUserDetail`, `toggleUserStatus`, `deleteUser`, legacy `resetUserPassword`, `updateProfile` |
| `email-verification-actions.ts` | tiga deprecated no-op: `sendEmailVerification`, `verifyEmail`, `updateUserEmail` |
| `log-activity-actions.ts` | `getPersonalLogs`, `getLogStats`, `getGlobalLogStats`, `getLogMonitoringData`, `getGlobalLogs`, `getLogActivityById`, `logExport`, `logImport` |
| `log-email-actions.ts` | `getEmailStats`, `getEmailLogs`, `retryEmail`, `resendVerificationOTP` |
| `backup-actions.ts` | `getBackupListInternal`, `getBackupList`, `executeBackupLogic`, `createDatabaseBackup`, `deleteDatabaseBackup`, `getBackupDownloadUrl` |

## 8. Inventaris Seluruh API Route Existing

`API key + auth` berarti request saat ini membutuhkan `x-api-key` serta cookie Better Auth atau bearer JWT internal, kecuali implementasi route menyebut cookie-only.

| Method dan route | Security existing | Behavior ringkas |
|---|---|---|
| `GET/POST /api/auth/[...all]` | Better Auth/OIDC | Discovery redirect, callback, session, signout dan endpoint Better Auth lain. |
| `GET /api/auth/error` | Public | Map error auth ke query error landing page. |
| `GET/PATCH /api/me` | API key + auth | Read/update profile; PATCH behavior berbeda dari server action dan masih mendukung password credential. |
| `GET /api/manajemen-user` | API key + cookie, Cabang | List seluruh user (bukan hanya PAC pada action). |
| `PATCH/DELETE /api/manajemen-user/:id` | API key + cookie, Cabang | Toggle active/delete. |
| `GET /api/manajemen-user/:id/image` | Public | Redirect external image atau decrypt R2/base64. |
| `GET/POST /api/periode` | API key + auth | List/create own periods; first autoactive. |
| `PATCH/DELETE /api/periode/:id` | API key + cookie | Rename/activate/delete owner period. |
| `GET/OPTIONS /api/wilayah` | Public CORS | List all wilayah; optional `jenis`, `pacId`; tidak memfilter active period. |
| `GET/POST /api/anggota` | API key + auth | List/create members; Cabang list logic berbeda dari action. |
| `GET/PATCH/DELETE /api/anggota/:id` | API key + auth | GET tidak ownership-scoped; PATCH/DELETE owner only. |
| `GET /api/anggota/:id/image` | Public | Decrypt photo R2, immutable cache. |
| `GET /api/anggota/stats` | API key + cookie | Stats active period. |
| `POST /api/anggota/public` | API key only | External registration to PAC active period as PENDING. |
| `GET/POST /api/agenda-kegiatan` | GET API key; POST API key + auth Cabang | GET all active-period events; POST Cabang event. |
| `GET/PATCH/DELETE /api/agenda-kegiatan/:id` | API key + auth | GET any event; mutations owner-scoped. |
| `GET/OPTIONS /api/kegiatan` | Public CORS | All local agenda + PHBI current/next year. |
| `GET/POST /api/arsip` | API key + auth | List/create owner active-period archive. |
| `GET/PATCH/DELETE /api/arsip/:id` | API key + auth | GET any ID; mutations owner-scoped. |
| `GET /api/arsip/stats` | API key + cookie | Owner active-period counts. |
| `GET /api/arsip/download/:id` | Cookie atau intended 5-min token | Inline/attachment decrypted file; token-only path saat ini masih memanggil session-bound actions. |
| `GET/POST /api/berkas-pimpinan` | API key + auth | List/create owner active-period data. |
| `GET/PATCH/DELETE /api/berkas-pimpinan/:id` | API key + auth | GET any ID; mutations owner-scoped. |
| `GET /api/berkas-pimpinan/download/:id` | Cookie atau intended token | Decrypted file; token-only compatibility issue sama. |
| `GET/POST /api/berkas-sp` | API key + auth | List/create owner; POST tidak mengulang Cabang role. |
| `GET/PATCH/DELETE /api/berkas-sp/:id` | API key + auth | GET any ID; mutations owner-scoped. |
| `GET /api/berkas-sp/stats` | API key + cookie | Active-period stats. |
| `GET /api/berkas-sp/download/:id` | Cabang cookie atau intended token | Decrypted file; token-only compatibility issue sama. |
| `GET/POST /api/pengajuan-berkas` | API key + auth | Modes `me/cabang/referensi`; create tidak role-check dan tidak mengirim email. |
| `GET/PATCH/DELETE /api/pengajuan-berkas/:id` | API key + auth | GET any ID; PATCH Cabang status; DELETE Cabang/owner. |
| `GET /api/pengajuan-berkas/stats` | API key + cookie | Role-specific active-period stats. |
| `GET /api/pengajuan-berkas/download/:id` | Owner/Cabang cookie atau token | Decrypted file; token path masih terikat action session. |
| `GET/POST /api/presensi` | API key + auth; POST Cabang | List own all periods/status; create Cabang. |
| `GET/PATCH/DELETE /api/presensi/:id` | API key + auth | Owner detail/update/delete. |
| `POST /api/presensi/:id/absensi` | API key only | Public attendance, presence validation lebih longgar dari UI action. |
| `GET /api/dashboard/stats` | API key + auth | Stats API; Cabang raw SQL masih menunjuk tabel legacy `Kegiatan`/`PengajuanPAC`. |
| `GET /api/logs` | API key + auth | Personal/global activity list. |
| `GET /api/public/data` | API key only | Dump lintas domain berisi data decrypted dan user data; sensitivity sangat tinggi. |
| `GET/OPTIONS /api/public/stats` | Public CORS | Global counts, PAC distribution, upcoming events. |
| `GET/OPTIONS /api/public/phbi` | Public CORS | Proxy/cache holiday API 24 jam. |
| `GET /api/realtime` | Public | SSE seluruh notification payload. |
| `GET /api/cron/backup` | Bearer `CRON_SECRET` | Trigger backup. |
| `GET /api/docs` | Public | OpenAPI JSON. |
| `GET /api-docs` | Public page | Swagger UI. |

## 9. Backend Logic yang Harus Keluar dari Next.js

Semua item berikut adalah backend/business logic, bukan tanggung jawab frontend target:

- SSO token verification, identity-to-user mapping, active account check, role/permission policies.
- Active-period lookup, view-period authorization, cross-PAC matching by period name.
- Semua Prisma query, raw SQL, transaction, cascade expectation, pagination, filtering, sorting, aggregation.
- Enkripsi/dekripsi text/file, hashing dedup, token download, MIME/filename handling.
- R2 upload/download/delete/signed URL dan cleanup policy.
- Validasi form dan state transition pengajuan/anggota/presensi.
- Email composition, attachment decryption, send, logs, retry.
- Activity audit context dan persistence.
- Realtime publish/listen/fan-out.
- Backup/retention/cron.
- PHBI proxy/cache jika endpoint itu tetap dipertahankan.
- API key policy untuk external system serta CORS allowlist.

Next.js target hanya menyimpan UI state, redirect penghubung SSO tanpa pertukaran token, formatting presentasional, dan pemanggilan Go REST/SSE. Token, session, database, serta client secret dimiliki Go.

## 10. Risiko Migrasi Tertinggi

| Level | Risiko | Mitigasi sebelum cutover |
|---|---|---|
| Kritis | Contract SSO untuk Go belum lengkap; current Better Auth session cookie bukan access token Go. | Dapatkan OIDC/JWKS/audience/logout contract, pilih BFF vs direct token, buat auth integration tests. |
| Kritis | Kompatibilitas AES/scrypt/gzip/file naming dan data plaintext legacy. | Golden vectors Node-Go, sample read-only production export, dual-reader test. |
| Kritis | Authorization drift antara UI action dan REST; beberapa GET/detail/public/SSE terlalu luas. | Snapshot current behavior, tetapkan mana parity vs security correction melalui approval eksplisit. |
| Kritis | File R2 dan DB tidak atomic; replacement menghapus file lama sebelum DB update/upload selesai pada beberapa alur. | Contract tests + compensating cleanup; perubahan semantics harus disetujui. |
| Tinggi | Pengajuan mencakup dua periode, role, status, R2, email attachment/log, dan realtime. | Migrasi setelah User/Periode/R2/Email/Log foundation stabil; integration test penuh. |
| Tinggi | Presensi public sensitif waktu/timezone dan dedup hash; action/API berbeda. | Freeze timezone Asia/Jakarta contract; test boundary minute/date/duplicates; pilih canonical validation. |
| Tinggi | Periode adalah scope semua fitur; view period berbeda dari active write period. | Central period policy package + tests ownership/cross-PAC/name matching. |
| Tinggi | Migration SQL terakhir pernah drop tabel lama; schema production mungkin berbeda dari file. | `pg_dump --schema-only`, Prisma migration status, row counts/checksum sebelum Go. |
| Tinggi | Delete User/Periode cascade DB tetapi meninggalkan R2 objects. | Inventory object references dan cleanup policy; jangan otomatis delete saat tahap parity. |
| Tinggi | Email fire-and-forget dan metadata retry tidak lengkap. | Capture baseline delivery/log semantics; pertimbangkan outbox hanya sebagai approved hardening. |
| Sedang | In-memory encrypted search memiliki cap 2.000/3.000 dan hasil terpotong. | Pertahankan cap untuk parity awal; dokumentasikan limitation dan benchmark Go. |
| Sedang | Prisma auto-notify + explicit notification menghasilkan event duplikat. | Client/idempotency test; pertahankan event shape dahulu. |
| Sedang | SSE public dan in-memory tidak stabil pada multi-instance. | Putuskan security/cross-instance design; PostgreSQL pub/sub dapat dipertahankan untuk tahap awal. |
| Sedang | Dashboard REST memakai raw SQL nama tabel legacy dan property mismatch. | UI action adalah baseline; jangan port raw query lama tanpa test. |
| Sedang | Documentation stale (local auth, forced open, WebSocket, enum lama). | Dokumen audit ini mengalahkan README/API draft; verify dengan acceptance tests. |
| Sedang | Tidak ada tests/CI baseline. | Buat characterization tests sebelum tiap domain. |

### Temuan yang perlu keputusan pemilik produk, bukan perbaikan diam-diam

1. Apakah security gap existing harus dipertahankan sementara untuk parity atau ditutup saat endpoint Go dibuat?
2. Apakah PAC memang boleh membuat presensi (UI/action: ya; REST lama: tidak)?
3. Apakah forced-open 10 menit perlu ada (README/schema: ya; code effective: tidak)?
4. Apakah email verification masih menjadi application gate setelah semua identity berasal dari SSO?
5. Apakah public `wilayah`, `kegiatan`, image, SSE, dan API docs memang sengaja public?
6. Apakah `/api/public/data` tetap diperlukan; endpoint ini mengembalikan data decrypted lintas tenant dengan satu shared API key.
7. Apakah delete User/Periode harus membersihkan R2 atau mempertahankan behavior orphan existing?
8. Apakah internal mobile JWT/API key masih mempunyai consumer aktif?

## 11. Rekomendasi Struktur Go

Struktur modular monolith lebih sesuai daripada microservice. Batas domain tetap jelas, tetapi cross-cutting concern tidak diduplikasi.

```text
backend/
  cmd/
    api/main.go
    backup/main.go
  internal/
    platform/
      config/
      database/
      httpx/
      authn/          # validate token SSO, claims
      authz/          # role, owner, active-user policies
      crypto/         # exact Node-compatible text/file crypto
      storage/        # R2
      mail/
      realtime/
      audit/
      clock/          # injectable Asia/Jakarta time for tests
    identity/         # current user + SSO mapping
    user/
    periode/
    wilayah/
    anggota/
    agenda/
    arsip/
    berkas/
      pimpinan/
      sp/
    pengajuan/
    presensi/
    dashboard/
    emaillog/
    backup/
    publicapi/
  migrations/        # hanya migration baru yang disetujui; jangan recreate schema
  test/
    contract/
    integration/
    fixtures/
  go.mod
```

Pola tiap domain secukupnya:

```text
domain/
  handler.go       # HTTP parsing/response only
  service.go       # business rule/transaction orchestration
  repository.go    # interface yang benar-benar perlu
  postgres.go      # SQL implementation
  model.go
  validation.go
  errors.go
  *_test.go
```

Rekomendasi teknis awal, belum merupakan persetujuan implementasi:

- `net/http` dengan router ringan; hindari framework/DI kompleks.
- SQL eksplisit atau generator type-safe yang menjaga nama tabel/enum exact; jangan auto-migrate schema saat startup.
- Transaction boundary berada di service.
- UTC di DB, rule kalender/waktu presensi memakai `Asia/Jakarta` sesuai behavior deployment sekarang.
- OpenAPI contract disimpan dan diuji; error mapping terpusat.
- Request ID dan structured log terpisah dari `LogActivity` business audit.
- Feature flag per domain untuk cutover Next action -> Go tanpa menghapus action lama.

## 12. Rancangan REST API Target

### Convention

- Base: `/api/v1`.
- Auth internal: `Authorization: Bearer <SSO access token atau token hasil approved BFF exchange>`; tidak ada password/auth database kedua.
- External integration: credential terpisah per client, hashed/rotatable; shared fallback API key tidak dipertahankan tanpa approval.
- Success compatibility: `{ "success": true, "message": "...", "data": ..., "meta": ... }`.
- Error: `{ "success": false, "message": "pesan existing", "error": { "code": "...", "details": ... } }`.
- List: `page`, `limit`, `q`, `sortKey`, `sortDir`; nama query existing dipertahankan pada adapter frontend.
- View period dikirim eksplisit sebagai `periodeId` untuk read. Go wajib memverifikasi hak akses. Mutasi tetap memakai active period kecuali contract menyatakan lain.
- Upload memakai multipart; download mengembalikan bytes dengan `Content-Disposition` existing.

### Foundation/auth/user/periode

| Method | Endpoint | Authorization | Contract |
|---|---|---|---|
| `GET` | `/health/live`, `/health/ready` | Infra | Process/DB dependency checks. |
| `GET` | `/me` | Auth | Identity + local user role/status/active period. |
| `PATCH` | `/me/profile` | Auth | Name/image/application profile only; email/identity rules menunggu SSO decision. |
| `GET` | `/periodes` | Auth | Own periods. |
| `POST` | `/periodes` | Auth | Create; first autoactive. |
| `GET/PATCH/DELETE` | `/periodes/:id` | Owner | Detail/rename/delete non-active. |
| `POST` | `/periodes/:id/activate` | Owner | Switch active and local user pointer. |
| `GET` | `/users` | Cabang | PAC list/filter/stats-compatible fields. |
| `GET` | `/users/:id` | Cabang or self | Detail + active-period domain stats. |
| `PATCH` | `/users/:id/status` | Cabang | Toggle/set application active status. |
| `DELETE` | `/users/:id` | Cabang | Existing cascade semantics. |
| `GET` | `/users/:id/image` | Policy TBD | Stream/redirect compatible image. |

### Domain endpoints

| Domain | Endpoint set | Endpoint khusus |
|---|---|---|
| Wilayah | `GET/POST /wilayah`, `GET/PATCH/DELETE /wilayah/:id` | `POST /wilayah/copy`; filters jenis/user/periode. |
| Anggota | `GET/POST /anggota`, `GET/PATCH/DELETE /anggota/:id` | `PATCH /anggota/:id/status`, `GET /anggota/stats`, `GET /anggota/:id/image`, nested education/training via payload compatible. |
| Agenda | `GET/POST /agenda`, `GET/PATCH/DELETE /agenda/:id` | `GET /agenda/stats`; public calendar endpoint terpisah. |
| Arsip | `GET/POST /arsip`, `GET/PATCH/DELETE /arsip/:id` | `GET /arsip/stats`, `POST /arsip/import`, `GET /arsip/:id/file`, optional 5-minute download grant. |
| Berkas Pimpinan | `GET/POST /berkas-pimpinan`, detail/update/delete | stats, import, file download/grant. |
| Berkas SP | `GET/POST /berkas-sp`, detail/update/delete | stats, import, file download/grant. |
| Pengajuan | `GET/POST /pengajuan`, `GET/PATCH/DELETE /pengajuan/:id` | `PATCH /pengajuan/:id/status`; query `view=mine|review|reference`; stats/file. |
| Presensi | `GET/POST /presensi`, detail/update/delete | `PATCH /presensi/:id/status`, `GET /presensi/:id/participants`, `GET /participants/:id`, public submit. |
| Dashboard | `GET /dashboard` | Response PAC/Cabang compatible dengan component existing. |
| Activity | `GET /activity-logs`, `GET /activity-logs/:id`, `GET /activity-logs/stats`, `GET /activity-logs/monitoring` | Query personal/global, filters existing. |
| Email | `GET /email-logs`, `/stats`, `POST /email-logs/:id/retry` | Cabang-only. |
| Backup | `GET/POST /backups`, `DELETE /backups/:key`, `POST /backups/:key/download-grant` | Cabang; cron invokes service/CLI, bukan public GET bila infra memungkinkan. |
| Realtime | `GET /events` | Auth/policy TBD | SSE event shapes compatible. |

### Public dan integration endpoints

| Method | Endpoint | Catatan |
|---|---|---|
| `POST` | `/integrations/anggota` | Replacement anggota public; per-client credential; same PENDING behavior. |
| `POST` | `/public/presensi/:id/attendance` | Public/limited credential decision; exact validation/dedup. |
| `GET` | `/public/stats` | Existing public aggregate. |
| `GET` | `/public/calendar` | Local events + PHBI if still required. |
| `GET` | `/public/phbi` | Optional proxy/cache. |
| `GET` | `/integrations/data-export` | Replacement `/public/data`; wajib scoped credential, audit, rate limit, dan field allowlist. |

Import/export Excel generation dapat tetap di browser hanya bila tidak membutuhkan data di luar page. Bulk validation/persistence dan export audit tetap di Go.

## 13. Urutan Migrasi Paling Aman

1. **Freeze contract dan baseline**: approve dokumen ini, resolve SSO/security questions, dump schema-only dan sample anonymized data, buat characterization fixtures.
2. **Go foundation**: config, HTTP conventions, DB pool, error mapping, observability, health, CI, test containers; belum ada cutover.
3. **Crypto/R2 compatibility**: golden text/file/hash/download tests; read-only file endpoint in non-production.
4. **SSO + current user**: token validation dan mapping `Account`/User; `/me`; role/isActive policy. Ini gate semua domain.
5. **Periode + view-period contract**: active/read scope central policy.
6. **Activity/realtime primitives**: agar semua domain berikut dapat menghasilkan side effect parity sejak awal.
7. **User management dan profile**: selesaikan boundary SSO vs application data.
8. **Wilayah**: dependency Anggota, kompleksitas rendah-menengah.
9. **Anggota + Pendidikan + Perkaderan**: encryption, cross-PAC, external integration, verification.
10. **Agenda**: encryption/status/public calendar.
11. **Arsip Surat**: establish reusable encrypted document/file/import pipeline.
12. **Berkas Pimpinan** lalu **Berkas SP**: reuse document pipeline dan role differences.
13. **Pengajuan**: setelah User/Periode/File/Email/Log stabil.
14. **Presensi**: public route, timezone, hash/dedup, realtime.
15. **Dashboard**: setelah upstream query behavior sudah stabil.
16. **Email log/retry**, kemudian **backup/cron** dan public/integration exports.
17. **Frontend cutover per domain** dengan feature flag: old action vs Go, compare DB/response/side effect, rollback cepat.
18. **Regression penuh dan cleanup**: hapus backend Next hanya setelah seluruh client dan cron terverifikasi; hapus legacy auth hanya setelah consumer audit.

Untuk setiap domain: audit ulang scoped code -> fixture -> contract test old -> endpoint Go -> integration test -> shadow comparison -> frontend flag -> regression -> observation window -> mark complete.

## 14. Test Strategy dan Definition of Done

### Minimum per module

- Happy path, validation errors dengan pesan exact, unauthenticated, inactive, unverified (jika dipertahankan), wrong role, wrong owner.
- No active period, selected historical period, other user's period, same-name period cross-PAC.
- Not found, duplicate/unique constraint, relation/cascade, DB rollback/error.
- Encryption plaintext fallback, malformed ciphertext, wrong key, large/unicode data.
- File size boundary, upload failure, DB failure after upload, replacement/delete, legacy path, MIME/download filename/token expiry.
- Activity log, email, realtime, cache-equivalent refresh, and duplicate event behavior.
- Pagination/sort/filter and 2.000/3.000 safety-cap parity.
- Timezone/date boundaries and concurrent submissions/status changes.

### Parity harness

- Jalankan request fixture yang sama ke old Next implementation dan Go pada database fixture terisolasi.
- Normalisasi hanya field nondeterministic: IDs bila dibuat baru, timestamp, IV/ciphertext random, signed URL.
- Bandingkan HTTP/status/action result, decrypted DB state, created/deleted R2 keys, logs, email payload/recipient, realtime event.
- Golden tests harus menguji Node encrypt -> Go decrypt dan Go encrypt -> Node decrypt.
- Tidak ada domain dianggap selesai hanya karena endpoint mengembalikan 2xx.

### Baseline audit command

- Tidak ada automated tests/test runner di repository.
- `npx tsc --noEmit --incremental false`: gagal satu error existing di `src/app/sitemap.ts` karena entry tidak memiliki `url`.
- `npx eslint src prisma scripts --ignore-pattern .next`: gagal lima error existing pada empat script CommonJS.
- `npm run lint`: gagal besar karena konfigurasi juga memeriksa output `.next`; bukan indikator source-only yang valid.

## 15. Migration Checklist

### Audit dan keputusan

- [x] Audit repository dan arsitektur current.
- [x] Mapping fitur, UI, actions, routes, tabel, dependency, dan side effect.
- [x] Behavioral contract baseline dari implementasi current.
- [x] Inventaris server actions dan API routes.
- [x] Audit schema Prisma, migration history, constraint, enum, encryption, R2, email, realtime, cron.
- [x] Review dan approval migration plan oleh pemilik aplikasi.
- [x] Implementasi OIDC Authorization Code + PKCE S256 + nonce tervalidasi dan session HttpOnly di Go; bearer JWT/opaque tetap diterima untuk client non-browser.
- [x] Pertahankan compatibility endpoint API-key/public untuk consumer existing; legacy HS256 fallback dihapus.
- [x] Terapkan keputusan hardening tanpa mengubah alur UI (ownership, CORS, API key tanpa fallback, status transition).
- [x] Audit schema/data existing read-only dan smoke `pg_dump --schema-only`; tidak ada schema migration baru.

### Foundation

- [x] Scaffold Go foundation.
- [x] Lint, unit test, build, smoke test, dan migration safety checks lokal.
- [x] DB connection/read-only smoke test terhadap database existing.
- [x] Crypto/hash/file compatibility tests (golden vector text, file, hash, dan token download).
- [x] R2 adapter, encrypted upload/download, signed URL, cleanup replace/delete, dan backup retention.
- [x] SSO discovery serta validasi JWT/userinfo opaque token.
- [x] Current user `/me`, mapping Account subject/email, role/status policy.
- [x] Activity audit dan realtime PostgreSQL LISTEN/NOTIFY + SSE.

### Domain migration

- [x] Periode dan view-period scope.
- [x] User management/profile.
- [x] Wilayah.
- [x] Anggota/Pendidikan/Perkaderan + external intake.
- [x] Agenda + public calendar/PHBI.
- [x] Arsip Surat + import/export/file.
- [x] Berkas Pimpinan + import/export/file.
- [x] Berkas SP + import/export/file.
- [x] Pengajuan + approval/email/lampiran/file/reference.
- [x] Presensi + public attendance/realtime/export.
- [x] Dashboard PAC/Cabang.
- [x] Activity logs, filter, statistik, monitoring, dan detail.
- [x] Email logs/statistik/retry.
- [x] Backup `pg_dump | gzip`, cron, signed URL, dan retensi 10.
- [x] Public/integration APIs termasuk compatibility bot data export.

### Cutover dan cleanup

- [x] Behavioral contract audit old vs Go untuk setiap domain dan unit test contract kritis.
- [x] Frontend integration seluruh domain melalui adapter Go API; frontend build production sukses.
- [x] Integration smoke test database, health, public stats/wilayah/PHBI, OpenAPI, dan full bot export.
- [x] Regression review role/periode/file/side effects; mutation auth memerlukan login SSO aktif saat staging.
- [x] Smoke concurrency 40 request publik serta batas in-memory/pagination/upload diterapkan.
- [x] Security review SSO, state/PKCE, cookie session, ownership, public/API-key routes, CORS, status transition, dan download grants.
- [ ] Production observation window dan rollback drill.
- [x] Hapus backend Next.js lama; route tersisa hanya redirect callback tanpa secret dan proxy tipis file/SSE/PHBI/docs/cron.
- [x] Hapus Better Auth dan Prisma runtime dari frontend; tabel `Account` dan `Session` dipertahankan karena sekarang dimiliki Go, sedangkan data/schema tidak dihapus destruktif.
- [x] Cleanup dokumentasi/script/artefak stale dan update OpenAPI/runbook/env example.

## 16. Hasil Eksekusi

Stop gate audit telah dilewati setelah persetujuan pemilik aplikasi. Repository sekarang memakai struktur `frontend/` + `backend/`; seluruh akses domain dari UI melewati Go API. Schema PostgreSQL tidak diubah dan data existing berhasil dibaca dengan format enkripsi lama.

Verifikasi lokal terakhir:

- Go: `go test ./...`, `go vet ./...`, dan build sukses.
- Next.js: ESLint, TypeScript, dan production build sukses untuk seluruh halaman tanpa Better Auth/Prisma.
- Database: readiness dan `pg_dump --schema-only` sukses.
- Public contract: stats, wilayah, PHBI, API-key rejection, OpenAPI, dan bot export seluruh delapan dataset sukses.
- Concurrency smoke: 40 request paralel ke public stats sukses.

Gate yang sengaja tetap terbuka hanya observation/rollback production. Better Auth dan Prisma runtime sudah dihapus dari frontend. Go kini menjalankan discovery OIDC, Authorization Code + PKCE, pertukaran token, mapping `Account`, dan cookie `Session`; authenticated staging regression memerlukan login SSO baru melalui flow tersebut.
