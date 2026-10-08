import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { PRODUCT_CATEGORIES } from "./product.model";

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(2000).optional(),
  priceInCents: z.number().int().nonnegative(),
  category: z.enum(PRODUCT_CATEGORIES),
  stock: z.number().int().nonnegative().default(0),
  isActive: z.boolean().optional(),
});

// PATCH: every field optional, but at least one must be sent.
export const updateProductSchema = createProductSchema
  .omit({ stock: true })
  .extend({ stock: z.number().int().nonnegative() })
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update");

export const productIdSchema = z.object({
  id: z.string().refine((id) => isValidObjectId(id), "Invalid product id"),
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  search: z.string().trim().min(1).optional(),
  // Whitelist sortable fields so clients can't sort on arbitrary (unindexed) fields.
  sort: z
    .enum(["priceInCents", "-priceInCents", "createdAt", "-createdAt", "name", "-name"])
    .default("-createdAt"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
