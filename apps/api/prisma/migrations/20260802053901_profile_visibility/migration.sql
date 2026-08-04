-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'CONNECTIONS');

-- AlterTable
ALTER TABLE "user_profile" ADD COLUMN     "visibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC';
