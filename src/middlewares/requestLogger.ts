import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import { logger } from "../config/logger";

// Logs one line per request (method, url, status, response time) and attaches
// `req.log`, a child logger that stamps every log line with the request id.
export const requestLogger = pinoHttp({
  logger,
  // Reuse the id from an upstream load balancer/gateway if present, so one request
  // can be traced across services; otherwise generate one. Echo it back to the client.
  genReqId(req, res) {
    const incoming = req.headers["x-request-id"];
    const id = typeof incoming === "string" && incoming.length <= 100 ? incoming : randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  // Health checks run every few seconds from load balancers/Kubernetes: don't flood the logs.
  autoLogging: { ignore: (req) => req.url?.startsWith("/api/v1/health") ?? false },
  serializers: {
    req: (req: { id: string; method: string; url: string }) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
});
