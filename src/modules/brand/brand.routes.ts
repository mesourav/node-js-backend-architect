import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import * as controller from "./brand.controller";
import { brandIdSchema, brandSummaryQuerySchema, createBrandSchema } from "./brand.schema";

const router = Router();

const adminOnly = [authenticate, authorize("admin")];

// Public reads.
router.get("/summary", validate({ query: brandSummaryQuerySchema }), controller.summary);
router.get("/", controller.list);
router.get("/:id", validate({ params: brandIdSchema }), controller.getById);

// Admin writes.
router.post("/", ...adminOnly, validate({ body: createBrandSchema }), controller.create);
router.delete("/:id", ...adminOnly, validate({ params: brandIdSchema }), controller.remove);

export default router;
