import "dotenv/config";
import { z } from "zod";

// Validate env vars at startup: if config is wrong, crash immediately
// instead of failing later in production.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  MONGODB_URI: z.string().startsWith("mongodb", "MONGODB_URI must be a MongoDB connection string"),
  MONGODB_DB_NAME: z.string().default("shopapi"),
  // A short secret can be brute-forced offline from any token, letting attackers forge tokens.
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900), // 15 minutes
  SEED_ADMIN_EMAIL: z.email().default("admin@shopapi.dev"),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // The logger is configured from these env vars, so it can't exist yet: console is the only option.
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
