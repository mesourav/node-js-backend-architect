import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { recalculateProductCounts } from "../modules/brand/brand.service";

// DATA MIGRATION: brands created before `productCount` existed have no count (it defaults
// to 0 on read, which is wrong for brands that have products). Adding a field to the
// schema doesn't change documents already in the database; a script like this does.
// Safe to run repeatedly: it recomputes every count from scratch.
async function main() {
  await connectDB();
  const updated = await recalculateProductCounts();
  logger.info({ brandsUpdated: updated }, "Brand product counts recalculated");
}

main()
  .catch((err: unknown) => {
    logger.error({ err }, "Backfill failed");
    process.exitCode = 1;
  })
  .finally(disconnectDB);
