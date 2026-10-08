import express from "express";
import healthRoutes from "./routes/health.routes";
import productRoutes from "./modules/product/product.routes";
import { errorHandler, notFound } from "./middlewares/errorHandler";

// app.ts builds the Express app but does NOT start listening.
// This lets tests import the app without opening a real port.
export function createApp() {
  const app = express();

  app.use(express.json({ limit: "10kb" }));

  app.use("/api/v1/health", healthRoutes);
  app.use("/api/v1/products", productRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
