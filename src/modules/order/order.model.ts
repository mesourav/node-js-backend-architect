import { InferSchemaType, Schema, model } from "mongoose";

export const ORDER_STATUSES = ["placed", "cancelled"] as const;

// One line of an order. EMBEDDED in the order (not its own collection): items are always
// read and written together with their order and never exist on their own.
const orderItemSchema = new Schema(
  {
    // Reference: which product was bought (for reports, "buy again" links, etc.).
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    // SNAPSHOT: copied from the product at purchase time and never updated.
    // If the price changes tomorrow, or the product is deleted, this order must still
    // show what the customer actually paid. An order is a historical/legal record.
    name: { type: String, required: true },
    priceInCents: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalInCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const shippingAddressSchema = new Schema(
  {
    line1: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: {
      type: [orderItemSchema],
      validate: [(items: unknown[]) => items.length > 0, "An order needs at least one item"],
    },
    totalInCents: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ORDER_STATUSES, default: "placed", required: true },
    // Embedded too: an address snapshot, unaffected if the user edits their profile later.
    shippingAddress: { type: shippingAddressSchema, required: true },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// "My orders, newest first": equality on user, then sort on createdAt (ESR).
orderSchema.index({ user: 1, createdAt: -1 });

export type Order = InferSchemaType<typeof orderSchema>;
export const OrderModel = model("Order", orderSchema);
