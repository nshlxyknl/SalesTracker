/*
  Warnings:

  - You are about to drop the column `email` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `user` table. All the data in the column will be lost.
  - You are about to drop the `account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verification` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `password` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "account" DROP CONSTRAINT "account_userId_fkey";

-- DropForeignKey
ALTER TABLE "session" DROP CONSTRAINT "session_userId_fkey";

-- DropIndex
DROP INDEX "user_email_key";

-- Add password column with a temporary default value
ALTER TABLE "user" ADD COLUMN "password" TEXT NOT NULL DEFAULT 'temp_password_needs_reset';

-- Update existing users with a default password (they'll need to reset)
-- Using bcrypt hash for 'defaultpassword123' 
UPDATE "user" SET "password" = '$2a$12$LQv3c1yqBwEHXk.JHHPmy.cO7TNfNJAajgCYVNXALhEKXvbHEiluW' WHERE "password" = 'temp_password_needs_reset';

-- Remove the default value constraint
ALTER TABLE "user" ALTER COLUMN "password" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user" DROP COLUMN "email",
DROP COLUMN "emailVerified",
DROP COLUMN "image",
DROP COLUMN "name",
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "account";

-- DropTable
DROP TABLE "session";

-- DropTable
DROP TABLE "verification";
