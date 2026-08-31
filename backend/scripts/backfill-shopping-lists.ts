// Backfills ShoppingList.General for every user and re-points existing
// ShoppingItem rows with listId IS NULL to it. Idempotent: safe to run more
// than once — it only creates a list when the user doesn't already have an
// `isGeneral` one, and only updates items that still have listId IS NULL.
//
// This must be run AFTER the phase-1 migration (`listId` nullable) and
// BEFORE the phase-2 migration (`listId` NOT NULL) — see docs/... plan
// section 1 for the full two-phase sequence, and verify
// `SELECT COUNT(*) FROM "ShoppingItem" WHERE "listId" IS NULL` = 0 before
// running phase 2.
//
// Usage: npm run backfill:shopping-lists (from backend/)
import 'dotenv/config'
import prisma from '../src/db/index.js'

async function main(): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true } })

  let listsCreated = 0
  let itemsUpdated = 0

  for (const { id: ownerId } of users) {
    let general = await prisma.shoppingList.findFirst({ where: { ownerId, isGeneral: true } })
    if (!general) {
      general = await prisma.shoppingList.create({
        data: { name: 'General', ownerId, isGeneral: true },
      })
      listsCreated++
    }

    const result = await prisma.shoppingItem.updateMany({
      where: { ownerId, listId: null },
      data: { listId: general.id },
    })
    itemsUpdated += result.count
  }

  const remaining = await prisma.shoppingItem.count({ where: { listId: null } })

  console.log(`Backfill complete: ${listsCreated} lists created, ${itemsUpdated} items updated.`)
  console.log(`ShoppingItem rows still with listId IS NULL: ${remaining}`)
  if (remaining > 0) {
    console.warn(
      'WARNING: some items were not backfilled (likely orphaned ownerId with no matching User). ' +
        'Do NOT run the phase-2 NOT NULL migration until this is 0.',
    )
    process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
