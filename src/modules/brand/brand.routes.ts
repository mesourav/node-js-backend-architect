import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth";
import { cacheResponse } from "../../middlewares/cache";
import { validate } from "../../middlewares/validate";
import * as controller from "./brand.controller";
import { brandIdSchema, brandSummaryQuerySchema, createBrandSchema } from "./brand.schema";

const router = Router();

const adminOnly = [authenticate, authorize("admin")];

// Public reads, cached for 60s. Validation runs first, so invalid requests aren't cached.
const cached = cacheResponse("brands", 60);
router.get("/summary", validate({ query: brandSummaryQuerySchema }), cached, controller.summary);
router.get("/", cached, controller.list);
router.get("/:id", validate({ params: brandIdSchema }), cached, controller.getById);

// Admin writes.
router.post("/", ...adminOnly, validate({ body: createBrandSchema }), controller.create);
router.delete("/:id", ...adminOnly, validate({ params: brandIdSchema }), controller.remove);

export default router;
