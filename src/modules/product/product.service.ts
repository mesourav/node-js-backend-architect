import mongoose, { ClientSession, Types } from "mongoose";
import { AppError } from "../../utils/AppError";
import { invalidateCache } from "../../utils/cache";
import * as brandService from "../brand/brand.service";
import { ProductModel } from "./product.model";
import {
  CreateProductInput,
  ListProductsQuery,
  ProductsWithBrandQuery,
  UpdateProductInput,
} from "./product.schema";

// Service layer: business logic + DB access. Knows nothing about HTTP (req/res),
// so it can be reused from a script, a queue worker, or tests.

// The brand fields we expose when a product is shown with its brand.
type BrandSummary = { _id: Types.ObjectId; name: string; country: string };
const BRAND_FIELDS = "name country";

/**
 * TRANSACTION: "link to brand" and "insert product" must succeed or fail TOGETHER.
 * Without it, a crash between the two steps would leave brand.productCount wrong forever.
 *
 * connection.transaction() starts a session, runs the function, commits if it succeeds,
 * aborts (undoes everything) if it throws, and retries automatically on temporary
 * write conflicts. Every query inside MUST pass { session }, or it runs outside the
 * transaction and is NOT undone on abort.
 */
export async function createProduct(input: CreateProductInput) {
  const product = await mongoose.connection.transaction(async (session) => {
    if (input.brand) await brandService.linkProduct(input.brand, session);
    // create() needs the array form to accept a session.
    const [created] = await ProductModel.create([input], { session });
    return created;
  });
  await invalidateProductCaches();
  return product;
}

/**
 * Product changes make cached product responses stale, AND brand responses too
 * (brand summaries include product counts and prices).
 *
 * Always invalidate AFTER the transaction commits, never inside it. If we invalidated
 * first, a request arriving before the commit would read the OLD data from MongoDB and
 * put it straight back into the cache, where it would stay stale until the TTL expires.
 */
export async function invalidateProductCaches() {
  await invalidateCache("products", "brands");
}

/**
 * populate() = an application-side LEFT JOIN done by Mongoose in 2 queries:
 *   1. find the products page
 *   2. find all their brands at once: brands.find({ _id: { $in: [...brandIds] } })
 * then stitch them together in Node. Products without a brand get brand: null.
 */
export async function listProducts(q: ListProductsQuery) {
  const filter: Record<string, unknown> = { isActive: true };
  if (q.category) filter.category = q.category;
  if (q.brand) filter.brand = q.brand; // filtering by a reference needs no join at all
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.priceInCents = {
      ...(q.minPrice !== undefined && { $gte: q.minPrice }),
      ...(q.maxPrice !== undefined && { $lte: q.maxPrice }),
    };
  }
  if (q.search) filter.$text = { $search: q.search };

  const skip = (q.page - 1) * q.limit;

  // Run the page query and the count in parallel.
  const [items, total] = await Promise.all([
    ProductModel.find(filter)
      .sort(q.sort)
      .skip(skip)
      .limit(q.limit)
      .populate<{ brand: BrandSummary | null }>("brand", BRAND_FIELDS)
      .lean(),
    ProductModel.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit),
    },
  };
}

export async function getProductById(id: string) {
  const product = await ProductModel.findById(id)
    .populate<{ brand: BrandSummary | null }>("brand", BRAND_FIELDS)
    .lean();
  if (!product) throw new AppError(404, "Product not found");
  return product;
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const product = await mongoose.connection.transaction(async (session) => {
    const existing = await ProductModel.findById(id, { brand: 1 }).session(session).lean();
    if (!existing) throw new AppError(404, "Product not found");

    // Moving the product to another brand (or removing its brand) changes two counters.
    const oldBrand = existing.brand?.toString() ?? null;
    const newBrand = input.brand === undefined ? oldBrand : input.brand;
    if (newBrand !== oldBrand) {
      if (oldBrand) await brandService.unlinkProduct(oldBrand, session);
      if (newBrand) await brandService.linkProduct(newBrand, session);
    }

    const updated = await ProductModel.findByIdAndUpdate(id, input, {
      returnDocument: "after", // return the updated document, not the old one
      runValidators: true, // apply schema rules (min, enum...) on updates too
      session,
    }).lean();
    if (!updated) throw new AppError(404, "Product not found");
    return updated;
  });
  await invalidateProductCaches();
  return product;
}

/**
 * Used by the order module: atomically take `quantity` units out of stock.
 *
 * The check ("enough stock?") and the change ("subtract") are ONE conditional update.
 * Two customers buying the last unit at the same moment can't both succeed: the second
 * update finds stock < quantity, matches nothing, and fails. No overselling, no negative
 * stock. Returns the name/price BEFORE the update, for the order's snapshot.
 *
 * Runs inside the CALLER's transaction, so the caller must call invalidateProductCaches()
 * after committing (cached product responses include the stock level).
 */
export async function reserveStock(productId: string, quantity: number, session: ClientSession) {
  const product = await ProductModel.findOneAndUpdate(
    { _id: productId, isActive: true, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { session, projection: { name: 1, priceInCents: 1 } },
  ).lean();
  if (product) return product;

  // Nothing matched: find out why, to give the customer a useful error.
  const current = await ProductModel.findById(productId, { name: 1, stock: 1, isActive: 1 })
    .session(session)
    .lean();
  if (!current?.isActive) throw new AppError(400, `Product ${productId} is not available`);
  throw new AppError(409, `Not enough stock for "${current.name}": only ${current.stock} left`);
}

// Used by the order module when an order is cancelled: put the units back.
// If the product was deleted meanwhile, nothing matches, which is fine.
export async function releaseStock(productId: string, quantity: number, session: ClientSession) {
  await ProductModel.updateOne({ _id: productId }, { $inc: { stock: quantity } }, { session });
}

export async function deleteProduct(id: string) {
  await mongoose.connection.transaction(async (session) => {
    const product = await ProductModel.findByIdAndDelete(id, { session });
    if (!product) throw new AppError(404, "Product not found");
    if (product.brand) await brandService.unlinkProduct(product.brand.toString(), session);
  });
  await invalidateProductCaches();
}

type ProductWithBrand = {
  _id: Types.ObjectId;
  name: string;
  priceInCents: number;
  category: string;
  brand: BrandSummary | null;
};

/**
 * The same join done INSIDE the database with $lookup (one round trip).
 *
 * join=inner  SQL: SELECT p.*, b.name FROM products p INNER JOIN brands b ON b.id = p.brand_id
 *             -> only products that have a brand
 * join=left   SQL: SELECT p.*, b.name FROM products p LEFT JOIN brands b ON b.id = p.brand_id
 *             -> every product; brand is null when there is none
 */
export async function getProductsWithBrand(q: ProductsWithBrandQuery) {
  const items = await ProductModel.aggregate<ProductWithBrand>([
    { $match: { isActive: true } },
    {
      $lookup: {
        from: "brands",
        localField: "brand", // products.brand
        foreignField: "_id", // brands._id
        pipeline: [{ $project: { name: 1, country: 1 } }],
        as: "brand", // always an array: [] or [brandDoc]
      },
    },
    // $unwind turns the array into a single object (many-to-one relation).
    // By default it DROPS documents whose array is empty  -> INNER JOIN.
    // preserveNullAndEmptyArrays keeps them             -> LEFT JOIN.
    { $unwind: { path: "$brand", preserveNullAndEmptyArrays: q.join === "left" } },
    // $unwind removes the field entirely for kept empties; make it an explicit null.
    { $set: { brand: { $ifNull: ["$brand", null] } } },
    { $project: { name: 1, priceInCents: 1, category: 1, brand: 1 } },
    { $sort: { name: 1 } },
  ]);

  return { join: q.join, count: items.length, items };
}

type CategoryStats = {
  category: string;
  count: number;
  avgPriceInCents: number;
  minPriceInCents: number;
  maxPriceInCents: number;
};

export async function getProductsStats() {
  // aggregate() can't infer the output shape of a pipeline, so we declare it.
  const byCategory = await ProductModel.aggregate<CategoryStats>([
    { $match: { isActive: true } }, // 1. filter first: fewer documents to process
    {
      $group: {
        // 2. one bucket per category
        _id: "$category",
        count: { $sum: 1 },
        avgPriceInCents: { $avg: "$priceInCents" },
        minPriceInCents: { $min: "$priceInCents" },
        maxPriceInCents: { $max: "$priceInCents" },
      },
    },
    {
      $project: {
        // 3. tidy the output shape
        _id: 0,
        category: "$_id",
        count: 1,
        avgPriceInCents: { $round: ["$avgPriceInCents", 0] },
        minPriceInCents: 1,
        maxPriceInCents: 1,
      },
    },
    { $sort: { count: -1 } }, // 4. biggest category first
  ]);

  const totalProducts = byCategory.reduce((sum, c) => sum + c.count, 0);
  return { totalProducts, byCategory };
}
