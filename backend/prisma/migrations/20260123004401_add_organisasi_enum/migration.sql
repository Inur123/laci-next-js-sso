/*
  Warnings:

  - Changed the type of `organisasi` on the `ArsipSurat` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Organisasi" AS ENUM ('IPNU', 'IPPNU', 'BERSAMA');

-- AlterTable
ALTER TABLE "ArsipSurat" DROP COLUMN "organisasi",
ADD COLUMN     "organisasi" "Organisasi" NOT NULL;
