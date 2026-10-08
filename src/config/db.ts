import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

export async function connectDB() {
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));

  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    // Connection pool: reuse up to 10 connections instead of opening one per request.
    maxPoolSize: 10,
    // Fail fast if Atlas is unreachable (IP not whitelisted, bad URI) instead of hanging.
    serverSelectionTimeoutMS: 5000,
  });
  logger.info({ db: env.MONGODB_DB_NAME }, "MongoDB connected");
}

export async function disconnectDB() {
  await mongoose.connection.close();
  logger.info("MongoDB connection closed");
}
