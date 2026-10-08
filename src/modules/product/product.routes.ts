import { Router } from "express";
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

// Fixed paths first, before /:id.
router.get("/stats", controller.productsStats);
router.get("/with-brand", validate({ query: productsWithBrandQuerySchema }), controller.withBrand);
router.get("/", validate({ query: listProductsQuerySchema }), controller.list);
router.post("/", validate({ body: createProductSchema }), controller.create);
router.get("/:id", validate({ params: productIdSchema }), controller.getById);
router.patch(
  "/:id",
  validate({ params: productIdSchema, body: updateProductSchema }),
  controller.update,
);
router.delete("/:id", validate({ params: productIdSchema }), controller.remove);
export default router;
