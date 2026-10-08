import { Types } from "mongoose";
import { AppError } from "../../utils/AppError";
import { UserModel, UserRole } from "./user.model";

type UserDoc = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
};

// The only user shape that ever leaves the API. Building it field by field means a
// new sensitive field added to the model later can't leak by accident.
export function toPublicUser(user: UserDoc) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function createUser(input: { name: string; email: string; passwordHash: string }) {
  // role is never taken from input: every new account is a customer.
  return UserModel.create(input);
}

// The one place that reads the password hash (needed to check a login).
export async function findByEmailWithPassword(email: string) {
  return UserModel.findOne({ email: email.toLowerCase() }).select("+passwordHash").lean();
}

export async function getUserById(id: string) {
  const user = await UserModel.findById(id).lean();
  if (!user) throw new AppError(404, "User not found");
  return user;
}
