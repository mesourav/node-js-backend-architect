import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB() {
  mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));
  mongoose.connection.on("reconnected", () => console.log("MongoDB reconnected"));

  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    // Connection pool: reuse up to 10 connections instead of opening one per request.
    maxPoolSize: 10,
    // Fail fast if Atlas is unreachable (IP not whitelisted, bad URI) instead of hanging.
    serverSelectionTimeoutMS: 5000,
  });
  console.log(`MongoDB connected (db: ${env.MONGODB_DB_NAME})`);
}

export async function disconnectDB() {
  await mongoose.connection.close();
  console.log("MongoDB connection closed");
}
