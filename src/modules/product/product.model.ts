import { InferSchemaType, Schema, model } from "mongoose";

export const PRODUCT_CATEGORIES = ["electronics", "clothing", "books", "home", "sports"] as const;

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 2000 },
    // Store money as integer cents/paise to avoid floating point errors (0.1 + 0.2 !== 0.3).
    priceInCents: { type: Number, required: true, min: 0 },
    category: { type: String, enum: PRODUCT_CATEGORIES, required: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Indexes support the queries we actually run.
// Compound index for "active products in a category, sorted by price".
productSchema.index({ category: 1, isActive: 1, priceInCents: 1 });
// Text index for searching by name/description.
productSchema.index({ name: "text", description: "text" });

export type Product = InferSchemaType<typeof productSchema>;
export const ProductModel = model("Product", productSchema);
