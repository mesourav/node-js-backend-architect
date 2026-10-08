import { Request, Response } from "express";
import { getAuthUser } from "../../middlewares/auth";
import * as userService from "../user/user.service";
import * as authService from "./auth.service";
import { LoginInput, RegisterInput } from "./auth.schema";

export async function register(req: Request<object, unknown, RegisterInput>, res: Response) {
  const result = await authService.register(req.body);
  res.status(201).json({ success: true, data: result });
}

export async function login(req: Request<object, unknown, LoginInput>, res: Response) {
  const result = await authService.login(req.body);
  res.json({ success: true, data: result });
}

export async function me(req: Request, res: Response) {
  // Load fresh from the DB rather than trusting the token alone: the account may
  // have been changed or deleted since the token was issued.
  const user = await userService.getUserById(getAuthUser(req).id);
  res.json({ success: true, data: userService.toPublicUser(user) });
}
