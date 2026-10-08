import express from "express";
import cookieParser from "cookie-parser";
import apiRoutes from "./routes";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import { requestLogger } from "./middlewares/requestLogger";

// app.ts builds the Express app but does NOT start listening.
// This lets tests import the app without opening a real port.
export function createApp() {
  const app = express();

  // First, so every request (including ones that fail body parsing) is logged with an id.
  app.use(requestLogger);
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser()); // fills req.cookies (used for the refresh token)

  app.use("/api/v1", apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
