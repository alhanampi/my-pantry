-- FavoriteRecipe.recipeId / MealPlanEntry.recipeId: Int -> String.
-- Existing rows only ever came from Spoonacular, so they're backfilled with
-- the "spoonacular:<id>" compound form (see recipeSerializers.ts's
-- makeRecipeId) rather than dropped — this lets a Spoonacular numeric id and
-- an Edamam uri coexist in the same column without colliding.

-- FavoriteRecipe
ALTER TABLE "FavoriteRecipe" ADD COLUMN "recipeId_new" TEXT;
UPDATE "FavoriteRecipe" SET "recipeId_new" = 'spoonacular:' || "recipeId"::text;
ALTER TABLE "FavoriteRecipe" ALTER COLUMN "recipeId_new" SET NOT NULL;
DROP INDEX IF EXISTS "FavoriteRecipe_ownerId_recipeId_key";
ALTER TABLE "FavoriteRecipe" DROP COLUMN "recipeId";
ALTER TABLE "FavoriteRecipe" RENAME COLUMN "recipeId_new" TO "recipeId";
CREATE UNIQUE INDEX "FavoriteRecipe_ownerId_recipeId_key" ON "FavoriteRecipe"("ownerId", "recipeId");

-- MealPlanEntry
ALTER TABLE "MealPlanEntry" ADD COLUMN "recipeId_new" TEXT;
UPDATE "MealPlanEntry" SET "recipeId_new" = 'spoonacular:' || "recipeId"::text;
ALTER TABLE "MealPlanEntry" ALTER COLUMN "recipeId_new" SET NOT NULL;
ALTER TABLE "MealPlanEntry" DROP COLUMN "recipeId";
ALTER TABLE "MealPlanEntry" RENAME COLUMN "recipeId_new" TO "recipeId";
