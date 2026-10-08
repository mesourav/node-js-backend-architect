import { Router } from "express";
import healthRoutes from "../modules/health/health.routes";
import productRoutes from "../modules/product/product.routes";
import brandRoutes from "../modules/brand/brand.routes";

// Central API router: the single place that maps URL prefixes to feature modules.
// app.ts mounts this under /api/v1. A future breaking change gets a v2 router
// mounted next to it, so existing clients keep working.
const router = Router();

router.use("/health", healthRoutes);
router.use("/products", productRoutes);
router.use("/brands", brandRoutes);

export default router;
