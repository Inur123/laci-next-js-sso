# Dokumentasi Integrasi API Sistem Anggota ke Laci Digital

Dokumen ini berisi panduan untuk melakukan sinkronisasi data dari **Sistem Anggota (Eksternal)** ke dalam **Laci Digital**. Melalui API ini, pengguna yang mendaftar di Sistem Anggota akan otomatis masuk ke Laci Digital dengan status **Menunggu Verifikasi (PENDING)**.

## Endpoint API

- **URL**: `[BASE_URL]/api/anggota/public`
- **Method**: `POST`
- **Format Content-Type**: `application/json`

*(Ganti `[BASE_URL]` dengan domain Laci Digital saat production, contoh: `https://laci-digital.com/api/anggota/public`)*

## Autentikasi

Setiap _request_ wajib menyertakan API Key pada _header_ untuk memastikan keamanan data.

```http
Headers:
  x-api-key: "ISI_DENGAN_API_KEY_LACI_YANG_VALID"
  Content-Type: "application/json"
```

## Payload (Request Body)

| Field | Tipe Data | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `pacId` | `string` | **Ya** | ID User (Akun) PAC yang menjadi induk pendaftar di sistem Laci. |
| `namaLengkap` | `string` | **Ya** | Nama lengkap pendaftar. |
| `jenisKelamin` | `string` | **Ya** | Harus bernilai `"LAKI_LAKI"` atau `"PEREMPUAN"`. |
| `wilayahId` | `string` | Tidak | ID Ranting / Pimpinan Komisariat (PK) yang dipilih. Kosongkan jika mendaftar langsung ke PAC. |
| `nik` | `string` | Tidak | Nomor Induk Kependudukan (akan otomatis dienkripsi). |
| `nia` | `string` | Tidak | Nomor Induk Anggota. |
| `email` | `string` | Tidak | Email aktif. |
| `tempatLahir` | `string` | Tidak | Kota/Kabupaten tempat lahir. |
| `tanggalLahir` | `string` | Tidak | Format tanggal standar ISO, contoh: `2000-12-31`. |
| `alamatLengkap` | `string` | Tidak | Alamat lengkap pendaftar. |
| `noHp` | `string` | Tidak | Nomor WhatsApp / Handphone pendaftar. |
| `hobi` | `string` | Tidak | Hobi pendaftar. |
| `jabatan` | `string` | Tidak | Jabatan yang diampu di organisasi. |
| `pekerjaan` | `string` | Tidak | Pekerjaan saat ini. |
| `jenjangPendidikan` | `string` | Tidak | Contoh: "SMA", "S1", dsb. |
| `namaInstansiPendidikan` | `string` | Tidak | Nama sekolah / kampus. |
| `perkaderans` | `Array` | Tidak | Riwayat Makesta/Lakmud dll. Format: `[ { "namaPerkaderan": "MAKESTA", "tanggal": "2020-01-01", "tempat": "PCNU" } ]` |
| `pendidikans` | `Array` | Tidak | Riwayat pendidikan formal. Format: `[ { "jenjang": "SD", "namaSekolah": "SDN 1" } ]` |

> **Catatan Keamanan:** Semua data sensitif (seperti NIK, No HP, Alamat, dan Riwayat) akan otomatis **dienkripsi (AES-256)** saat disimpan di database Laci Digital.

## Contoh Request (cURL)

```bash
curl -X POST https://laci-digital.com/api/anggota/public \
  -H "Content-Type: application/json" \
  -H "x-api-key: MY_SECRET_API_KEY_123" \
  -d '{
    "pacId": "clx_user_pac_001",
    "wilayahId": "clx_ranting_001",
    "namaLengkap": "Budi Santoso",
    "jenisKelamin": "LAKI_LAKI",
    "nik": "351234567890001",
    "tempatLahir": "Magetan",
    "tanggalLahir": "2002-05-15",
    "noHp": "081234567890",
    "jenjangPendidikan": "SMA",
    "namaInstansiPendidikan": "SMA N 1 Magetan",
    "perkaderans": [
      {
        "namaPerkaderan": "MAKESTA",
        "tanggal": "2022-01-10",
        "tempat": "MWCNU Sukomoro"
      }
    ],
    "pendidikans": [
      {
        "jenjang": "SMA",
        "namaSekolah": "SMA N 1 Magetan"
      }
    ]
  }'
```

## Response API

### 1. Berhasil (201 Created)
```json
{
  "success": true,
  "message": "Data anggota berhasil dikirim dan menunggu verifikasi PAC.",
  "data": {
    "id": "clx_anggota_new_id"
  }
}
```

### 2. Gagal: PAC Tidak Punya Periode Aktif (400 Bad Request)
Jika PAC belum mengaktifkan periode kepengurusan di Laci, pendaftaran akan ditolak.
```json
{
  "success": false,
  "message": "PAC tersebut tidak memiliki periode aktif saat ini."
}
```

### 3. Gagal: API Key Salah (401 Unauthorized)
```json
{
  "success": false,
  "message": "Invalid API Key"
}
```

### 4. Gagal: Data Wajib Kosong (400 Bad Request)
```json
{
  "success": false,
  "message": "pacId, namaLengkap, dan jenisKelamin wajib diisi."
}
```

## Alur Sistem
1. Pendaftar mengisi form di **Sistem Anggota Eksternal**.
2. Pendaftar memilih PAC tujuan (mendapatkan `pacId`), dan opsional memilih ranting/PK tujuan (mendapatkan `wilayahId`).
3. Sistem Anggota mengirim _request_ ke endpoint Laci ini.
4. Laci Digital menerima data, mengecek periode aktif PAC, dan mengenkripsi data sensitif.
5. Data masuk ke Laci dengan status `PENDING`.
6. Pengurus PAC melihat pendaftar di _tab_ **"Menunggu Verifikasi"** dan dapat mengklik "Terima" (DITERIMA) atau "Tolak" (DITOLAK).
