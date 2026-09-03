-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SEKRETARIS_CABANG', 'SEKRETARIS_PAC');

-- CreateEnum
CREATE TYPE "JenisSurat" AS ENUM ('MASUK', 'KELUAR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "password" TEXT NOT NULL,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'SEKRETARIS_PAC',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "periodeAktifId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Periode" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Periode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArsipSurat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodeId" TEXT NOT NULL,
    "organisasi" TEXT NOT NULL,
    "noSurat" TEXT NOT NULL,
    "jenisSurat" "JenisSurat" NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "pengirimPenerima" TEXT NOT NULL,
    "deskripsi" TEXT,
    "file" TEXT,
    "perihal" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArsipSurat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Periode_userId_idx" ON "Periode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Periode_nama_userId_key" ON "Periode"("nama", "userId");

-- CreateIndex
CREATE INDEX "ArsipSurat_userId_idx" ON "ArsipSurat"("userId");

-- CreateIndex
CREATE INDEX "ArsipSurat_periodeId_idx" ON "ArsipSurat"("periodeId");

-- CreateIndex
CREATE INDEX "ArsipSurat_tanggal_idx" ON "ArsipSurat"("tanggal");

-- AddForeignKey
ALTER TABLE "Periode" ADD CONSTRAINT "Periode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArsipSurat" ADD CONSTRAINT "ArsipSurat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArsipSurat" ADD CONSTRAINT "ArsipSurat_periodeId_fkey" FOREIGN KEY ("periodeId") REFERENCES "Periode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
