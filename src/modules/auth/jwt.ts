import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { USER_ROLES, UserRole } from "../user/user.model";

export type AuthUser = { id: string; role: UserRole };

const ISSUER = "shopapi";

// A JWT is a signed (not encrypted!) JSON token: anyone can read its payload,
// but only someone with the secret can create one the server will accept.
// So: put only non-sensitive data in it (user id + role), never passwords or emails.
export function signAccessToken(user: AuthUser) {
  return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: user.id, // standard "sub" claim = who the token is about
    expiresIn: env.JWT_ACCESS_TTL_SECONDS, // short-lived: a stolen token is useful only briefly
    issuer: ISSUER,
    algorithm: "HS256",
  });
}

// Throws if the signature is wrong, the token expired, or it was issued by someone else.
export function verifyAccessToken(token: string): AuthUser {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    // Pin the algorithm: never let the token itself choose how it is verified
    // (the classic "alg: none" / algorithm-confusion attack).
    algorithms: ["HS256"],
    issuer: ISSUER,
  });

  if (
    typeof payload === "string" ||
    !payload.sub ||
    !USER_ROLES.includes(payload.role as UserRole)
  ) {
    throw new jwt.JsonWebTokenError("Malformed token payload");
  }
  return { id: payload.sub, role: payload.role as UserRole };
}
