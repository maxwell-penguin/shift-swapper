-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_inviteCode_key" ON "Group"("inviteCode");

-- Everything before this migration was effectively single-tenant. Fold all
-- existing data into one "legacy" group so nobody's shifts/messages/etc. get
-- orphaned by the new NOT NULL constraints below — existing users land in it
-- automatically (skipping onboarding), new users get their own via the
-- create/join flow.
INSERT INTO "Group" ("id", "name", "inviteCode", "createdAt")
VALUES ('legacy00000000000000000001', 'My Group', upper(substr(md5(random()::text), 1, 6)), CURRENT_TIMESTAMP);

-- AlterTable (nullable for now — backfilled below, then locked to NOT NULL)
ALTER TABLE "Message" ADD COLUMN     "groupId" TEXT;
ALTER TABLE "Shift" ADD COLUMN     "groupId" TEXT;
ALTER TABLE "SwapCycle" ADD COLUMN     "groupId" TEXT;
ALTER TABLE "SwapPreference" ADD COLUMN     "groupId" TEXT;
ALTER TABLE "SwapRequest" ADD COLUMN     "groupId" TEXT;
ALTER TABLE "User" ADD COLUMN     "groupId" TEXT;

-- Backfill: every pre-existing row (and every pre-existing user, so they
-- don't get redirected to onboarding for data that already exists) joins
-- the legacy group.
UPDATE "User" SET "groupId" = 'legacy00000000000000000001' WHERE "groupId" IS NULL;
UPDATE "Message" SET "groupId" = 'legacy00000000000000000001' WHERE "groupId" IS NULL;
UPDATE "Shift" SET "groupId" = 'legacy00000000000000000001' WHERE "groupId" IS NULL;
UPDATE "SwapCycle" SET "groupId" = 'legacy00000000000000000001' WHERE "groupId" IS NULL;
UPDATE "SwapPreference" SET "groupId" = 'legacy00000000000000000001' WHERE "groupId" IS NULL;
UPDATE "SwapRequest" SET "groupId" = 'legacy00000000000000000001' WHERE "groupId" IS NULL;

-- Now that every row has a value, lock these down (User.groupId stays
-- nullable — a freshly signed-up user has no group until onboarding).
ALTER TABLE "Message" ALTER COLUMN "groupId" SET NOT NULL;
ALTER TABLE "Shift" ALTER COLUMN "groupId" SET NOT NULL;
ALTER TABLE "SwapCycle" ALTER COLUMN "groupId" SET NOT NULL;
ALTER TABLE "SwapPreference" ALTER COLUMN "groupId" SET NOT NULL;
ALTER TABLE "SwapRequest" ALTER COLUMN "groupId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Message_groupId_idx" ON "Message"("groupId");

-- CreateIndex
CREATE INDEX "Shift_groupId_idx" ON "Shift"("groupId");

-- CreateIndex
CREATE INDEX "SwapCycle_groupId_idx" ON "SwapCycle"("groupId");

-- CreateIndex
CREATE INDEX "SwapPreference_groupId_idx" ON "SwapPreference"("groupId");

-- CreateIndex
CREATE INDEX "SwapRequest_groupId_idx" ON "SwapRequest"("groupId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapPreference" ADD CONSTRAINT "SwapPreference_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapCycle" ADD CONSTRAINT "SwapCycle_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
