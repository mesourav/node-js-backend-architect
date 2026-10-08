import { ClientSession, Types } from "mongoose";
import { AppError } from "../../utils/AppError";
import { BrandModel } from "./brand.model";
import { BrandSummaryQuery, CreateBrandInput } from "./brand.schema";

// We join against the products COLLECTION by name instead of importing ProductModel:
// modules don't reach into each other's models.
const PRODUCTS_COLLECTION = "products";

export async function createBrand(input: CreateBrandInput) {
  return BrandModel.create(input);
}

export async function listBrands() {
  return BrandModel.find().sort("name").lean();
}

// Called by the product service INSIDE its transaction when a product starts using a brand.
// MongoDB has no foreign keys, so referential integrity is the application's job.
// "Increment only if the brand exists" is one atomic operation: if the brand was just
// deleted, nothing matches and we refuse the link.
export async function linkProduct(brandId: string, session: ClientSession) {
  const brand = await BrandModel.findByIdAndUpdate(
    brandId,
    { $inc: { productCount: 1 } },
    { session },
  );
  if (!brand) throw new AppError(400, `Brand ${brandId} does not exist`);
}

// Called by the product service INSIDE its transaction when a product stops using a brand.
export async function unlinkProduct(brandId: string, session: ClientSession) {
  await BrandModel.updateOne({ _id: brandId }, { $inc: { productCount: -1 } }, { session });
}

// Like SQL's ON DELETE RESTRICT: a brand can only be deleted when no product references it.
//
// The old version did "count products" then "delete brand" as two steps, with a race:
// a product could be linked in between. Now it is ONE atomic command on the brand
// document: "delete it only if productCount is 0". Linking a product also writes to this
// same document (inside a transaction), so MongoDB serialises the two: they can't both win.
export async function deleteBrand(id: string) {
  const deleted = await BrandModel.findOneAndDelete({ _id: id, productCount: 0 });
  if (deleted) return;

  // Nothing deleted: either the brand doesn't exist, or it is still in use.
  const brand = await BrandModel.findById(id, { productCount: 1 }).lean();
  if (!brand) throw new AppError(404, "Brand not found");
  throw new AppError(409, `Cannot delete brand: ${brand.productCount} product(s) still use it`);
}

// Recomputes every brand's productCount from the products collection. Used by the
// backfill script for data created before productCount existed (a "data migration").
export async function recalculateProductCounts() {
  const counts = await BrandModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $lookup: {
        from: PRODUCTS_COLLECTION,
        localField: "_id",
        foreignField: "brand",
        pipeline: [{ $project: { _id: 1 } }],
        as: "products",
      },
    },
    { $project: { count: { $size: "$products" } } },
  ]);
  if (counts.length === 0) return 0;

  await BrandModel.bulkWrite(
    counts.map((c) => ({
      updateOne: { filter: { _id: c._id }, update: { $set: { productCount: c.count } } },
    })),
  );
  return counts.length;
}

/**
 * One-to-many: a brand together with its products.
 *
 * SQL:  SELECT b.*, p.* FROM brands b LEFT JOIN products p ON p.brand_id = b.id
 *       WHERE b.id = ?
 */
export async function getBrandWithProducts(id: string) {
  const [brand] = await BrandModel.aggregate<Record<string, unknown>>([
    // aggregate() does NOT cast types like find() does: convert the string to an ObjectId
    // ourselves, or the $match silently finds nothing.
    { $match: { _id: new Types.ObjectId(id) } },
    {
      $lookup: {
        from: PRODUCTS_COLLECTION,
        localField: "_id", // brands._id
        foreignField: "brand", // products.brand   (index on products.brand keeps this fast)
        // Extra conditions + only the fields we need, run inside the join.
        pipeline: [
          { $match: { isActive: true } },
          { $project: { name: 1, priceInCents: 1, category: 1, stock: 1 } },
          { $sort: { priceInCents: -1 } },
        ],
        as: "products", // result is an ARRAY (empty if no matches)
      },
    },
  ]);

  if (!brand) throw new AppError(404, "Brand not found");
  return brand;
}

type BrandSummary = {
  _id: Types.ObjectId;
  name: string;
  country: string;
  productCount: number;
  avgPriceInCents: number | null;
  inventoryValueInCents: number;
};

/**
 * Every brand with aggregated numbers about its products.
 * Demonstrates LEFT OUTER JOIN, INNER JOIN and ANTI JOIN with a single pipeline.
 *
 * SQL:  SELECT b.name, COUNT(p.id), AVG(p.price), SUM(p.price * p.stock)
 *       FROM brands b LEFT JOIN products p ON p.brand_id = b.id AND p.is_active
 *       GROUP BY b.id
 *       HAVING COUNT(p.id) > 0     -- hasProducts=true  (same rows as an INNER JOIN)
 *       HAVING COUNT(p.id) = 0     -- hasProducts=false (ANTI JOIN: "brands with no products")
 */
export async function getBrandsSummary(q: BrandSummaryQuery) {
  return BrandModel.aggregate<BrandSummary>([
    // $lookup is always a LEFT OUTER JOIN: brands with no products get `products: []`.
    {
      $lookup: {
        from: PRODUCTS_COLLECTION,
        localField: "_id",
        foreignField: "brand",
        pipeline: [{ $match: { isActive: true } }, { $project: { priceInCents: 1, stock: 1 } }],
        as: "products",
      },
    },
    // Aggregate over the joined array (like GROUP BY brand).
    {
      $project: {
        name: 1,
        country: 1,
        productCount: { $size: "$products" },
        avgPriceInCents: { $round: [{ $avg: "$products.priceInCents" }, 0] },
        inventoryValueInCents: {
          $sum: {
            $map: {
              input: "$products",
              as: "p",
              in: { $multiply: ["$$p.priceInCents", "$$p.stock"] },
            },
          },
        },
      },
    },
    // Turn the LEFT join into an INNER or ANTI join by filtering on the match count.
    ...(q.hasProducts === true ? [{ $match: { productCount: { $gt: 0 } } }] : []),
    ...(q.hasProducts === false ? [{ $match: { productCount: 0 } }] : []),
    { $sort: { inventoryValueInCents: -1, name: 1 } },
  ]);
}
