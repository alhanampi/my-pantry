-- CreateTable
CREATE TABLE "FavoriteIngredient" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteIngredient_ownerId_idx" ON "FavoriteIngredient"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteIngredient_ownerId_name_key" ON "FavoriteIngredient"("ownerId", "name");

-- AddForeignKey
ALTER TABLE "FavoriteIngredient" ADD CONSTRAINT "FavoriteIngredient_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
