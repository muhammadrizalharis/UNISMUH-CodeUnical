-- AlterTable
ALTER TABLE "ProctorSnapshot" ADD COLUMN     "objectKey" TEXT,
ALTER COLUMN "image" DROP NOT NULL;
