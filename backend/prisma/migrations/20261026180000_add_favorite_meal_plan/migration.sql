-- CreateTable
CREATE TABLE "FavoriteMealPlan" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceMealPlanId" TEXT,
    "dietaryRestrictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "servings" INTEGER NOT NULL DEFAULT 2,
    "includeBreakfast" BOOLEAN NOT NULL DEFAULT false,
    "batchPrepPlan" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteMealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteMealPlanEntry" (
    "id" TEXT NOT NULL,
    "favoriteMealPlanId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "mealType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "ingredients" JSONB NOT NULL,
    "steps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT NOT NULL DEFAULT '',
    "prepTimeMinutes" INTEGER,
    "totalTimeMinutes" INTEGER,

    CONSTRAINT "FavoriteMealPlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteMealPlan_ownerId_idx" ON "FavoriteMealPlan"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteMealPlanEntry_favoriteMealPlanId_dayOfWeek_mealTyp_key" ON "FavoriteMealPlanEntry"("favoriteMealPlanId", "dayOfWeek", "mealType");

-- AddForeignKey
ALTER TABLE "FavoriteMealPlan" ADD CONSTRAINT "FavoriteMealPlan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteMealPlanEntry" ADD CONSTRAINT "FavoriteMealPlanEntry_favoriteMealPlanId_fkey" FOREIGN KEY ("favoriteMealPlanId") REFERENCES "FavoriteMealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
