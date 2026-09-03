# Laci Go Backend

Backend REST untuk Laci Digital. Service ini mempertahankan PostgreSQL dan format enkripsi existing, menangani Authorization Code + PKCE S256 + nonce terhadap SSO existing, memiliki session aplikasi, lalu menerapkan role dan periode dari tabel `User`.

## Menjalankan

```bash
cp .env.example .env
go run ./cmd/api
```

File `.env` dibaca otomatis. Environment proses tetap memiliki prioritas sehingga deployment container dapat menyuntikkan secret tanpa file.

Health checks tersedia pada `GET /health/live` dan `GET /health/ready`. Semua endpoint aplikasi berada di `/api/v1`.

Panduan integrasi sistem anggota eksternal tersedia di [`README-API-ANGGOTA.md`](README-API-ANGGOTA.md).

Backend tidak menjalankan migration database secara otomatis. Migration schema disimpan di `backend/prisma`; migration `20260821000000_add_anggota_periode_history` wajib diterapkan ke database sebelum fitur riwayat periode anggota digunakan. Prisma di folder backend hanya menjadi referensi/migration history, bukan runtime frontend.

Daftarkan nilai `SSO_REDIRECT_URL` secara persis di konfigurasi client SSO. Backend hanya memakai issuer, client ID, client secret, dan redirect URI; tidak ada konfigurasi audience terpisah. Jika frontend dan API memakai subdomain berbeda, isi `SESSION_COOKIE_DOMAIN` dengan parent domain bersama. `pg_dump` wajib tersedia pada runtime jika fitur backup digunakan.

Jalankan `go test ./...`, `go vet ./...`, dan `go build ./cmd/api` sebelum deployment.
