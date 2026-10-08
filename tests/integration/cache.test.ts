import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { redis } from "../../src/config/redis";
import {
  TEST_PASSWORD,
  app,
  authHeader,
  createBrand,
  createProduct,
  createUser,
} from "../helpers/factories";

// Simulates a Redis outage for the duration of `fn`, then reconnects.
async function withRedisDown(fn: () => Promise<void>) {
  redis.disconnect();
  try {
    await fn();
  } finally {
    await redis.connect();
  }
}

describe("response caching (cache-aside)", () => {
  it("serves the second identical request from Redis", async () => {
    await createProduct({ name: "Laptop" });

    const first = await request(app).get("/api/v1/products");
    const second = await request(app).get("/api/v1/products");

    expect(first.headers["x-cache"]).toBe("MISS");
    expect(second.headers["x-cache"]).toBe("HIT");
    expect(second.body).toEqual(first.body); // identical response, MongoDB not queried
  });

  it("caches each query string separately", async () => {
    await request(app).get("/api/v1/products?page=1");
    const other = await request(app).get("/api/v1/products?page=2");
    expect(other.headers["x-cache"]).toBe("MISS");
  });

  it("does not cache error responses", async () => {
    const missing = "/api/v1/products/64b000000000000000000000";
    await request(app).get(missing).expect(404);
    const again = await request(app).get(missing).expect(404);
    expect(again.headers["x-cache"]).toBe("MISS");
  });
});

describe("cache invalidation", () => {
  it("a new product appears immediately, not after the TTL", async () => {
    const admin = authHeader(await createUser({ role: "admin" }));
    await request(app).get("/api/v1/products"); // cache the (empty) list

    await request(app)
      .post("/api/v1/products")
      .set("Authorization", admin)
      .send({ name: "Fresh", priceInCents: 100, category: "home" })
      .expect(201);

    const res = await request(app).get("/api/v1/products");
    expect(res.headers["x-cache"]).toBe("MISS");
    expect(res.body.data.map((p: { name: string }) => p.name)).toContain("Fresh");
  });

  it("a price change is visible immediately", async () => {
    const admin = authHeader(await createUser({ role: "admin" }));
    const product = await createProduct({ priceInCents: 1000 });
    const url = `/api/v1/products/${product.id}`;
    await request(app).get(url); // cache the old price

    await request(app).patch(url).set("Authorization", admin).send({ priceInCents: 500 });

    const res = await request(app).get(url);
    expect(res.body.data.priceInCents).toBe(500);
  });

  it("product changes also invalidate brand summaries (they include product data)", async () => {
    const admin = authHeader(await createUser({ role: "admin" }));
    const brand = await createBrand({ name: "Apple" });
    const before = await request(app).get("/api/v1/brands/summary");
    expect(before.body.data[0].productCount).toBe(0);

    await request(app)
      .post("/api/v1/products")
      .set("Authorization", admin)
      .send({ name: "iPhone", priceInCents: 100, category: "electronics", brand: brand.id })
      .expect(201);

    const after = await request(app).get("/api/v1/brands/summary");
    expect(after.body.data[0].productCount).toBe(1);
  });
});

describe("shared rate limit across instances", () => {
  // Two separately created apps = two API containers behind the load balancer.
  // They share only Redis, exactly like api-1 and api-2 in docker-compose.
  it("counts a client's attempts on ALL instances against one limit", async () => {
    const instanceA = createApp({ rateLimit: { authMax: 3 } });
    const instanceB = createApp({ rateLimit: { authMax: 3 } });
    const user = await createUser();
    function failLogin(instance: typeof instanceA) {
      return request(instance)
        .post("/api/v1/auth/login")
        .send({ email: user.email, password: "wrong-password1" });
    }

    expect((await failLogin(instanceA)).status).toBe(401);
    expect((await failLogin(instanceB)).status).toBe(401);
    expect((await failLogin(instanceA)).status).toBe(401);
    // 4th attempt, on the other instance. With per-instance memory counters,
    // B would have seen only 1 attempt and let it through.
    expect((await failLogin(instanceB)).status).toBe(429);

    const correct = await request(instanceA)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: TEST_PASSWORD });
    expect(correct.status).toBe(429);
  });
});

describe("when Redis is down", () => {
  it("still serves requests from MongoDB (cache bypassed)", async () => {
    await createProduct({ name: "Still here" });

    await withRedisDown(async () => {
      const res = await request(app).get("/api/v1/products");
      expect(res.status).toBe(200);
      expect(res.headers["x-cache"]).toBe("BYPASS");
      expect(res.body.data[0].name).toBe("Still here");
    });
  });

  it("writes still succeed even though invalidation can't run", async () => {
    const admin = authHeader(await createUser({ role: "admin" }));

    await withRedisDown(async () => {
      await request(app)
        .post("/api/v1/products")
        .set("Authorization", admin)
        .send({ name: "Written during outage", priceInCents: 1, category: "home" })
        .expect(201);
    });
  });

  it("the rate limiter fails open instead of blocking everyone", async () => {
    const strict = createApp({ rateLimit: { apiMax: 1 } });

    await withRedisDown(async () => {
      for (let i = 0; i < 3; i++) {
        await request(strict).get("/api/v1/products").expect(200);
      }
    });
  });

  it("readiness stays 200 but reports 'degraded'", async () => {
    await withRedisDown(async () => {
      const res = await request(app).get("/api/v1/health/ready");
      expect(res.status).toBe(200); // keep receiving traffic: Redis isn't critical
      expect(res.body.status).toBe("degraded");
      expect(res.body.checks.redis).toBe("down");
    });
  });
});
