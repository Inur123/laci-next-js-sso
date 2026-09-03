# Laci Next.js Frontend

Frontend mempertahankan UI dan routing existing. Login, callback OIDC, session, database, dan seluruh business data ditangani Go API. Frontend hanya membutuhkan alamat API dan tidak menyimpan client secret SSO.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Perintah verifikasi: `npm run lint`, `npm run typecheck`, dan `npm run build`.

Route di `src/app/api` hanya berisi proxy tipis untuk stream/file/docs/cron yang diperlukan oleh UI. Jangan menambah database query atau secret backend ke frontend.
