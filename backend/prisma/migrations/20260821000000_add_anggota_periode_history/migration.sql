-- These objects were already part of the application schema before this
-- migration, but were missing from the historical SQL chain. Keep the repair
-- idempotent so both an existing synchronized database and a fresh deployment
-- reach the same schema before AnggotaPeriode is created.
DO $$
BEGIN
    CREATE TYPE "StatusVerifikasi" AS ENUM ('PENDING', 'DITERIMA', 'DITOLAK');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "JenisWilayah" AS ENUM ('RANTING', 'PK');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "LogModule" ADD VALUE IF NOT EXISTS 'WILAYAH';

CREATE TABLE IF NOT EXISTS "Wilayah" (
    id TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodeId" TEXT NOT NULL,
    jenis "JenisWilayah" NOT NULL,
    nama TEXT NOT NULL,
    ketua TEXT,
    kontak TEXT,
    alamat TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Wilayah_pkey" PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS "Wilayah_userId_jenis_idx"
    ON "Wilayah"("userId", jenis);
CREATE INDEX IF NOT EXISTS "Wilayah_periodeId_idx"
    ON "Wilayah"("periodeId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Wilayah_userId_fkey'
    ) THEN
        ALTER TABLE "Wilayah"
            ADD CONSTRAINT "Wilayah_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"(id)
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Wilayah_periodeId_fkey'
    ) THEN
        ALTER TABLE "Wilayah"
            ADD CONSTRAINT "Wilayah_periodeId_fkey"
            FOREIGN KEY ("periodeId") REFERENCES "Periode"(id)
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "Anggota"
    ADD COLUMN IF NOT EXISTS "wilayahId" TEXT,
    ADD COLUMN IF NOT EXISTS status "StatusVerifikasi" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS "alasanPenolakan" TEXT;

CREATE INDEX IF NOT EXISTS "Anggota_wilayahId_idx"
    ON "Anggota"("wilayahId");
CREATE INDEX IF NOT EXISTS "Anggota_status_idx"
    ON "Anggota"(status);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Anggota_wilayahId_fkey'
    ) THEN
        ALTER TABLE "Anggota"
            ADD CONSTRAINT "Anggota_wilayahId_fkey"
            FOREIGN KEY ("wilayahId") REFERENCES "Wilayah"(id)
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Preserve one member identity while allowing membership in multiple periods.
CREATE TABLE "AnggotaPeriode" (
    id TEXT NOT NULL,
    "anggotaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodeId" TEXT NOT NULL,
    "wilayahId" TEXT,
    status "StatusVerifikasi" NOT NULL DEFAULT 'PENDING',
    "alasanPenolakan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnggotaPeriode_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX "AnggotaPeriode_anggotaId_periodeId_key"
    ON "AnggotaPeriode"("anggotaId", "periodeId");
CREATE INDEX "AnggotaPeriode_userId_periodeId_idx"
    ON "AnggotaPeriode"("userId", "periodeId");
CREATE INDEX "AnggotaPeriode_periodeId_idx"
    ON "AnggotaPeriode"("periodeId");
CREATE INDEX "AnggotaPeriode_wilayahId_idx"
    ON "AnggotaPeriode"("wilayahId");

ALTER TABLE "AnggotaPeriode"
    ADD CONSTRAINT "AnggotaPeriode_anggotaId_fkey"
    FOREIGN KEY ("anggotaId") REFERENCES "Anggota"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnggotaPeriode"
    ADD CONSTRAINT "AnggotaPeriode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnggotaPeriode"
    ADD CONSTRAINT "AnggotaPeriode_periodeId_fkey"
    FOREIGN KEY ("periodeId") REFERENCES "Periode"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnggotaPeriode"
    ADD CONSTRAINT "AnggotaPeriode_wilayahId_fkey"
    FOREIGN KEY ("wilayahId") REFERENCES "Wilayah"(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Every existing member keeps its current period as its first history entry.
INSERT INTO "AnggotaPeriode" (
    id, "anggotaId", "userId", "periodeId", "wilayahId", status,
    "alasanPenolakan", "createdAt", "updatedAt"
)
SELECT
    'ap_' || a.id,
    a.id,
    a."userId",
    a."periodeId",
    a."wilayahId",
    a.status,
    a."alasanPenolakan",
    a."createdAt",
    a."updatedAt"
FROM "Anggota" a
ON CONFLICT ("anggotaId", "periodeId") DO NOTHING;
