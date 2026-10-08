import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';

// 404 for any route that did not match.
export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, `Route ${req.method} ${req.originalUrl} not found`));
}

// Central error handler: Express recognises it because it takes 4 arguments.
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  // Never leak internal error details (DB errors, stack traces) in production.
  const message =
    statusCode === 500 && env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

  if (statusCode === 500) console.error(err);

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
