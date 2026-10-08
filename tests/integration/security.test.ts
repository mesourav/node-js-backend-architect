import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { TEST_PASSWORD, app, createProduct, createUser } from "../helpers/factories";

describe("security headers (helmet)", () => {
  it("sets protective headers and hides the framework", async () => {
    const res = await request(app).get("/api/v1/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined(); // no "Express" advertised
  });
});

describe("CORS", () => {
  it("allows a whitelisted origin, with credentials (needed for the refresh cookie)", async () => {
    const res = await request(app).get("/api/v1/products").set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not allow other origins", async () => {
    const res = await request(app).get("/api/v1/products").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers the browser's preflight request", async () => {
    const res = await request(app)
      .options("/api/v1/products")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Authorization, Content-Type");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });
});

describe("NoSQL injection", () => {
  // Classic attack: {"$ne": null} means "not equal to null", which matches ANY user.
  // Without validation, findOne({ email: { $ne: null } }) would return the first user.
  it("rejects query operators where a string is expected", async () => {
    await createUser({ email: "victim@example.com" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: { $ne: null }, password: { $ne: null } });

    expect(res.status).toBe(400); // zod: "expected string, received object"
  });

  it("never turns query-string brackets into MongoDB operators", async () => {
    await createProduct({ name: "A Book", category: "books" });
    await createProduct({ name: "A Laptop", category: "electronics" });

    // Express 4's "extended" parser turned ?category[$ne]=books into
    // { category: { $ne: "books" } }, an injection risk. Express 5's default "simple"
    // parser keeps it as a plain key "category[$ne]", which zod then strips as unknown.
    // So no filter is applied at all: the operator never reaches MongoDB.
    const res = await request(app).get("/api/v1/products?category[$ne]=books");

    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { name: string }) => p.name).sort()).toEqual([
      "A Book",
      "A Laptop",
    ]);
  });
});

describe("rate limiting", () => {
  // A separate app with tiny limits: the shared test app uses very high ones.
  const limitedApp = createApp({ rateLimit: { authMax: 3, apiMax: 5 } });

  it("blocks login after too many FAILED attempts, with Retry-After", async () => {
    const user = await createUser();
    function attempt() {
      return request(limitedApp)
        .post("/api/v1/auth/login")
        .send({ email: user.email, password: "wrong-password1" });
    }

    for (let i = 0; i < 3; i++) {
      expect((await attempt()).status).toBe(401);
    }
    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(blocked.body.message).toMatch(/too many requests/i);

    // Even the CORRECT password is refused now: the attacker can't keep guessing.
    const correct = await request(limitedApp)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: TEST_PASSWORD });
    expect(correct.status).toBe(429);
  });

  it("does not count successful logins", async () => {
    const app2 = createApp({ rateLimit: { authMax: 2 } });
    const user = await createUser();

    for (let i = 0; i < 5; i++) {
      const res = await request(app2)
        .post("/api/v1/auth/login")
        .send({ email: user.email, password: TEST_PASSWORD });
      expect(res.status).toBe(200);
    }
  });

  it("limits general API traffic but never health checks", async () => {
    const app3 = createApp({ rateLimit: { apiMax: 2 } });

    await request(app3).get("/api/v1/products").expect(200);
    await request(app3).get("/api/v1/products").expect(200);
    await request(app3).get("/api/v1/products").expect(429);

    // Load balancer probes must keep working even when the client is limited.
    await request(app3).get("/api/v1/health/ready").expect(200);
  });
});

describe("health checks", () => {
  it("liveness reports the process is up", async () => {
    const res = await request(app).get("/api/v1/health/live");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("readiness checks the database", async () => {
    const res = await request(app).get("/api/v1/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.checks.mongodb).toBe("up");
  });
});
