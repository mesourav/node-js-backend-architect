import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Runs ONCE before all test files: starts an in-memory MongoDB.
    globalSetup: ["tests/globalSetup.ts"],
    // Runs before EACH test file: connects to it and cleans data between tests.
    setupFiles: ["tests/setup.mts"],
    // Set before any app code loads. dotenv never overrides existing variables, so these
    // win over .env -- in particular the real Atlas MONGODB_URI is replaced by a dummy
    // value that can't connect anywhere. Tests can never touch real data.
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      MONGODB_URI: "mongodb://tests-use-the-in-memory-server",
      JWT_ACCESS_SECRET: "test-only-secret-at-least-32-characters-long",
      BCRYPT_ROUNDS: "4", // fast hashing in tests
      // High limits so normal tests never hit them; the rate-limit test sets its own.
      RATE_LIMIT_MAX: "100000",
      AUTH_RATE_LIMIT_MAX: "100000",
    },
    // First run downloads a MongoDB binary (~100MB), which can take a while.
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Entry points and scripts are exercised by running the app, not by tests.
      exclude: ["src/server.ts", "src/scripts/**", "src/types/**"],
      reporter: ["text", "html"],
    },
  },
});
