/*
  Warnings:

  - The values [KEGIATAN,PENGAJUAN_PAC] on the enum `LogModule` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - The `emailVerified` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `EmailVerificationToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Kegiatan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PengajuanPAC` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('VERIFICATION', 'VERIFIED_SUCCESS', 'PENGAJUAN_USER', 'PENGAJUAN_ADMIN', 'PENGAJUAN_STATUS');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterEnum
ALTER TYPE "LogAction" ADD VALUE 'IMPORT';

-- AlterEnum
BEGIN;
CREATE TYPE "LogModule_new" AS ENUM ('ARSIP_SURAT', 'ANGGOTA', 'BERKAS_PIMPINAN', 'BERKAS_SP', 'AGENDA_KEGIATAN', 'PENGAJUAN_BERKAS', 'PERIODE', 'USER', 'AUTH', 'PRESENSI');
ALTER TABLE "LogActivity" ALTER COLUMN "module" TYPE "LogModule_new" USING ("module"::text::"LogModule_new");
ALTER TYPE "LogModule" RENAME TO "LogModule_old";
ALTER TYPE "LogModule_new" RENAME TO "LogModule";
DROP TYPE "public"."LogModule_old";
COMMIT;

-- AlterEnum
ALTER TYPE "Organisasi" ADD VALUE 'CBP_KPP';

-- DropForeignKey
ALTER TABLE "EmailVerificationToken" DROP CONSTRAINT "EmailVerificationToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "Kegiatan" DROP CONSTRAINT "Kegiatan_periodeId_fkey";

-- DropForeignKey
ALTER TABLE "Kegiatan" DROP CONSTRAINT "Kegiatan_userId_fkey";

-- DropForeignKey
ALTER TABLE "PengajuanPAC" DROP CONSTRAINT "PengajuanPAC_periodeIdPac_fkey";

-- DropForeignKey
ALTER TABLE "PengajuanPAC" DROP CONSTRAINT "PengajuanPAC_periodeId_fkey";

-- DropForeignKey
ALTER TABLE "PengajuanPAC" DROP CONSTRAINT "PengajuanPAC_userId_fkey";

-- DropIndex
DROP INDEX "Anggota_periodeId_idx";

-- DropIndex
DROP INDEX "ArsipSurat_periodeId_idx";

-- DropIndex
DROP INDEX "ArsipSurat_userId_idx";

-- DropIndex
DROP INDEX "BerkasPimpinan_periodeId_idx";

-- DropIndex
DROP INDEX "BerkasPimpinan_userId_idx";

-- DropIndex
DROP INDEX "BerkasSP_periodeId_idx";

-- DropIndex
DROP INDEX "BerkasSP_userId_idx";

-- DropIndex
DROP INDEX "LogActivity_action_idx";

-- DropIndex
DROP INDEX "LogActivity_createdAt_idx";

-- DropIndex
DROP INDEX "LogActivity_module_idx";

-- DropIndex
DROP INDEX "LogActivity_periodeId_idx";

-- DropIndex
DROP INDEX "LogActivity_userId_idx";

-- AlterTable
ALTER TABLE "Anggota" ADD COLUMN     "jenjangPendidikan" TEXT,
ADD COLUMN     "namaInstansiPendidikan" TEXT,
ADD COLUMN     "pekerjaan" TEXT;

-- AlterTable
ALTER TABLE "LogActivity" ADD COLUMN     "browser" TEXT,
ADD COLUMN     "device" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
ADD COLUMN     "lastLogoutAt" TIMESTAMP(3),
DROP COLUMN "emailVerified",
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "EmailVerificationToken";

-- DropTable
DROP TABLE "Kegiatan";

-- DropTable
DROP TABLE "PengajuanPAC";

-- CreateTable
CREATE TABLE "PengajuanBerkas" (
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

    CONSTRAINT "PengajuanBerkas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presensi" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodeId" TEXT NOT NULL,
    "namaKegiatan" TEXT NOT NULL,
    "tempat" TEXT NOT NULL,
    "penyelenggara" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "jamMulai" TEXT NOT NULL,
    "jamSelesai" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isForcedOpen" BOOLEAN NOT NULL DEFAULT false,
    "forcedOpenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Presensi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresensiData" (
    "id" TEXT NOT NULL,
    "presensiId" TEXT NOT NULL,
    "namaLengkap" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "noHp" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "noHpHash" TEXT NOT NULL,
    "organisasi" TEXT NOT NULL,
    "tingkat" TEXT,
    "jabatan" TEXT,
    "instansi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresensiData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pendidikan" (
    "id" TEXT NOT NULL,
    "anggotaId" TEXT NOT NULL,
    "jenjang" TEXT NOT NULL,
    "namaSekolah" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pendidikan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Perkaderan" (
    "id" TEXT NOT NULL,
    "anggotaId" TEXT NOT NULL,
    "namaPerkaderan" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "tempat" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Perkaderan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaKegiatan" (
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

    CONSTRAINT "AgendaKegiatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogEmail" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PengajuanBerkas_userId_status_idx" ON "PengajuanBerkas"("userId", "status");

-- CreateIndex
CREATE INDEX "PengajuanBerkas_periodeId_idx" ON "PengajuanBerkas"("periodeId");

-- CreateIndex
CREATE INDEX "PengajuanBerkas_periodeIdPac_idx" ON "PengajuanBerkas"("periodeIdPac");

-- CreateIndex
CREATE INDEX "Presensi_userId_periodeId_idx" ON "Presensi"("userId", "periodeId");

-- CreateIndex
CREATE INDEX "PresensiData_presensiId_idx" ON "PresensiData"("presensiId");

-- CreateIndex
CREATE UNIQUE INDEX "PresensiData_presensiId_emailHash_key" ON "PresensiData"("presensiId", "emailHash");

-- CreateIndex
CREATE UNIQUE INDEX "PresensiData_presensiId_noHpHash_key" ON "PresensiData"("presensiId", "noHpHash");

-- CreateIndex
CREATE INDEX "Pendidikan_anggotaId_idx" ON "Pendidikan"("anggotaId");

-- CreateIndex
CREATE INDEX "Perkaderan_anggotaId_idx" ON "Perkaderan"("anggotaId");

-- CreateIndex
CREATE INDEX "AgendaKegiatan_userId_periodeId_idx" ON "AgendaKegiatan"("userId", "periodeId");

-- CreateIndex
CREATE INDEX "AgendaKegiatan_tanggalMulai_idx" ON "AgendaKegiatan"("tanggalMulai");

-- CreateIndex
CREATE INDEX "LogEmail_status_idx" ON "LogEmail"("status");

-- CreateIndex
CREATE INDEX "LogEmail_type_idx" ON "LogEmail"("type");

-- CreateIndex
CREATE INDEX "LogEmail_createdAt_idx" ON "LogEmail"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "LogEmail_to_createdAt_idx" ON "LogEmail"("to", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Verification_identifier_value_key" ON "Verification"("identifier", "value");

-- CreateIndex
CREATE INDEX "Anggota_userId_periodeId_idx" ON "Anggota"("userId", "periodeId");

-- CreateIndex
CREATE INDEX "ArsipSurat_userId_periodeId_idx" ON "ArsipSurat"("userId", "periodeId");

-- CreateIndex
CREATE INDEX "ArsipSurat_createdAt_idx" ON "ArsipSurat"("createdAt");

-- CreateIndex
CREATE INDEX "BerkasPimpinan_userId_periodeId_idx" ON "BerkasPimpinan"("userId", "periodeId");

-- CreateIndex
CREATE INDEX "BerkasSP_userId_periodeId_idx" ON "BerkasSP"("userId", "periodeId");

-- CreateIndex
CREATE INDEX "LogActivity_userId_periodeId_createdAt_idx" ON "LogActivity"("userId", "periodeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LogActivity_module_createdAt_idx" ON "LogActivity"("module", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LogActivity_userId_createdAt_idx" ON "LogActivity"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LogActivity_createdAt_idx" ON "LogActivity"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "User_role_isActive_emailVerified_idx" ON "User"("role", "isActive", "emailVerified");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- AddForeignKey
ALTER TABLE "PengajuanBerkas" ADD CONSTRAINT "PengajuanBerkas_periodeIdPac_fkey" FOREIGN KEY ("periodeIdPac") REFERENCES "Periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PengajuanBerkas" ADD CONSTRAINT "PengajuanBerkas_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "Periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PengajuanBerkas" ADD CONSTRAINT "PengajuanBerkas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presensi" ADD CONSTRAINT "Presensi_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "Periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presensi" ADD CONSTRAINT "Presensi_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresensiData" ADD CONSTRAINT "PresensiData_presensiId_fkey" FOREIGN KEY ("presensiId") REFERENCES "Presensi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pendidikan" ADD CONSTRAINT "Pendidikan_anggotaId_fkey" FOREIGN KEY ("anggotaId") REFERENCES "Anggota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perkaderan" ADD CONSTRAINT "Perkaderan_anggotaId_fkey" FOREIGN KEY ("anggotaId") REFERENCES "Anggota"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaKegiatan" ADD CONSTRAINT "AgendaKegiatan_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "Periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaKegiatan" ADD CONSTRAINT "AgendaKegiatan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
