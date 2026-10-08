import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import * as userService from "../user/user.service";
import { signAccessToken } from "./jwt";
import * as refreshTokenService from "./refreshToken.service";
import { LoginInput, RegisterInput } from "./auth.schema";

// Cost factor: each +1 doubles the hashing time. ~12 takes a few hundred ms, which is
// unnoticeable for one login but makes brute-forcing stolen hashes extremely slow.
const BCRYPT_ROUNDS = 12;

// Used when the email doesn't exist, so a login takes the same time either way.
// Otherwise attackers could tell registered emails apart by response time.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_ROUNDS);

export function hashPassword(password: string) {
  // bcrypt generates a random salt and stores it inside the hash string, so two users
  // with the same password get different hashes (defeats precomputed "rainbow tables").
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

type UserForAuth = Parameters<typeof userService.toPublicUser>[0];

function buildAuthResponse(user: UserForAuth) {
  const publicUser = userService.toPublicUser(user);
  return {
    user: publicUser,
    accessToken: signAccessToken({ id: publicUser.id, role: publicUser.role }),
    tokenType: "Bearer",
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
  };
}

// A new login session: short-lived access token (JSON body) + long-lived refresh token
// (the controller puts it in an httpOnly cookie, never in the body).
async function startSession(user: UserForAuth) {
  const auth = buildAuthResponse(user);
  const refreshToken = await refreshTokenService.issueRefreshToken(auth.user.id);
  return { auth, refreshToken };
}

export async function register(input: RegisterInput) {
  const passwordHash = await hashPassword(input.password);
  // Duplicate email -> MongoDB unique index error -> errorHandler returns 409.
  const user = await userService.createUser({
    name: input.name,
    email: input.email,
    passwordHash,
  });
  return startSession(user);
}

export async function login(input: LoginInput) {
  const user = await userService.findByEmailWithPassword(input.email);
  const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

  // Same message for "no such email" and "wrong password": don't reveal which emails exist.
  if (!user || !passwordMatches) {
    throw new AppError(401, "Invalid email or password");
  }
  return startSession(user);
}

export async function refresh(token: string) {
  const { userId, refreshToken } = await refreshTokenService.rotateRefreshToken(token);

  // Re-read the user: the new access token gets their CURRENT role, so a demoted admin
  // loses admin rights at the next refresh (at most JWT_ACCESS_TTL_SECONDS later).
  const user = await userService.findUserById(userId);
  if (!user) {
    await refreshTokenService.revokeAllForUser(userId);
    throw new AppError(401, "Invalid or expired refresh token");
  }
  return { auth: buildAuthResponse(user), refreshToken };
}

export async function logout(token: string) {
  await refreshTokenService.revokeSession(token);
}

export async function logoutAll(userId: string) {
  await refreshTokenService.revokeAllForUser(userId);
}
