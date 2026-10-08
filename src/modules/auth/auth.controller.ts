import { CookieOptions, Request, Response } from "express";
import { env } from "../../config/env";
import { getAuthUser } from "../../middlewares/auth";
import { AppError } from "../../utils/AppError";
import * as userService from "../user/user.service";
import * as authService from "./auth.service";
import { LoginInput, RegisterInput } from "./auth.schema";

const REFRESH_COOKIE = "refreshToken";

// Every option here is a security decision:
const refreshCookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript in the browser can't read it -> safe from XSS token theft
  secure: env.NODE_ENV === "production", // HTTPS only in production (localhost is plain HTTP)
  sameSite: "strict", // never sent on requests from other sites -> blocks CSRF
  path: "/api/v1/auth", // only sent to auth endpoints, not with every API call
};

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    ...refreshCookieOptions,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === "string" ? value : undefined;
}

export async function register(req: Request<object, unknown, RegisterInput>, res: Response) {
  const { auth, refreshToken } = await authService.register(req.body);
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ success: true, data: auth });
}

export async function login(req: Request<object, unknown, LoginInput>, res: Response) {
  const { auth, refreshToken } = await authService.login(req.body);
  setRefreshCookie(res, refreshToken);
  res.json({ success: true, data: auth });
}

// Called by the frontend when the access token expires (or on page load) to get a new one.
export async function refresh(req: Request, res: Response) {
  const token = readRefreshCookie(req);
  if (!token) throw new AppError(401, "Refresh token missing");

  const { auth, refreshToken } = await authService.refresh(token);
  setRefreshCookie(res, refreshToken); // rotation: the old cookie value is now dead
  res.json({ success: true, data: auth });
}

// Idempotent: logging out twice, or with no cookie, still succeeds.
export async function logout(req: Request, res: Response) {
  const token = readRefreshCookie(req);
  if (token) await authService.logout(token);
  // Clearing only works with the same path/options the cookie was set with.
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  res.status(204).send();
}

export async function logoutAll(req: Request, res: Response) {
  await authService.logoutAll(getAuthUser(req).id);
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  res.status(204).send();
}

export async function me(req: Request, res: Response) {
  // Load fresh from the DB rather than trusting the token alone: the account may
  // have been changed or deleted since the token was issued.
  const user = await userService.getUserById(getAuthUser(req).id);
  res.json({ success: true, data: userService.toPublicUser(user) });
}
