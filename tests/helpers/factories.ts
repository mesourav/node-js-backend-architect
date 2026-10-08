import { randomUUID } from "node:crypto";
import { createApp } from "../../src/app";
import { hashPassword } from "../../src/modules/auth/auth.service";
import { signAccessToken } from "../../src/modules/auth/jwt";
import { BrandModel } from "../../src/modules/brand/brand.model";
import { ProductModel } from "../../src/modules/product/product.model";
import { CreateProductInput } from "../../src/modules/product/product.schema";
import { UserModel, UserRole } from "../../src/modules/user/user.model";

// Factories create test data straight in the DB: fast, and each test states only
// the fields it cares about. Everything else gets a sensible default.

// The real Express app, without listen(): supertest calls it in-process (no port needed).
export const app = createApp();

export const TEST_PASSWORD = "secret123";

export async function createUser(overrides: { role?: UserRole; email?: string } = {}) {
  return UserModel.create({
    name: "Test User",
    email: overrides.email ?? `user-${randomUUID()}@example.com`,
    passwordHash: await hashPassword(TEST_PASSWORD),
    role: overrides.role ?? "customer",
  });
}

// "Authorization" header value for a user, without going through /login.
export function authHeader(user: { _id: { toString(): string }; role: UserRole }) {
  return `Bearer ${signAccessToken({ id: user._id.toString(), role: user.role })}`;
}

export async function createBrand(overrides: { name?: string; country?: string } = {}) {
  return BrandModel.create({
    name: overrides.name ?? `Brand ${randomUUID().slice(0, 8)}`,
    country: overrides.country ?? "India",
  });
}

export async function createProduct(overrides: Partial<CreateProductInput> = {}) {
  return ProductModel.create({
    name: `Product ${randomUUID().slice(0, 8)}`,
    priceInCents: 10_000,
    category: "electronics",
    stock: 5,
    ...overrides,
  });
}
