-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "courseId" TEXT;

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "semester" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Course_semester_idx" ON "Course"("semester");

-- CreateIndex
CREATE INDEX "Problem_courseId_idx" ON "Problem"("courseId");

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
