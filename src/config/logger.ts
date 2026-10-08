import pino from "pino";
import { env } from "./env";

// Structured JSON logs: one JSON object per line, with level, time and context fields.
// Log platforms (CloudWatch, Datadog, ELK) can then search and filter by any field,
// e.g. all errors for requestId=abc. In development we pretty-print for humans instead.
export const logger = pino({
  level: env.LOG_LEVEL,
  // Never write secrets to logs, even by accident.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "*.password",
    ],
    censor: "[REDACTED]",
  },
  ...(env.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
    },
  }),
});
