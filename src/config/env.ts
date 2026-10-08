import "dotenv/config";
import { z } from "zod";

// Validate env vars at startup: if config is wrong, crash immediately
// instead of failing later in production.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().startsWith("mongodb", "MONGODB_URI must be a MongoDB connection string"),
  MONGODB_DB_NAME: z.string().default("shopapi"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
