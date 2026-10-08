import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    // bcrypt only uses the first 72 bytes: longer passwords would be silently truncated.
    .max(72, "Password must be at most 72 characters")
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/\d/, "Password must contain a number"),
  // Note: no `role` field. Zod strips unknown keys, so sending { "role": "admin" }
  // has no effect (prevents "mass assignment" privilege escalation).
});

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  // No strength rules on login: just "was something sent".
  password: z.string().min(1).max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
