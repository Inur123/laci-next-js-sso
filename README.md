# Laci Digital

Laci Digital terdiri dari Next.js frontend, Go backend, dan klien Flutter native. UI web, SSO existing, PostgreSQL existing, schema/ID/data, enkripsi AES-256-CBC, R2, SMTP, realtime, Excel, dan workflow organisasi tetap dipertahankan. Flutter memakai API dan aturan bisnis yang sama dengan web, dengan presentasi yang disesuaikan untuk layar mobile.

```text
Browser -> frontend/ (Next.js UI + Go API client)
Mobile  -> mobile/   (Flutter UI + secure native session)
                   -> backend/ (Go REST API + OIDC/session)
                   -> existing SSO
                   -> PostgreSQL / R2 / SMTP
```

## Struktur

- `frontend/`: Next.js 15, React UI existing, route callback penghubung tanpa secret, dan adapter tipis ke Go.
- `backend/`: Go API, OIDC login/callback/session, authorization, business logic, PostgreSQL, crypto/file, email, SSE, backup, cron, dan public integration API.
- `mobile/`: Flutter untuk Android/iOS, native splash, browser-system SSO + PKCE, secure storage, dashboard role-aware, dan seluruh fitur internal sesuai hak akses PAC/Cabang.
- `mobile/docs/`: kontrak API dan matriks parity FE/BE/mobile.
- `MIGRATION_PLAN.md`: audit awal, keputusan, hasil implementasi, dan checklist verifikasi.

## Menjalankan lokal

Prasyarat web/backend: Node.js 20+, Go 1.26+, PostgreSQL existing, dan `pg_dump` untuk backup. Mobile memerlukan Flutter 3.24+/Dart 3.5+, Android SDK, serta Xcode/CocoaPods untuk iOS.

```bash
cd backend
cp .env.example .env
go run ./cmd/api
```

Backend otomatis membaca `backend/.env` dan berjalan pada `http://localhost:8080` secara default.
Pastikan `MOBILE_REDIRECT_URIS=lacidigital://oauth/callback` diaktifkan dan jalankan migration additive `20260824000000_add_mobile_auth_bridge` sebelum memakai login mobile.

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

Frontend berjalan pada `http://localhost:3000` dan hanya membutuhkan alamat Go API serta URL profil SSO. Database, SSO client secret, session, enkripsi, R2, SMTP, API key, dan cron hanya berada di backend.

```bash
cd mobile
cp .env.example .env
flutter pub get
flutter run
```

Semua URL mobile diatur hanya melalui `mobile/.env`. Untuk development Android
Emulator dengan URL `localhost`, aktifkan `adb reverse tcp:8080 tcp:8080` dan
`adb reverse tcp:3000 tcp:3000`; untuk build staging/production, ganti origin di
`.env` sebelum rebuild. Panduan setup, deep link, build, signing, dan release
lengkap ada di [`mobile/README.md`](mobile/README.md).

## Verifikasi

```bash
cd backend && go test ./... && go vet ./...
cd frontend && npm run lint && npm run typecheck && npm run build
cd mobile && flutter analyze && flutter test
```

Health check: `GET /health/live` dan `GET /health/ready`. OpenAPI tersedia di `GET /openapi.json` dan UI-nya di frontend `/api-docs`.

Public compatibility endpoints berada di `/api/v1/public/*`; sinkronisasi bot memakai `GET /api/v1/public/data` dengan header `X-API-Key`. Endpoint aplikasi menerima cookie session HttpOnly milik Go untuk web atau opaque bearer session `laci_mob_*` untuk Flutter. Secret SSO, R2, SMTP, cron, dan API key integrasi tidak pernah ditanam ke aplikasi mobile.

Migration mobile bersifat additive: satu tabel transaksi OAuth berumur pendek ditambahkan. Tidak ada tabel/domain existing yang dihapus atau diubah secara destruktif.
