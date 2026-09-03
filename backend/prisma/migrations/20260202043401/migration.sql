-- CreateEnum
CREATE TYPE "StatusPengajuan" AS ENUM ('PENDING', 'DITERIMA', 'DITOLAK');

-- CreateEnum
CREATE TYPE "PenerimaSurat" AS ENUM ('IPNU', 'IPPNU', 'BERSAMA');

-- CreateEnum
CREATE TYPE "JenisKelamin" AS ENUM ('LAKI_LAKI', 'PEREMPUAN');

-- CreateEnum
CREATE TYPE "LogAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT');

-- CreateEnum
CREATE TYPE "LogModule" AS ENUM ('ARSIP_SURAT', 'ANGGOTA', 'BERKAS_PIMPINAN', 'BERKAS_SP', 'KEGIATAN', 'PENGAJUAN_PAC', 'PERIODE', 'USER', 'AUTH');

-- AlterTable
ALTER TABLE "ArsipSurat" ALTER COLUMN "organisasi" DROP NOT NULL;

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BerkasSP" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodeId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tanggalMulai" TIMESTAMP(3) NOT NULL,
    "tanggalBerakhir" TIMESTAMP(3) NOT NULL,
    "catatan" TEXT,
    "file" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organisasi" "Organisasi" NOT NULL,

    CONSTRAINT "BerkasSP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BerkasPimpinan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodeId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "catatan" TEXT,
    "file" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BerkasPimpinan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PengajuanPAC" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodeId" TEXT NOT NULL,
    "periodeIdPac" TEXT NOT NULL,
    "noSurat" TEXT NOT NULL,
    "penerima" "PenerimaSurat" NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "keperluan" TEXT NOT NULL,
    "deskripsi" TEXT,
    "file" TEXT NOT NULL,
    "status" "StatusPengajuan" NOT NULL DEFAULT 'PENDING',
    "alasanPenolakan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PengajuanPAC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anggota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodeId" TEXT NOT NULL,
    "nik" TEXT,
    "nia" TEXT,
    "email" TEXT,
    "foto" TEXT,
    "namaLengkap" TEXT NOT NULL,
    "tempatLahir" TEXT,
    "tanggalLahir" TIMESTAMP(3),
    "jenisKelamin" "JenisKelamin" NOT NULL,
    "alamatLengkap" TEXT,
    "noHp" TEXT,
    "hobi" TEXT,
    "jabatan" TEXT,
    "noRfid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Anggota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kegiatan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodeId" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "deskripsi" TEXT,
    "lokasi" TEXT,
    "warna" TEXT NOT NULL,
    "tanggalMulai" TIMESTAMP(3) NOT NULL,
    "tanggalSelesai" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kegiatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllowedOrigin" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllowedOrigin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodeId" TEXT NOT NULL,
    "action" "LogAction" NOT NULL,
    "module" "LogModule" NOT NULL,
    "description" TEXT NOT NULL,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_token_idx" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "BerkasSP_userId_idx" ON "BerkasSP"("userId");

-- CreateIndex
CREATE INDEX "BerkasSP_periodeId_idx" ON "BerkasSP"("periodeId");

-- CreateIndex
CREATE INDEX "BerkasPimpinan_userId_idx" ON "BerkasPimpinan"("userId");

-- CreateIndex
CREATE INDEX "BerkasPimpinan_periodeId_idx" ON "BerkasPimpinan"("periodeId");

-- CreateIndex
CREATE INDEX "PengajuanPAC_userId_idx" ON "PengajuanPAC"("userId");

-- CreateIndex
CREATE INDEX "PengajuanPAC_periodeId_idx" ON "PengajuanPAC"("periodeId");

-- CreateIndex
CREATE INDEX "PengajuanPAC_periodeIdPac_idx" ON "PengajuanPAC"("periodeIdPac");

-- CreateIndex
CREATE INDEX "PengajuanPAC_status_idx" ON "PengajuanPAC"("status");

-- CreateIndex
CREATE INDEX "Anggota_periodeId_idx" ON "Anggota"("periodeId");

-- CreateIndex
CREATE INDEX "Kegiatan_userId_idx" ON "Kegiatan"("userId");

-- CreateIndex
CREATE INDEX "Kegiatan_periodeId_idx" ON "Kegiatan"("periodeId");

-- CreateIndex
CREATE INDEX "Kegiatan_tanggalMulai_idx" ON "Kegiatan"("tanggalMulai");

-- CreateIndex
CREATE UNIQUE INDEX "AllowedOrigin_domain_key" ON "AllowedOrigin"("domain");

-- CreateIndex
CREATE INDEX "LogActivity_userId_idx" ON "LogActivity"("userId");

-- CreateIndex
CREATE INDEX "LogActivity_periodeId_idx" ON "LogActivity"("periodeId");

-- CreateIndex
CREATE INDEX "LogActivity_action_idx" ON "LogActivity"("action");

-- CreateIndex
CREATE INDEX "LogActivity_module_idx" ON "LogActivity"("module");

-- CreateIndex
CREATE INDEX "LogActivity_createdAt_idx" ON "LogActivity"("createdAt");

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BerkasSP" ADD CONSTRAINT "BerkasSP_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "Periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BerkasSP" ADD CONSTRAINT "BerkasSP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BerkasPimpinan" ADD CONSTRAINT "BerkasPimpinan_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "Periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BerkasPimpinan" ADD CONSTRAINT "BerkasPimpinan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PengajuanPAC" ADD CONSTRAINT "PengajuanPAC_periodeIdPac_fkey" FOREIGN KEY ("periodeIdPac") REFERENCES "Periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PengajuanPAC" ADD CONSTRAINT "PengajuanPAC_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "Periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PengajuanPAC" ADD CONSTRAINT "PengajuanPAC_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anggota" ADD CONSTRAINT "Anggota_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "Periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anggota" ADD CONSTRAINT "Anggota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kegiatan" ADD CONSTRAINT "Kegiatan_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "Periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kegiatan" ADD CONSTRAINT "Kegiatan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogActivity" ADD CONSTRAINT "LogActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogActivity" ADD CONSTRAINT "LogActivity_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "Periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
