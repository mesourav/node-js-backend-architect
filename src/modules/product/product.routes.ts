import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth";
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

// Public reads. Fixed paths first, before /:id.
router.get("/stats", controller.productsStats);
router.get("/with-brand", validate({ query: productsWithBrandQuerySchema }), controller.withBrand);
router.get("/", validate({ query: listProductsQuerySchema }), controller.list);
router.get("/:id", validate({ params: productIdSchema }), controller.getById);

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
