import { createHash, randomBytes, randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { AppError } from "../../utils/AppError";
import { RefreshTokenModel } from "./refreshToken.model";

const DAY_MS = 24 * 60 * 60 * 1000;

// SHA-256, not bcrypt: the token is 48 random bytes (impossible to guess), so a slow hash
// adds nothing, and a fast deterministic hash lets us look the token up by its hash.
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// A refresh token is NOT a JWT: just a long random string. All its meaning
// (user, expiry, revoked?) lives in the database, where we control it.
export async function issueRefreshToken(userId: string, familyId: string = randomUUID()) {
  const token = randomBytes(48).toString("base64url");
  await RefreshTokenModel.create({
    user: userId,
    tokenHash: hashToken(token),
    familyId,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
  });
  return token;
}

/**
 * Rotation: every refresh token can be used exactly ONCE. Using it returns a new one
 * (same family) and revokes the old one.
 *
 * Reuse detection: if an already-used token shows up again, two parties hold the same
 * token, so one of them stole it. We can't tell which, so we revoke the whole family:
 * both are logged out, and the real user just logs in again.
 */
export async function rotateRefreshToken(token: string) {
  const tokenHash = hashToken(token);

  // Atomic "check and revoke" in ONE operation. With a separate find() then update(),
  // two simultaneous requests could both see revokedAt: null and both get new tokens.
  const current = await RefreshTokenModel.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date() } },
  ).lean();

  if (!current) {
    const existing = await RefreshTokenModel.findOne({ tokenHash }).lean();
    if (existing?.revokedAt) {
      await revokeFamily(existing.familyId);
      logger.warn(
        { userId: existing.user.toString(), familyId: existing.familyId },
        "Refresh token reuse detected: session revoked",
      );
    }
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const userId = current.user.toString();
  const refreshToken = await issueRefreshToken(userId, current.familyId);
  return { userId, refreshToken };
}

// Logout from this device: end the token's whole session (family).
export async function revokeSession(token: string) {
  const doc = await RefreshTokenModel.findOne({ tokenHash: hashToken(token) }).lean();
  if (doc) await revokeFamily(doc.familyId);
}

// Logout from every device (e.g. after a password change or a suspected compromise).
export async function revokeAllForUser(userId: string) {
  await RefreshTokenModel.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

async function revokeFamily(familyId: string) {
  await RefreshTokenModel.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}
