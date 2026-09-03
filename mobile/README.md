# Laci Digital Mobile

Klien Flutter internal Laci Digital untuk Sekretaris PAC dan Sekretaris Cabang
PC IPNU IPPNU Magetan. Aplikasi memakai API dan aturan bisnis yang sama dengan
frontend Next.js dan backend Go; yang berubah hanya pola interaksi agar sesuai
layar mobile.

Dokumen rinci yang menjadi pendamping README ini:

- [Feature parity matrix](docs/FEATURE_MATRIX.md) untuk hak akses, workflow, dan
  cakupan tiap layar.
- [API contract](docs/API_CONTRACT.md) untuk endpoint, payload, header, error,
  upload/download, periode, dan realtime.

## Alur aplikasi

Tidak ada landing page `/` pada aplikasi mobile. Alur masuk selalu:

```text
cold start
  -> splash native/Flutter (logo Laci)
  -> pulihkan sesi dari secure storage
     -> sesi valid: Dashboard
     -> tanpa sesi/sesi kedaluwarsa: Login
  -> Login SSO (logo SSO hanya pada tombol)
  -> browser sistem + PKCE
  -> lacidigital://oauth/callback
  -> tukar one-time code dengan bearer Laci
  -> Dashboard sesuai role
```

Back dari Dashboard tidak mengembalikan user ke callback atau Login. Logout
mencabut sesi di backend bila jaringan tersedia, selalu membersihkan token
lokal, lalu kembali ke Login.

Hanya dua aset frontend yang disalin ke aplikasi:

- `assets/images/logo_laci.webp` untuk splash;
- `assets/images/logo_sso.webp` untuk ikon tombol Login SSO.

## Fitur dan role

Backend tetap menjadi sumber kebenaran untuk ownership, periode, validasi,
status workflow, dan hak akses. Menyembunyikan menu di mobile bukan pengganti
otorisasi API.

| Area | PAC terverifikasi | Cabang terverifikasi |
|---|---|---|
| Dashboard | Ringkasan personal | Ringkasan personal dan monitoring global |
| Arsip | Arsip surat dan berkas PAC | Arsip surat, berkas Cabang, dan berkas SP |
| Pengajuan berkas | Kelola milik sendiri; edit saat pending | Review lintas PAC, terima/tolak |
| Referensi pengajuan | Baca referensi seluruh PAC | Tidak ditampilkan |
| Wilayah Ranting/PK | CRUD milik sendiri dan salin periode | Monitoring lintas PAC, baca saja |
| Anggota | Data sendiri, riwayat, salin periode | Monitoring, review status, salin periode |
| Agenda kegiatan | Tidak ditampilkan | CRUD dan kalender |
| Presensi | CRUD internal, QR, peserta | CRUD internal, QR, peserta |
| Periode | Kelola, aktifkan, dan pilih periode tampilan | Kelola, aktifkan, dan pilih periode tampilan |
| Aktivitas | Riwayat personal | Riwayat personal dan monitoring global |
| Administrasi | Tidak ditampilkan | User PAC, log email, dan backup database |
| Profil | Lihat profil; perubahan identitas diarahkan ke SSO | Sama |

User dengan `emailVerified=false` hanya dapat membuka Dashboard, Profil, dan
Logout. User `isActive=false` tidak dapat membuat sesi. Form presensi peserta
tetap berupa halaman web publik `/presensi/{id}`; aplikasi hanya mengelola sesi,
peserta, QR, dan link-nya.

## Arsitektur

Kode disusun per fitur dengan dependency satu arah:

```text
lib/main.dart
  -> app/                  root widget, provider, theme
  -> core/                 config, Dio API, error, location, secure storage
  -> features/
       auth/               restore session, SSO bridge, logout
       dashboard/          statistik personal/global
       periods/            active period dan view period
       resources/          list/detail/form dan file action resource utama
       admin/              aktivitas, user, email, backup
       profile/            profil read-only dan tautan pengelolaan di SSO
       home/, splash/      shell role-aware dan entry flow
  -> shared/               model JSON dan widget bersama
```

Riverpod mengelola state dan dependency. Layar memanggil controller/repository,
repository memanggil `ApiClient` berbasis Dio, lalu backend menjalankan aturan
bisnis. `ApiClient` menambahkan header berikut secara terpusat:

- `Authorization: Bearer <opaque-mobile-token>`;
- `X-View-Period` ketika user sedang melihat periode historis;
- `X-Client-Location` dari izin lokasi foreground;
- `X-Client-User-Agent: Laci Mobile`.

Token dan preferensi sensitif disimpan melalui `flutter_secure_storage`
(Keychain pada iOS dan secure storage Android), bukan preferences biasa. Respons
`401` mengakhiri sesi lokal. Respons `403`, `409`, dan `422` tetap ditampilkan
sebagai keputusan backend, bukan ditimpa oleh state lokal.

Shell utama memakai navigasi bawah **Beranda**, **Layanan**, dan **Akun** pada
ponsel, lalu berubah menjadi navigation rail pada layar lebar. Semua layanan web
tetap tersedia melalui tab Layanan sesuai role. Pemuatan data awal memakai
shimmer dari package `shimmer`; progress indicator biasa hanya digunakan untuk
aksi yang sedang berlangsung, seperti login, simpan, ekspor, atau logout.

## Prasyarat pengembangan

Versi proyek saat dibuat adalah Flutter 3.24.0 stable dan Dart 3.5.0. Gunakan
versi tersebut atau versi stable kompatibel yang tetap memenuhi `pubspec.yaml`.

| Target | Prasyarat |
|---|---|
| Semua | Flutter SDK, Git, backend Go Laci yang dapat dijangkau, akun SSO uji |
| Android | Android SDK Platform 36, emulator/perangkat, JDK 17+, NDK `25.1.8937393` atau lebih baru, minimum Android API 21 |
| iOS | macOS, Xcode, CocoaPods, simulator/perangkat, minimum iOS 12 |
| Backend lokal | Go sesuai `backend/go.mod`, PostgreSQL, konfigurasi SSO |

Periksa toolchain sebelum mulai:

```bash
flutter --version
flutter doctor -v
flutter devices
```

Ambil dependency:

```bash
cd mobile
flutter pub get
```

## Menyiapkan backend untuk mobile

Mobile tidak boleh memegang `SSO_CLIENT_SECRET`. Karena client SSO yang ada
bersifat confidential, backend menyediakan auth bridge. Sebelum mencoba Login,
backend harus sudah memuat migration dan konfigurasi mobile.

### 1. Terapkan migration

Backup database lebih dahulu, lalu terapkan migration berikut tepat satu kali:

```bash
cd backend
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f prisma/migrations/20260824000000_add_mobile_auth_bridge/migration.sql
```

Jika deployment mempunyai migration runner tersendiri, jalankan file yang sama
melalui runner tersebut. Backend tidak menjalankan migration otomatis.
Migration menambahkan `MobileAuthTransaction`; bearer mobile tetap memakai tabel
`Session` yang sudah ada dan hanya disimpan sebagai hash.

### 2. Isi environment backend

Minimal pastikan konfigurasi SSO/database yang lama tetap valid dan tambahkan:

```dotenv
MOBILE_REDIRECT_URIS=lacidigital://oauth/callback
```

`MOBILE_REDIRECT_URIS` adalah allowlist exact-match yang dipisahkan koma bila
ada lebih dari satu build. Perbedaan scheme, host, path, huruf, query, atau slash
akan ditolak. Jangan memasukkan wildcard atau URI `http`.

`SSO_REDIRECT_URL` tetap callback HTTPS backend/frontend yang sudah terdaftar
pada provider SSO. Jangan menggantinya dengan deep link. Provider kembali ke
backend terlebih dahulu; backend baru mengarahkan one-time code ke aplikasi.

Contoh menjalankan backend lokal:

```bash
cd backend
cp .env.example .env
# Isi DATABASE_URL, konfigurasi SSO, secret backend, dan MOBILE_REDIRECT_URIS.
go test ./...
go run ./cmd/api
```

Verifikasi service:

```bash
curl http://localhost:8080/health/live
curl http://localhost:8080/health/ready
curl http://localhost:8080/openapi.json
```

## Konfigurasi Flutter

Semua URL mobile berada di satu file `mobile/.env`. Salin template sekali,
kemudian perubahan environment cukup dilakukan di file tersebut:

```bash
cd mobile
cp .env.example .env
```

`API_BASE_URL` berisi origin backend tanpa `/api/v1`; aplikasi menambahkannya
sendiri. `FRONTEND_BASE_URL` adalah origin web publik untuk QR/link peserta
presensi.

| Variable `.env` | Contoh development | Fungsi |
|---|---|---|
| `API_BASE_URL` | `http://localhost:8080` | Origin backend Go, tanpa `/api/v1` |
| `FRONTEND_BASE_URL` | `http://localhost:3000` | Origin frontend publik untuk `/presensi/{id}` |
| `MOBILE_REDIRECT_URI` | `lacidigital://oauth/callback` | Callback native; harus sama persis dengan allowlist backend |
| `SSO_PROFILE_URL` | `https://pelajarnumagetan.id/dashboard/profil` | Halaman profil SSO yang dibuka dari Profil |
| `APP_ENV` | `development` | Penanda environment build, misalnya `development`, `staging`, atau `production` |

Tidak ada fallback URL di source. Aplikasi gagal start dengan pesan konfigurasi
bila variable wajib kosong atau URL tidak valid. `.env` diabaikan Git, sedangkan
`.env.example` menjadi daftar variable resmi. File `.env` ikut dibundel dan dapat
dibaca dari binary; isi hanya URL/label publik. Jangan pernah menaruh client
secret SSO, API key, credential database/R2/SMTP, atau cron secret di sini.
Setelah mengubah `.env`, lakukan full restart atau rebuild aplikasi. Scheme
callback adalah identitas native tetap `lacidigital`; host/path callback berasal
dari `MOBILE_REDIRECT_URI` dan backend tetap harus mengizinkannya secara persis.

Contoh isi `.env` staging:

```dotenv
APP_ENV=staging
API_BASE_URL=https://api-staging.example.org
FRONTEND_BASE_URL=https://staging.example.org
MOBILE_REDIRECT_URI=lacidigital://oauth/callback
SSO_PROFILE_URL=https://sso-staging.example.org/dashboard/profil
```

Setelah `.env` benar, jalankan tanpa daftar `dart-define`:

```bash
flutter run
```

Pilih perangkat tertentu dengan `-d <device-id>` dari hasil `flutter devices`.
Untuk full SSO di emulator atau perangkat fisik, gunakan URL HTTPS yang dapat
dijangkau browser sistem dan mempunyai sertifikat tepercaya.

Catatan alamat lokal:

- `localhost` di perangkat fisik menunjuk perangkat itu sendiri, bukan komputer
  pengembang.
- Untuk Android Emulator dengan konfigurasi lokal `localhost`, hubungkan port
  emulator ke komputer sebelum login (ulangi setelah emulator direstart):

  ```bash
  adb reverse tcp:8080 tcp:8080
  adb reverse tcp:3000 tcp:3000
  ```

  Port `8080` dipakai API dan port `3000` dipakai callback SSO frontend. Pastikan
  backend juga memuat `MOBILE_REDIRECT_URIS=lacidigital://oauth/callback`.
- Android Emulator biasanya mengakses host melalui `10.0.2.2`, tetapi build ini
  tidak mengizinkan cleartext HTTP untuk rilis. Gunakan reverse proxy/tunnel
  HTTPS tepercaya untuk pengujian SSO yang representatif.
- iOS Simulator dapat memakai service host lokal pada banyak konfigurasi, tetapi
  URL callback SSO juga harus dapat dijangkau dari browser. Bila ragu, gunakan
  endpoint HTTPS staging/tunnel.

## Auth bridge dan deep link

Flow autentikasi sengaja tidak memakai OIDC langsung dari APK/IPA:

1. Aplikasi meminta lokasi foreground untuk audit. Setelah lokasi tersedia,
   aplikasi membuat `state` dan PKCE verifier acak.
2. Browser sistem membuka `GET /api/v1/auth/mobile/login` dengan callback,
   `state`, dan challenge `S256`.
3. Backend menyimpan transaksi singkat dan menjalankan OIDC confidential dengan
   provider memakai client secret yang hanya ada di server.
4. Callback provider diselesaikan backend. Aplikasi menerima:
   `lacidigital://oauth/callback?code=<one-time-code>&state=<state>`.
5. Aplikasi memverifikasi `state`, lalu mengirim code, verifier, dan callback ke
   `POST /api/v1/auth/mobile/exchange`.
6. Backend mengonsumsi code secara atomik dan mengembalikan opaque bearer Laci.

One-time code berlaku dua menit, terikat PKCE dan redirect URI, serta hanya bisa
dipakai sekali. Sesi mobile berlaku enam jam. Tidak ada refresh endpoint; saat
kedaluwarsa atau menerima `401`, user Login SSO kembali. Provider token, session
token, maupun secret tidak pernah diletakkan di deep link.

Registrasi native saat ini:

| Platform | Lokasi | Nilai |
|---|---|---|
| Android | `android/app/src/main/AndroidManifest.xml` | scheme `lacidigital`, host `oauth`, path `/callback` |
| iOS | `ios/Runner/Info.plist` | URL scheme `lacidigital` |

Custom scheme dapat diklaim aplikasi lain, sehingga validasi `state`, PKCE, code
single-use, dan allowlist backend wajib dipertahankan. Jangan menangani callback
sendiri di WebView dan jangan melonggarkan exact-match backend.

Uji registrasi deep link pada build debug (fake code memang akan ditolak oleh
auth flow; tujuan perintah ini hanya memastikan OS menemukan aplikasi):

```bash
adb shell am start -a android.intent.action.VIEW \
  -d "lacidigital://oauth/callback?code=test&state=test" \
  org.pelajarnumagetan.laci_mobile
```

```bash
xcrun simctl openurl booted \
  "lacidigital://oauth/callback?code=test&state=test"
```

Sesudah mengubah scheme/bundle, jalankan clean build dan hapus versi aplikasi
lama dari simulator/perangkat agar registrasi URL tidak memakai cache lama.

## Izin lokasi

Login membutuhkan lokasi foreground sesuai aturan Login web untuk kebutuhan
audit akses. Aplikasi tidak meminta dan tidak memerlukan lokasi background.

- Android mendeklarasikan `ACCESS_COARSE_LOCATION` dan
  `ACCESS_FINE_LOCATION` di `android/app/src/main/AndroidManifest.xml`.
- iOS mendeklarasikan `NSLocationWhenInUseUsageDescription` di
  `ios/Runner/Info.plist`.

Jika layanan lokasi mati, timeout, atau izin ditolak, aplikasi tidak mengarang
koordinat dan Login berhenti dengan pesan yang dapat ditindaklanjuti. Penolakan
permanen menampilkan tombol untuk membuka pengaturan aplikasi. Koordinat disimpan
di secure storage dan dikirim saat exchange sebagai `X-Client-Location`; hasil
capture selalu dihapus bila SSO dibatalkan/gagal atau sesi berakhir.

Saat mengubah alasan pemakaian lokasi, sinkronkan teks dialog aplikasi,
`Info.plist`, privacy disclosure Play Store, dan App Store Privacy.

## Kualitas dan testing

Jalankan dari folder `mobile`:

```bash
dart format --output=none --set-exit-if-changed lib test integration_test test_driver
flutter analyze
flutter test
```

Jika suite device/integration tersedia, jalankan pada emulator atau perangkat:

```bash
flutter drive \
  --driver=test_driver/integration_test.dart \
  --target=integration_test/app_smoke_test.dart \
  -d <device-id>
```

Auth provider nyata biasanya tetap membutuhkan uji manual karena browser sistem
dan MFA/consent berada di luar process test. Uji minimal dengan akun PAC
terverifikasi, Cabang terverifikasi, akun email belum terverifikasi, akun
inactive, pembatalan consent, sesi kedaluwarsa, serta jaringan putus.

Backend bridge juga harus lulus:

```bash
cd ../backend
go test ./...
go vet ./...
go build ./cmd/api
```

## Build Android

APK installable untuk QA lokal (ditandatangani debug key oleh Flutter):

```bash
flutter build apk --debug
```

APK release untuk verifikasi atau distribusi setelah upload keystore tersedia:

```bash
flutter build apk --release \
  --build-name=1.0.0 \
  --build-number=1
```

Android App Bundle untuk Play Store:

```bash
flutter build appbundle --release \
  --build-name=1.0.0 \
  --build-number=1
```

Artefak berada di `build/app/outputs/`. Project saat ini memakai application ID
`org.pelajarnumagetan.laci_mobile`; pastikan ID itu sudah disetujui sebelum rilis
pertama karena identitas aplikasi di store tidak dapat diganti setelah terbit.

Build release tidak pernah memakai debug key. Salin
`android/key.properties.example` menjadi `android/key.properties`, arahkan
`storeFile` ke upload keystore, lalu isi credential dari secret manager/CI.
File asli dan seluruh `*.jks`/`*.keystore` sudah diabaikan Git. Tanpa file itu,
Gradle hanya menghasilkan artefak QA yang tidak ditandatangani dan tidak dapat
diunggah ke Play Store.

## Build iOS

Pasang pod setelah `flutter pub get` atau setelah dependency native berubah:

```bash
cd ios
pod install
cd ..
```

Validasi build tanpa signing di CI/lokal:

```bash
flutter build ios --release --no-codesign
```

Untuk archive/IPA, buka `ios/Runner.xcworkspace` di Xcode, pilih Team,
provisioning profile, dan capability yang diperlukan, lalu Archive; atau gunakan
`flutter build ipa` setelah signing tersedia. Bundle ID saat ini
`org.pelajarnumagetan.laciMobile`. Finalkan Bundle ID, App Store record, dan
signing team sebelum rilis pertama.

## Urutan deployment

Urutan aman ketika auth bridge mobile pertama kali dirilis:

1. Backup PostgreSQL dan uji restore.
2. Terapkan migration `20260824000000_add_mobile_auth_bridge`.
3. Tambahkan exact callback ke `MOBILE_REDIRECT_URIS` pada secret/config backend.
4. Pastikan `SSO_REDIRECT_URL` lama masih terdaftar tepat di provider SSO.
5. Deploy backend dan jalankan health check, Go test, serta smoke test OpenAPI.
6. Uji `/auth/mobile/login` sampai callback dan exchange di staging.
7. Build APK/IPA dengan URL staging, lalu jalankan matrix akun/role.
8. Build production dari commit yang sama dengan URL production dan signing
   resmi.
9. Rilis bertahap, pantau error `MOBILE_AUTH_DISABLED`,
   `INVALID_AUTH_REQUEST`, `INVALID_GRANT`, `401`, dan kegagalan SSO.

Migration bersifat tambahan sehingga frontend web dan cookie session lama tetap
berjalan. Jangan menghapus flow web `/auth/login`, `/auth/callback`, atau session
cookie ketika mengaktifkan mobile.

## Troubleshooting

### Login menampilkan `MOBILE_AUTH_DISABLED` / HTTP 503

`MOBILE_REDIRECT_URIS` kosong atau tidak terbaca process backend. Periksa env
deployment dan restart backend setelah perubahan.

### `INVALID_AUTH_REQUEST` sebelum browser menuju SSO

Bandingkan karakter demi karakter nilai `MOBILE_REDIRECT_URI` di build dengan
`MOBILE_REDIRECT_URIS` backend. Default yang benar adalah
`lacidigital://oauth/callback`. Pastikan method PKCE tetap `S256`.

### Browser selesai Login tetapi aplikasi tidak terbuka

Periksa scheme/host/path Android dan URL scheme iOS, lalu hapus dan instal ulang
aplikasi. Pastikan tidak ada aplikasi lain yang mengambil scheme `lacidigital`.
Lihat URL akhir: provider harus kembali ke `SSO_REDIRECT_URL` terlebih dahulu,
bukan langsung ke custom scheme.

### Login berakhir `INVALID_GRANT`

One-time code mungkin berumur lebih dari dua menit, sudah dipakai, verifier tidak
cocok, atau redirect URI berbeda. Mulai Login baru; jangan mencoba memakai ulang
callback lama. Periksa juga sinkronisasi waktu server.

### API tidak dapat dijangkau dari emulator/perangkat

Jangan memakai `localhost` untuk perangkat fisik. Pastikan DNS, firewall, dan TLS
dapat dijangkau dari browser perangkat. Gunakan sertifikat tepercaya; jangan
mematikan validasi TLS di aplikasi.

### Login berhenti pada izin lokasi

Aktifkan layanan lokasi dan izin “while using the app”. Jika pernah memilih
“jangan tanya lagi”, buka Settings perangkat. Pada simulator, tetapkan simulated
location sebelum menguji Login. Aturan ini sama dengan tombol Login web.

### Setelah Login langsung kembali ke Login / menerima `401`

Periksa status `isActive`, waktu kedaluwarsa sesi enam jam, migration, dan record
session backend. Logout/login ulang bila token sudah kedaluwarsa. Aplikasi memang
membersihkan token otomatis pada `401`.

### Hanya Dashboard dan Profil yang terlihat

Ini perilaku yang benar bila `emailVerified=false`. Verifikasi email di SSO lalu
Login ulang agar `/me` mengembalikan status terbaru.

### Menu/aksi tidak tersedia atau API memberi `403`

Periksa role (`SEKRETARIS_PAC` atau `SEKRETARIS_CABANG`), ownership, status
workflow, dan periode aktif. Backend adalah otoritas akhir; jangan membuka menu
dengan memodifikasi state lokal.

### Data terlihat berasal dari periode yang salah

Periksa strip konteks periode. Pilihan “Melihat” mengirim `X-View-Period` untuk
read, sedangkan mutasi period-scoped tetap diarahkan ke periode aktif. Kembali ke
periode aktif lalu refresh jika periode historis sudah tidak valid.

### Android build gagal karena Java/Gradle

Pastikan Flutter memakai JDK 17+ (`flutter doctor -v`) dan Android SDK memiliki
Platform 36 serta NDK `25.1.8937393`. Project memakai AGP 8.9.1, Gradle 8.11.1,
Kotlin 2.1.0, mengompilasi Java/Kotlin dengan target 11, serta minimum SDK 21.
Metadata plugin terbaru merekomendasikan NDK `27.0.12077973`; build debug dan
release tetap telah diverifikasi dengan NDK 25.1. Naikkan pin `ndkVersion`
bersama image CI ketika NDK 27 sudah tersedia di semua mesin build.

### iOS gagal saat link plugin

Jalankan `flutter clean`, `flutter pub get`, kemudian `pod install` dari folder
`ios`. Pastikan deployment target tidak di bawah iOS 12 dan buka
`Runner.xcworkspace`, bukan `Runner.xcodeproj`.

## Checklist rilis

- [ ] `dart format`, `flutter analyze`, `flutter test`, dan integration test lulus.
- [ ] `go test ./...`, `go vet ./...`, dan `go build ./cmd/api` lulus.
- [ ] Backup/restore database diuji dan migration mobile sudah diterapkan.
- [ ] `MOBILE_REDIRECT_URIS` production exact-match dengan build production.
- [ ] `SSO_REDIRECT_URL` production tetap valid di provider SSO.
- [ ] `API_BASE_URL` memakai HTTPS production dengan sertifikat tepercaya.
- [ ] `FRONTEND_BASE_URL` memakai origin web production yang membuka form presensi publik.
- [ ] `.env` mobile berisi kelima variable wajib dan tidak memakai URL contoh/development.
- [ ] Tidak ada secret/API key/provider token di `.env`, source, APK, atau IPA.
- [ ] Android application ID, upload signing, Play App Signing, dan versionCode final.
- [ ] iOS bundle ID, Team, certificate, provisioning, dan build number final.
- [ ] Nama aplikasi, icon, splash logo Laci, dan tombol logo SSO diperiksa di device.
- [ ] Deep link diuji pada Android dan iOS setelah fresh install.
- [ ] Permission lokasi, privacy disclosure, dan tautan kebijakan store sesuai.
- [ ] Akun PAC, Cabang, unverified, inactive, dan pembatalan SSO diuji.
- [ ] CRUD, workflow terima/tolak, periode historis, upload/download, QR, dan backup diuji sesuai role.
- [ ] Logout online/offline, token kedaluwarsa, `401`, `403`, dan jaringan putus diuji.
- [ ] Release staging disetujui sebelum build/signing production.
