import { z } from "zod";
import { objectIdSchema } from "../../utils/objectId";

export const createBrandSchema = z.object({
  name: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(60),
  website: z.url().optional(),
});

export const brandIdSchema = z.object({ id: objectIdSchema });

export const brandSummaryQuerySchema = z.object({
  // true  -> only brands that have products     (INNER JOIN)
  // false -> only brands that have NO products  (ANTI JOIN)
  // unset -> all brands, products or not        (LEFT OUTER JOIN)
  hasProducts: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type BrandSummaryQuery = z.infer<typeof brandSummaryQuerySchema>;
