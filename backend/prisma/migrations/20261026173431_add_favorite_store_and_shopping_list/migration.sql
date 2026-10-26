-- CreateTable
CREATE TABLE "FavoriteStore" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteShoppingList" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteShoppingList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteStore_ownerId_idx" ON "FavoriteStore"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteStore_ownerId_placeId_key" ON "FavoriteStore"("ownerId", "placeId");

-- CreateIndex
CREATE INDEX "FavoriteShoppingList_ownerId_idx" ON "FavoriteShoppingList"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteShoppingList_ownerId_listId_key" ON "FavoriteShoppingList"("ownerId", "listId");

-- AddForeignKey
ALTER TABLE "FavoriteStore" ADD CONSTRAINT "FavoriteStore_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteShoppingList" ADD CONSTRAINT "FavoriteShoppingList_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteShoppingList" ADD CONSTRAINT "FavoriteShoppingList_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ShoppingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
