import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

export async function connectDB() {
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));
  // An "error" event with no listener crashes a Node process. The driver reconnects
  // by itself, so we only need to log it.
  mongoose.connection.on("error", (err) => logger.error({ err }, "MongoDB connection error"));

  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    // Connection pool: reuse up to 10 connections instead of opening one per request.
    maxPoolSize: 10,
    // Fail fast if Atlas is unreachable (IP not whitelisted, bad URI) instead of hanging.
    serverSelectionTimeoutMS: 5000,
  });
  logger.info({ db: env.MONGODB_DB_NAME }, "MongoDB connected");
}

// A real round trip to the database, not just "is the socket open".
export async function isDBHealthy() {
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected) return false;
  try {
    await mongoose.connection.db?.admin().ping();
    return true;
  } catch {
    return false;
  }
}

export async function disconnectDB() {
  await mongoose.connection.close();
  logger.info("MongoDB connection closed");
}
