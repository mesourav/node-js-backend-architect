import { describe, expect, it } from "vitest";
import { registerSchema } from "../../src/modules/auth/auth.schema";

describe("registerSchema", () => {
  const valid = { name: "Sourav", email: "Sourav@Example.COM ", password: "secret123" };

  it("normalises the email to lowercase and trims it", () => {
    expect(registerSchema.parse(valid).email).toBe("sourav@example.com");
  });

  it("strips a `role` field so nobody can register as admin", () => {
    const parsed = registerSchema.parse({ ...valid, role: "admin" });
    expect(parsed).not.toHaveProperty("role");
  });

  // it.each: one test definition, many cases. Each row shows up as its own test.
  it.each([
    ["too short", "abc1", "at least 8 characters"],
    ["no number", "abcdefgh", "contain a number"],
    ["no letter", "12345678", "contain a letter"],
    ["longer than bcrypt's 72-byte limit", "a1".repeat(40), "at most 72 characters"],
  ])("rejects a password that is %s", (_case, password, expectedMessage) => {
    const result = registerSchema.safeParse({ ...valid, password });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain(expectedMessage);
  });
});
