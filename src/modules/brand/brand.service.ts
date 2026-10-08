import mongoose, { Types } from "mongoose";
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

// Used by the product module to enforce the relationship. MongoDB has no foreign keys,
// so referential integrity is the application's job.
export async function assertBrandExists(id: string) {
  const exists = await BrandModel.exists({ _id: id });
  if (!exists) throw new AppError(400, `Brand ${id} does not exist`);
}

// Like SQL's ON DELETE RESTRICT: a brand can only be deleted when no product references it.
export async function deleteBrand(id: string) {
  // 1. Count products that point to this brand: active AND inactive, otherwise an
  //    inactive product would be left pointing to a brand that no longer exists.
  //    We use the raw collection (not a Mongoose model), which does NOT convert
  //    strings to ObjectIds for us, so we convert the id ourselves.
  const productCount = await mongoose.connection
    .collection(PRODUCTS_COLLECTION)
    .countDocuments({ brand: new Types.ObjectId(id) });

  // 2. Still in use -> refuse with 409 Conflict.
  if (productCount > 0) {
    throw new AppError(409, `Cannot delete brand: ${productCount} product(s) still use it`);
  }

  // 3. Delete. null means there was no brand with this id -> 404.
  const deleted = await BrandModel.findByIdAndDelete(id);
  if (!deleted) throw new AppError(404, "Brand not found");
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
