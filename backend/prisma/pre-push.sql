-- Run this ONCE against your Neon database before running `prisma db push`.
-- It converts empty expiryDate strings to NULL so Postgres can change the
-- column type from TEXT to TIMESTAMP without failing.
--
-- Run via the Neon SQL editor or:
--   psql $DATABASE_URL_UNPOOLED -f pre-push.sql

UPDATE "Product"     SET "expiryDate" = NULL WHERE "expiryDate" = '';
UPDATE "ShoppingItem" SET "expiryDate" = NULL WHERE "expiryDate" = '';
