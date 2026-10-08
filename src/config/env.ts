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
  REDIS_URL: z
    .string()
    .startsWith("redis", "REDIS_URL must be a redis:// URL")
    .default("redis://localhost:6379"),
  // A short secret can be brute-forced offline from any token, letting attackers forge tokens.
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900), // 15 minutes
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  // 12 in production; tests lower it (each +1 doubles hashing time).
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  // Number of proxies (load balancers) in front of the app. 0 locally; 1 behind an AWS ALB.
  // Needed so req.ip is the real client IP (from X-Forwarded-For), not the load balancer's.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Comma-separated browser origins allowed to call the API, e.g. "https://shop.example.com".
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300), // per IP, all API routes
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10), // failed logins per IP
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
