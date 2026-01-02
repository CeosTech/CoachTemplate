-- AlterTable
ALTER TABLE "Product" ADD COLUMN "activeSubscribers" INTEGER DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "billingInterval" TEXT;
ALTER TABLE "Product" ADD COLUMN "checkoutUrl" TEXT;
