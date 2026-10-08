import { NextFunction, Request, Response } from "express";
import { z } from "zod";

type Schemas = { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType };

// Validates request parts against zod schemas. Invalid input never reaches
// the controller, and the parsed (typed, defaulted, coerced) values replace the raw ones.
export function validate(schemas: Schemas) {
  return function validateRequest(req: Request, res: Response, next: NextFunction) {
    const errors: { location: string; path: string; message: string }[] = [];
    const parsed: Partial<Record<keyof Schemas, unknown>> = {};

    for (const key of ["params", "query", "body"] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (result.success) {
        parsed[key] = result.data;
      } else {
        for (const issue of result.error.issues) {
          errors.push({ location: key, path: issue.path.join("."), message: issue.message });
        }
      }
    }

    if (errors.length) {
      return res
        .status(400)
        .json({ success: false, requestId: req.id, message: "Validation failed", errors });
    }

    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.params !== undefined) req.params = parsed.params as Request["params"];
    // In Express 5 req.query is a read-only getter, so the parsed query goes in res.locals.
    if (parsed.query !== undefined) res.locals.query = parsed.query;
    next();
  };
}
