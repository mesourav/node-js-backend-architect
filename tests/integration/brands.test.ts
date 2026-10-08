import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, authHeader, createBrand, createProduct, createUser } from "../helpers/factories";

const BRANDS = "/api/v1/brands";

describe("joins between brands and products", () => {
  // Apple has 2 products, Bose has none, and one product has no brand:
  // exactly the gaps that make inner / left / anti joins give different results.
  beforeEach(async () => {
    const apple = await createBrand({ name: "Apple" });
    await createBrand({ name: "Bose" });
    await createProduct({ name: "iPhone", brand: apple._id.toString(), priceInCents: 1000 });
    await createProduct({ name: "MacBook", brand: apple._id.toString(), priceInCents: 3000 });
    await createProduct({ name: "Yoga Mat", brand: null });
  });

  it("LEFT JOIN brands -> products includes brands without products", async () => {
    const res = await request(app).get(`${BRANDS}/summary`);

    expect(res.body.data).toEqual([
      expect.objectContaining({ name: "Apple", productCount: 2, avgPriceInCents: 2000 }),
      expect.objectContaining({ name: "Bose", productCount: 0, avgPriceInCents: null }),
    ]);
  });

  it("INNER JOIN keeps only brands with products; ANTI JOIN only those without", async () => {
    const inner = await request(app).get(`${BRANDS}/summary?hasProducts=true`);
    const anti = await request(app).get(`${BRANDS}/summary?hasProducts=false`);

    expect(inner.body.data.map((b: { name: string }) => b.name)).toEqual(["Apple"]);
    expect(anti.body.data.map((b: { name: string }) => b.name)).toEqual(["Bose"]);
  });

  it("products -> brand: inner drops unbranded products, left keeps them with null", async () => {
    const inner = await request(app).get("/api/v1/products/with-brand?join=inner");
    const left = await request(app).get("/api/v1/products/with-brand?join=left");

    expect(inner.body.count).toBe(2);
    expect(left.body.count).toBe(3);
    expect(left.body.items).toContainEqual(
      expect.objectContaining({ name: "Yoga Mat", brand: null }),
    );
  });
});

describe("DELETE /api/v1/brands/:id", () => {
  let adminAuth: string;
  beforeEach(async () => {
    adminAuth = authHeader(await createUser({ role: "admin" }));
  });

  it("409 while products still reference the brand (ON DELETE RESTRICT)", async () => {
    const brand = await createBrand();
    await createProduct({ brand: brand._id.toString(), isActive: false }); // inactive counts too

    const res = await request(app)
      .delete(`${BRANDS}/${brand._id.toString()}`)
      .set("Authorization", adminAuth);

    expect(res.status).toBe(409);
    await request(app).get(`${BRANDS}/${brand._id.toString()}`).expect(200);
  });

  it("204 for an unused brand", async () => {
    const brand = await createBrand();
    await request(app)
      .delete(`${BRANDS}/${brand._id.toString()}`)
      .set("Authorization", adminAuth)
      .expect(204);
    await request(app).get(`${BRANDS}/${brand._id.toString()}`).expect(404);
  });

  it("404 for a brand that doesn't exist", async () => {
    await request(app)
      .delete(`${BRANDS}/64b000000000000000000000`)
      .set("Authorization", adminAuth)
      .expect(404);
  });
});

it("POST /brands returns 409 for a duplicate name (unique index)", async () => {
  const admin = authHeader(await createUser({ role: "admin" }));
  await createBrand({ name: "Sony" });

  const res = await request(app)
    .post(BRANDS)
    .set("Authorization", admin)
    .send({ name: "Sony", country: "Japan" });

  expect(res.status).toBe(409);
});
