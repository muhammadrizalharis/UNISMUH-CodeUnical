-- CreateTable
CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL,
    "problemId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "strikes" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProctorEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "ProctorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keystroke" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "t" INTEGER NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Keystroke_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProctorEvent_attemptId_idx" ON "ProctorEvent"("attemptId");

-- CreateIndex
CREATE INDEX "Keystroke_attemptId_idx" ON "Keystroke"("attemptId");

-- AddForeignKey
ALTER TABLE "ProctorEvent" ADD CONSTRAINT "ProctorEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keystroke" ADD CONSTRAINT "Keystroke_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
