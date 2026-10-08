import type { UserRole } from "../modules/user/user.model";

// Teach TypeScript that our authenticate middleware adds `req.user`.
declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; role: UserRole };
  }
}
