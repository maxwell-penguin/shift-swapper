-- CreateTable
CREATE TABLE "SwapPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "giveShiftId" TEXT NOT NULL,
    "acceptableShiftIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "acceptableFromDate" TIMESTAMP(3),
    "acceptableToDate" TIMESTAMP(3),
    "acceptableTimeOfDay" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "cycleId" TEXT,
    "matchedWithId" TEXT,
    "agreedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwapPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwapCycle" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwapCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SwapPreference_matchedWithId_key" ON "SwapPreference"("matchedWithId");

-- CreateIndex
CREATE INDEX "SwapPreference_status_idx" ON "SwapPreference"("status");

-- AddForeignKey
ALTER TABLE "SwapPreference" ADD CONSTRAINT "SwapPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapPreference" ADD CONSTRAINT "SwapPreference_giveShiftId_fkey" FOREIGN KEY ("giveShiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapPreference" ADD CONSTRAINT "SwapPreference_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "SwapCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapPreference" ADD CONSTRAINT "SwapPreference_matchedWithId_fkey" FOREIGN KEY ("matchedWithId") REFERENCES "SwapPreference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
