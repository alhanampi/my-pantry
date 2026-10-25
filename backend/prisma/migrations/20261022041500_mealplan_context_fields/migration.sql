-- AlterTable
ALTER TABLE "MealPlan"
  ADD COLUMN "dietaryRestrictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "servings" INTEGER NOT NULL DEFAULT 2;
