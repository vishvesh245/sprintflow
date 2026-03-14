-- RBAC + Profile Fields Migration
-- Step 1: Create the new UserRole enum
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'MEMBER');

-- Step 2: Migrate role column (all existing users become MEMBER)
ALTER TABLE "User"
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE "UserRole_new" USING 'MEMBER'::"UserRole_new",
  ALTER COLUMN role SET DEFAULT 'MEMBER'::"UserRole_new";

-- Step 3: Drop old enum and rename new one
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- Step 4: Promote first admin
UPDATE "User" SET role = 'ADMIN' WHERE email = 'vpandya@noon.com';

-- Step 5: Add new profile fields to User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "displayName" TEXT,
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS "notifyOnAssign" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyOnComment" BOOLEAN NOT NULL DEFAULT true;
