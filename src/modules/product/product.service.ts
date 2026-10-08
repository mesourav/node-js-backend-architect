import { Types } from "mongoose";
import { AppError } from "../../utils/AppError";
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

export async function createProduct(input: CreateProductInput) {
  // No foreign keys in MongoDB: check the referenced brand exists ourselves.
  if (input.brand) await brandService.assertBrandExists(input.brand);
  return ProductModel.create(input);
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
  if (input.brand) await brandService.assertBrandExists(input.brand);
  const product = await ProductModel.findByIdAndUpdate(id, input, {
    returnDocument: "after", // return the updated document, not the old one
    runValidators: true, // apply schema rules (min, enum...) on updates too
  }).lean();
  if (!product) throw new AppError(404, "Product not found");
  return product;
}

export async function deleteProduct(id: string) {
  const product = await ProductModel.findByIdAndDelete(id);
  if (!product) throw new AppError(404, "Product not found");
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
