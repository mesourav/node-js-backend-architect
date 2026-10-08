import { InferSchemaType, Schema, model } from "mongoose";

const brandSchema = new Schema(
  {
    // unique creates a unique index: the DB itself rejects duplicates (-> 409 in errorHandler).
    name: { type: String, required: true, trim: true, maxlength: 80, unique: true },
    country: { type: String, required: true, trim: true, maxlength: 60 },
    website: { type: String, trim: true },
  },
  { timestamps: true },
);

export type Brand = InferSchemaType<typeof brandSchema>;
// Mongoose stores this model in the "brands" collection (lowercased + pluralised).
export const BrandModel = model("Brand", brandSchema);
