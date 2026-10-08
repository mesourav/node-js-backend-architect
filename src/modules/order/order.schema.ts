import { z } from "zod";
import { objectIdSchema } from "../../utils/objectId";

// The client sends ONLY which products and how many. No prices, no totals:
// anything price-related sent by the client is stripped and recomputed on the server.
// (Trusting a client-sent price is a classic e-commerce vulnerability: "iPhone for ₹1".)
const orderItemInputSchema = z.object({
  productId: objectIdSchema,
  quantity: z.number().int().min(1).max(10),
});

export const createOrderSchema = z.object({
  items: z
    .array(orderItemInputSchema)
    .min(1, "An order needs at least one item")
    .max(20)
    .refine(
      (items) => new Set(items.map((i) => i.productId)).size === items.length,
      "Each product may appear only once; use quantity instead",
    ),
  shippingAddress: z.object({
    line1: z.string().trim().min(3).max(200),
    city: z.string().trim().min(2).max(80),
    postalCode: z.string().trim().min(3).max(12),
    country: z.string().trim().min(2).max(60),
  }),
});

export const orderIdSchema = z.object({ id: objectIdSchema });

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const topProductsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type TopProductsQuery = z.infer<typeof topProductsQuerySchema>;
