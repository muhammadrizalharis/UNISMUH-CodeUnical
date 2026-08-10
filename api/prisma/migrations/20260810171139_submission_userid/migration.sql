-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");
