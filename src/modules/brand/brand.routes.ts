import { Router } from "express";
import { validate } from "../../middlewares/validate";
import * as controller from "./brand.controller";
import { brandIdSchema, brandSummaryQuerySchema, createBrandSchema } from "./brand.schema";

const router = Router();

router.get("/summary", validate({ query: brandSummaryQuerySchema }), controller.summary);
router.get("/", controller.list);
router.post("/", validate({ body: createBrandSchema }), controller.create);
router.get("/:id", validate({ params: brandIdSchema }), controller.getById);
router.delete("/:id", validate({ params: brandIdSchema }), controller.remove);

export default router;
