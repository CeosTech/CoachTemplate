-- Member access gating
ALTER TABLE "MemberProfile" ADD COLUMN "isActivated" BOOLEAN NOT NULL DEFAULT false;

-- Credit value per produit
ALTER TABLE "Product" ADD COLUMN "creditValue" INTEGER;

-- Packs achetés par les membres
CREATE TABLE "MemberPack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "paymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "totalCredits" INTEGER,
    "creditsRemaining" INTEGER,
    "metadata" TEXT,
    "activatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberPack_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberPack_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemberPack_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Lien entre réservation et pack
ALTER TABLE "Booking" ADD COLUMN "packId" TEXT REFERENCES "MemberPack"("id");
