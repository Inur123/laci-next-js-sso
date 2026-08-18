# Keamanan Input - Auth Actions

## 🛡️ Lapisan Keamanan yang Diterapkan

### 1. **Validasi Input dengan Zod**

Semua input dari user divalidasi menggunakan Zod schema sebelum diproses.

#### Register Schema

```typescript
- Nama:
  - Min 2 karakter, Max 100 karakter
  - Hanya huruf, spasi, titik, koma, apostrof
  - Auto trim whitespace
  - Hapus multiple spaces

- Email:
  - Format email valid
  - Auto lowercase
  - Auto trim
  - Max 255 karakter

- Password:
  - Min 6 karakter
  - Max 128 karakter
```

#### Login Schema

```typescript
- Email: Sama seperti register
- Password: Min 1 karakter, Max 128 karakter
```

#### Update Profile Schema

```typescript
- Nama: Sama seperti register
- Email: Sama seperti register
- Password: Optional, jika diisi min 6 karakter
```

### 2. **Pencegahan SQL Injection**

✅ **Prisma ORM** - Menggunakan parameterized queries secara otomatis
✅ **Zod Validation** - Memvalidasi tipe data sebelum query
✅ **Regex Validation** - Mencegah karakter berbahaya di nama

### 3. **Pencegahan XSS (Cross-Site Scripting)**

✅ **Input Sanitization** - Trim dan clean whitespace
✅ **Character Whitelist** - Hanya karakter aman yang diizinkan untuk nama
✅ **Length Limits** - Batasan panjang untuk semua input

### 4. **Pencegahan Bot & Spam**

✅ **Google reCAPTCHA v3** - Wajib untuk register dan login
✅ **Score-based verification** - Mendeteksi aktivitas mencurigakan

### 5. **Password Security**

✅ **Bcrypt Hashing** - Password di-hash dengan bcrypt (10 rounds)
✅ **Never stored plain** - Password asli tidak pernah disimpan
✅ **Length validation** - Min 6, Max 128 karakter

### 6. **Email Security**

✅ **Format validation** - Validasi format email yang ketat
✅ **Lowercase normalization** - Email disimpan dalam lowercase
✅ **Uniqueness check** - Cek duplikasi sebelum insert
✅ **Verification system** - Email verification dengan token

### 7. **Authorization & Access Control**

✅ **Session-based auth** - Auth.js v5 dengan session management
✅ **Role-based access** - SEKRETARIS_PAC vs SEKRETARIS_CABANG
✅ **Active status check** - User harus aktif untuk login

## 📋 Contoh Validasi

### ✅ Input Valid

```
Nama: "Ahmad"
Email: "ahmad@email.com"
Password: "password123"
```

### ❌ Input Ditolak

```
Nama: "Ahmad<script>alert('xss')</script>" // Karakter tidak diizinkan
Nama: "A" // Terlalu pendek
Email: "bukan-email" // Format tidak valid
Email: "EMAIL@DOMAIN.COM" // Auto lowercase jadi "email@domain.com"
Password: "12345" // Terlalu pendek
```

## 🔍 Regex Pattern untuk Nama

```regex
/^[a-zA-Z\s.',-]+$/
```

Hanya mengizinkan:

- Huruf (a-z, A-Z)
- Spasi
- Titik (.)
- Apostrof (')
- Koma (,)
- Tanda hubung (-)

## 🚀 Best Practices yang Diterapkan

1. **Defense in Depth** - Multiple layers of security
2. **Fail Secure** - Reject by default, allow by exception
3. **Input Validation** - Never trust user input
4. **Output Encoding** - Prisma handles this automatically
5. **Least Privilege** - Users only get minimum required access
6. **Audit Trail** - All actions logged via createLog()

## 📝 Catatan Tambahan

- Semua error message user-friendly dan tidak expose sistem internal
- Recaptcha token diverifikasi di server-side (tidak bisa di-bypass)
- Database menggunakan prepared statements via Prisma
- Session management handled by Auth.js dengan secure cookies
