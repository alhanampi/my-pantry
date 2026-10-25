-- Mealprep is moving from Spoonacular/Edamam day-bookmarks to full
-- AI-generated recipe content (see mealPlanAi.ts). The old MealPlanEntry
-- shape (a bare recipeId pointer) has no sensible mapping onto the new one
-- (ingredients/steps/mealType), so existing plans are cleared rather than
-- migrated — this only affects in-progress weekly plans, not any durable
-- user data like the pantry or shopping lists.
DELETE FROM "MealPlan";

-- AlterTable
ALTER TABLE "MealPlan"
  ADD COLUMN "includeBreakfast" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "batchPrepPlan" JSONB;

-- AlterTable
ALTER TABLE "MealPlanEntry"
  DROP COLUMN "recipeId",
  ADD COLUMN "mealType" TEXT NOT NULL,
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "ingredients" JSONB NOT NULL,
  ADD COLUMN "steps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "notes" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "prepTimeMinutes" INTEGER,
  ADD COLUMN "totalTimeMinutes" INTEGER;

-- DropIndex
DROP INDEX "MealPlanEntry_mealPlanId_dayOfWeek_key";

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanEntry_mealPlanId_dayOfWeek_mealType_key" ON "MealPlanEntry"("mealPlanId", "dayOfWeek", "mealType");
