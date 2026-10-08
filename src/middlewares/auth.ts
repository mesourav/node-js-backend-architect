import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError";
import { AuthUser, verifyAccessToken } from "../modules/auth/jwt";
import { UserRole } from "../modules/user/user.model";

// AUTHENTICATION: "who are you?"  -> 401 Unauthorized if we can't tell.
// Reads "Authorization: Bearer <token>", verifies it and sets req.user.
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Authentication required"));
  }

  // try/catch here is deliberate: we turn low-level JWT errors into clear 401s.
  try {
    req.user = verifyAccessToken(header.slice("Bearer ".length));
    next();
  } catch (err) {
    const message =
      err instanceof jwt.TokenExpiredError ? "Access token expired" : "Invalid access token";
    next(new AppError(401, message));
  }
}

// AUTHORIZATION: "are you allowed to do this?"  -> 403 Forbidden if not.
// Always used after authenticate: authorize("admin")
export function authorize(...allowedRoles: UserRole[]) {
  return function checkRole(req: Request, _res: Response, next: NextFunction) {
    if (!req.user) return next(new AppError(401, "Authentication required"));
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, "You do not have permission to perform this action"));
    }
    next();
  };
}

// For controllers behind authenticate: returns req.user, typed as always present.
export function getAuthUser(req: Request): AuthUser {
  if (!req.user) throw new AppError(401, "Authentication required");
  return req.user;
}
