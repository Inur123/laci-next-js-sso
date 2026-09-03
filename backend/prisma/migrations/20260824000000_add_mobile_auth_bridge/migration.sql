-- Native clients cannot safely hold the confidential SSO client secret. This
-- short-lived transaction table lets the Go backend complete OIDC and issue a
-- PKCE-bound, single-use application code instead.
CREATE TABLE "MobileAuthTransaction" (
    "id" TEXT NOT NULL,
    "providerStateHash" TEXT NOT NULL,
    "providerCodeVerifier" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "appState" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "exchangeCodeHash" TEXT,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "providerCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileAuthTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileAuthTransaction_providerStateHash_key"
    ON "MobileAuthTransaction"("providerStateHash");

CREATE UNIQUE INDEX "MobileAuthTransaction_exchangeCodeHash_key"
    ON "MobileAuthTransaction"("exchangeCodeHash");

CREATE INDEX "MobileAuthTransaction_expiresAt_idx"
    ON "MobileAuthTransaction"("expiresAt");

CREATE INDEX "MobileAuthTransaction_userId_idx"
    ON "MobileAuthTransaction"("userId");

ALTER TABLE "MobileAuthTransaction"
    ADD CONSTRAINT "MobileAuthTransaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
