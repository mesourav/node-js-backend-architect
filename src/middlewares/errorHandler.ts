import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";

// 404 for any route that did not match.
export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, `Route ${req.method} ${req.originalUrl} not found`));
}

// Map known error types to the right HTTP status. Anything unknown is a real bug -> 500.
function toHttpError(err: unknown): { statusCode: number; message: string } {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message };
  }

  // Errors from Express's body parser (malformed JSON -> 400, body too large -> 413)
  // carry their own status and an `expose` flag saying the message is safe to show.
  if (isHttpError(err) && err.expose) {
    return { statusCode: err.status, message: err.message };
  }

  // Mongoose schema validation (a second safety net behind zod).
  if (err instanceof mongoose.Error.ValidationError) {
    return { statusCode: 400, message: err.message };
  }
  // Invalid ObjectId or wrong type in a query.
  if (err instanceof mongoose.Error.CastError) {
    return { statusCode: 400, message: `Invalid ${err.path}` };
  }
  // Unique index violation (e.g. registering an email that already exists).
  if (isDuplicateKeyError(err)) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? "field";
    return { statusCode: 409, message: `${field} already exists` };
  }

  return { statusCode: 500, message: err instanceof Error ? err.message : "Unknown error" };
}

function isHttpError(err: unknown): err is { status: number; expose: boolean; message: string } {
  return typeof err === "object" && err !== null && "status" in err && "expose" in err;
}

function isDuplicateKeyError(err: unknown): err is { code: 11000; keyValue?: object } {
  return typeof err === "object" && err !== null && "code" in err && err.code === 11000;
}

// Central error handler: Express recognises it because it takes 4 arguments.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const { statusCode, message } = toHttpError(err);

  if (statusCode >= 500) console.error(err);

  res.status(statusCode).json({
    success: false,
    // Never leak internal error details (DB errors, stack traces) in production.
    message: statusCode >= 500 && env.NODE_ENV === "production" ? "Internal server error" : message,
    ...(env.NODE_ENV === "development" && err instanceof Error && { stack: err.stack }),
  });
}
