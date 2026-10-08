import request, { Response } from "supertest";
import { describe, expect, it } from "vitest";
import { UserModel } from "../../src/modules/user/user.model";
import { TEST_PASSWORD, app, createUser } from "../helpers/factories";

// INTEGRATION test: real HTTP requests through the whole stack
// (routes -> middleware -> controller -> service -> real MongoDB).

// "refreshToken=abc; Path=...; HttpOnly" -> "refreshToken=abc"
function refreshCookie(res: Response) {
  const cookie = res.get("Set-Cookie")?.find((c) => c.startsWith("refreshToken="));
  return cookie?.split(";")[0];
}

async function login(email: string) {
  return request(app).post("/api/v1/auth/login").send({ email, password: TEST_PASSWORD });
}

describe("POST /api/v1/auth/register", () => {
  it("creates a customer even if the request asks for admin", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Sourav", email: "Sourav@Example.com", password: "secret123", role: "admin" });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: "sourav@example.com", role: "customer" });
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("sets the refresh token as a secure cookie, not in the body", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Sourav", email: "sourav@example.com", password: "secret123" });

    const cookie = res.get("Set-Cookie")?.find((c) => c.startsWith("refreshToken="));
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/api/v1/auth");
    expect(JSON.stringify(res.body)).not.toContain("refreshToken");
  });

  it("returns 409 for an email that is already registered", async () => {
    await createUser({ email: "taken@example.com" });

    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Again", email: "TAKEN@example.com", password: "secret123" });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/v1/auth/login", () => {
  it("returns the same 401 for a wrong password and an unknown email", async () => {
    await createUser({ email: "real@example.com" });

    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "real@example.com", password: "wrong1234" });
    const unknownEmail = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "ghost@example.com", password: "wrong1234" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("requires a token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the logged-in user", async () => {
    const user = await createUser();
    const { body } = await login(user.email);

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user._id.toString());
  });
});

describe("refresh tokens", () => {
  it("rotates: each refresh returns a new token and a new cookie", async () => {
    const user = await createUser();
    const firstCookie = refreshCookie(await login(user.email));

    const res = await request(app).post("/api/v1/auth/refresh").set("Cookie", firstCookie!);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).not.toBe(firstCookie);
  });

  it("detects reuse of an old token and revokes the whole session", async () => {
    const user = await createUser();
    const stolen = refreshCookie(await login(user.email));
    const rotated = await request(app).post("/api/v1/auth/refresh").set("Cookie", stolen!);
    const current = refreshCookie(rotated);

    // The attacker replays the already-used token...
    const attacker = await request(app).post("/api/v1/auth/refresh").set("Cookie", stolen!);
    expect(attacker.status).toBe(401);

    // ...so the real user's newest token is revoked too.
    const victim = await request(app).post("/api/v1/auth/refresh").set("Cookie", current!);
    expect(victim.status).toBe(401);
  });

  it("gives the new access token the user's CURRENT role", async () => {
    const user = await createUser({ role: "customer" });
    const cookie = refreshCookie(await login(user.email));
    await UserModel.updateOne({ _id: user._id }, { role: "admin" });

    const res = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie!);

    expect(res.body.data.user.role).toBe("admin");
  });

  it("returns 401 without a cookie", async () => {
    const res = await request(app).post("/api/v1/auth/refresh");
    expect(res.status).toBe(401);
  });
});

describe("logout", () => {
  it("revokes the session on the server, not just the cookie", async () => {
    const user = await createUser();
    const cookie = refreshCookie(await login(user.email));

    const logout = await request(app).post("/api/v1/auth/logout").set("Cookie", cookie!);
    expect(logout.status).toBe(204);

    // Replaying the token after logout must fail.
    const replay = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie!);
    expect(replay.status).toBe(401);
  });

  it("logout-all ends the sessions on every device", async () => {
    const user = await createUser();
    const laptop = refreshCookie(await login(user.email));
    const phone = await login(user.email);

    await request(app)
      .post("/api/v1/auth/logout-all")
      .set("Authorization", `Bearer ${phone.body.data.accessToken}`)
      .expect(204);

    const res = await request(app).post("/api/v1/auth/refresh").set("Cookie", laptop!);
    expect(res.status).toBe(401);
  });
});
