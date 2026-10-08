import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authService from "../../src/modules/auth/auth.service";
import * as refreshTokenService from "../../src/modules/auth/refreshToken.service";
import * as userService from "../../src/modules/user/user.service";

// MOCKING: replace the service's dependencies with fakes we control, so this test
// checks auth.service's own logic only. vi.mock calls are hoisted above the imports.
vi.mock("../../src/modules/user/user.service", async (importOriginal) => ({
  ...(await importOriginal<typeof userService>()), // keep the real toPublicUser
  findByEmailWithPassword: vi.fn(),
}));
vi.mock("../../src/modules/auth/refreshToken.service", () => ({
  issueRefreshToken: vi.fn().mockResolvedValue("fake-refresh-token"),
}));

type UserWithPassword = Awaited<ReturnType<typeof userService.findByEmailWithPassword>>;

async function fakeUser(password: string): Promise<UserWithPassword> {
  return {
    _id: new Types.ObjectId(),
    name: "Test",
    email: "test@example.com",
    role: "customer",
    passwordHash: await authService.hashPassword(password),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as UserWithPassword;
}

describe("authService.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tokens for the right password", async () => {
    vi.mocked(userService.findByEmailWithPassword).mockResolvedValue(await fakeUser("secret123"));

    const result = await authService.login({ email: "test@example.com", password: "secret123" });

    expect(result.auth.user.email).toBe("test@example.com");
    expect(result.auth.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toBe("fake-refresh-token");
  });

  it("gives the SAME error for a wrong password and an unknown email", async () => {
    vi.mocked(userService.findByEmailWithPassword).mockResolvedValue(await fakeUser("secret123"));
    const wrongPassword = authService.login({ email: "test@example.com", password: "nope1234" });

    await expect(wrongPassword).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid email or password",
    });

    vi.mocked(userService.findByEmailWithPassword).mockResolvedValue(null);
    const unknownEmail = authService.login({ email: "nobody@example.com", password: "nope1234" });

    await expect(unknownEmail).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid email or password",
    });
    // A failed login must never start a session.
    expect(refreshTokenService.issueRefreshToken).not.toHaveBeenCalled();
  });
});
