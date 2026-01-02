-- Add booking status + payment link fields
ALTER TABLE "Booking" ADD COLUMN "memberNotes" TEXT;
ALTER TABLE "Booking" ADD COLUMN "coachNotes" TEXT;
ALTER TABLE "Booking" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Booking" ADD COLUMN "confirmedAt" DATETIME;
ALTER TABLE "Booking" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Booking" ADD COLUMN "paymentId" TEXT REFERENCES "Payment"("id");

-- Allow tracking refunds on payments
