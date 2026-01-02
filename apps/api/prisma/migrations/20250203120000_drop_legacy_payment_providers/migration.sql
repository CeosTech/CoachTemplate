PRAGMA foreign_keys=OFF;

CREATE TABLE "new_CoachIntegrationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "stripePublicKey" TEXT,
    "stripeSecretKey" TEXT,
    "stripeWebhookSecret" TEXT,
    "twilioAccountSid" TEXT,
    "twilioAuthToken" TEXT,
    "twilioFromNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachIntegrationSettings_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_CoachIntegrationSettings" ("id", "coachId", "stripePublicKey", "stripeSecretKey", "stripeWebhookSecret", "twilioAccountSid", "twilioAuthToken", "twilioFromNumber", "createdAt", "updatedAt")
SELECT "id", "coachId", "stripePublicKey", "stripeSecretKey", "stripeWebhookSecret", "twilioAccountSid", "twilioAuthToken", "twilioFromNumber", "createdAt", "updatedAt"
FROM "CoachIntegrationSettings";

DROP TABLE "CoachIntegrationSettings";
ALTER TABLE "new_CoachIntegrationSettings" RENAME TO "CoachIntegrationSettings";
CREATE UNIQUE INDEX "CoachIntegrationSettings_coachId_key" ON "CoachIntegrationSettings"("coachId");

PRAGMA foreign_keys=ON;
