import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { BrandModel } from "../modules/brand/brand.model";
import { ProductModel } from "../modules/product/product.model";
import { UserModel } from "../modules/user/user.model";

// Asks MongoDB HOW it executes our real API queries (npm run explain).
//   IXSCAN   = used an index (good)
//   COLLSCAN = read every document in the collection (bad at scale)
//   SORT     = sorted in memory because no index provides the order (bad at scale)
// The key ratio: docsExamined vs nReturned. Ideally they're close.

type PlanNode = {
  stage?: string;
  indexName?: string;
  inputStage?: PlanNode;
  inputStages?: PlanNode[];
};
type Explain = {
  queryPlanner: { winningPlan: PlanNode & { queryPlan?: PlanNode } };
  executionStats: { nReturned: number; totalKeysExamined: number; totalDocsExamined: number };
};

// Walk the plan tree: e.g. LIMIT <- FETCH <- IXSCAN(category_1_isActive_1_priceInCents_1)
function describePlan(node: PlanNode | undefined): string[] {
  if (!node) return [];
  const label = node.indexName ? `${node.stage}(${node.indexName})` : (node.stage ?? "?");
  const children = [node.inputStage, ...(node.inputStages ?? [])].flatMap(describePlan);
  return [label, ...children];
}

async function show(name: string, query: { explain(verbosity: string): unknown }) {
  const result = (await query.explain("executionStats")) as Explain;
  const { winningPlan } = result.queryPlanner;
  const stats = result.executionStats;
  logger.info(
    {
      plan: describePlan(winningPlan.queryPlan ?? winningPlan).join(" <- "),
      returned: stats.nReturned,
      keysExamined: stats.totalKeysExamined,
      docsExamined: stats.totalDocsExamined,
    },
    name,
  );
}

async function main() {
  await connectDB();
  // Indexes are built in the background on startup: wait for them before explaining.
  await Promise.all([ProductModel.init(), UserModel.init(), BrandModel.init()]);
  const brand = await BrandModel.findOne({ name: "Apple" }).lean();

  await show(
    "1. GET /products (default: newest first)",
    ProductModel.find({ isActive: true }).sort({ createdAt: -1 }).limit(20),
  );
  await show(
    "2. GET /products?category=books&sort=priceInCents",
    ProductModel.find({ isActive: true, category: "books" }).sort({ priceInCents: 1 }).limit(20),
  );
  await show("3. Products of one brand", ProductModel.find({ brand: brand?._id }));
  await show("4. Low stock (no index on stock)", ProductModel.find({ stock: { $lt: 10 } }));
  await show(
    "5. GET /products?search=design",
    ProductModel.find({ isActive: true, $text: { $search: "design" } }),
  );
  await show("6. Login: user by email", UserModel.find({ email: "admin@shopapi.dev" }));
}

main()
  .catch((err: unknown) => {
    logger.error({ err }, "Explain failed");
    process.exitCode = 1;
  })
  .finally(disconnectDB);
