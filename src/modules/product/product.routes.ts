import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth";
import { cacheResponse } from "../../middlewares/cache";
import { validate } from "../../middlewares/validate";
import * as controller from "./product.controller";
import {
  createProductSchema,
  listProductsQuerySchema,
  productIdSchema,
  productsWithBrandQuerySchema,
  updateProductSchema,
} from "./product.schema";

const router = Router();

// Only admins may change the catalogue. Reads stay public.
// Order matters: who are you (401) -> are you allowed (403) -> is the input valid (400).
const adminOnly = [authenticate, authorize("admin")];

// Public reads, cached for 60s. Fixed paths first, before /:id.
// Validation runs before the cache, so invalid requests never create cache entries.
const cached = cacheResponse("products", 60);
router.get("/stats", cached, controller.productsStats);
router.get(
  "/with-brand",
  validate({ query: productsWithBrandQuerySchema }),
  cached,
  controller.withBrand,
);
router.get("/", validate({ query: listProductsQuerySchema }), cached, controller.list);
router.get("/:id", validate({ params: productIdSchema }), cached, controller.getById);

// Admin writes.
router.post("/", ...adminOnly, validate({ body: createProductSchema }), controller.create);
router.patch(
  "/:id",
  ...adminOnly,
  validate({ params: productIdSchema, body: updateProductSchema }),
  controller.update,
);
router.delete("/:id", ...adminOnly, validate({ params: productIdSchema }), controller.remove);

export default router;
