import { InferSchemaType, Schema, model } from "mongoose";

export const USER_ROLES = ["customer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // unique -> DB-level guarantee: two concurrent registrations can't both succeed.
    // lowercase -> "Sourav@X.com" and "sourav@x.com" are the same account.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Never the plain password: only its bcrypt hash.
    // select: false -> excluded from every query unless explicitly asked for with .select("+passwordHash").
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: "customer", required: true },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = model("User", userSchema);
