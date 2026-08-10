-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "examId" TEXT;

-- CreateIndex
CREATE INDEX "ExamAttempt_examId_idx" ON "ExamAttempt"("examId");
