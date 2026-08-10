-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "ExamAttempt_userId_idx" ON "ExamAttempt"("userId");
