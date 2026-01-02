-- CreateTable
CREATE TABLE "CoachSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "heroEyebrow" TEXT,
    "heroTitle" TEXT,
    "heroHighlight" TEXT,
    "heroDescription" TEXT,
    "heroPrimaryImage" TEXT,
    "heroSecondaryImage" TEXT,
    "heroStats" TEXT,
    "features" TEXT,
    "focusBlocks" TEXT,
    "coachName" TEXT,
    "coachRole" TEXT,
    "coachBio" TEXT,
    "coachPhoto" TEXT,
    "coachStats" TEXT,
    "testimonials" TEXT,
    "reviews" TEXT,
    "methodSteps" TEXT,
    "carouselSlides" TEXT,
    "palette" TEXT,
    "fontFamily" TEXT,
    "ctaPrimary" TEXT,
    "ctaSecondary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoachSite_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CoachSite_coachId_key" ON "CoachSite"("coachId");
