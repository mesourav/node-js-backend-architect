import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app, authHeader, createProduct, createUser } from "../helpers/factories";

const PRODUCTS = "/api/v1/products";
const validProduct = { name: "Test Phone", priceInCents: 1_999_900, category: "electronics" };

describe("GET /api/v1/products (public)", () => {
  beforeEach(async () => {
    await createProduct({ name: "Cheap Book", category: "books", priceInCents: 500 });
    await createProduct({ name: "Pricey Book", category: "books", priceInCents: 9_000 });
    await createProduct({ name: "Laptop", category: "electronics", priceInCents: 90_000 });
    await createProduct({ name: "Hidden", category: "books", isActive: false });
  });

  it("filters, sorts and paginates, and hides inactive products", async () => {
    const res = await request(app).get(`${PRODUCTS}?category=books&sort=priceInCents&limit=1`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual(["Cheap Book"]);
    expect(res.body.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
  });

  it("rejects sorting on a field that isn't whitelisted", async () => {
    const res = await request(app).get(`${PRODUCTS}?sort=stock`);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/products/:id", () => {
  it("returns 404 for a valid id that doesn't exist", async () => {
    const res = await request(app).get(`${PRODUCTS}/64b000000000000000000000`);
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    const res = await request(app).get(`${PRODUCTS}/abcdefghijkl`);
    expect(res.status).toBe(400);
  });

  // REGRESSION test: /stats was once shadowed by /:id (route order bug).
  // If someone moves the routes around again, this test fails immediately.
  it("does not treat /stats as an id", async () => {
    const res = await request(app).get(`${PRODUCTS}/stats`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("byCategory");
  });
});

describe("POST /api/v1/products (admin only)", () => {
  it("401 without a token", async () => {
    const res = await request(app).post(PRODUCTS).send(validProduct);
    expect(res.status).toBe(401);
  });

  it("403 for a customer", async () => {
    const customer = await createUser({ role: "customer" });
    const res = await request(app)
      .post(PRODUCTS)
      .set("Authorization", authHeader(customer))
      .send(validProduct);
    expect(res.status).toBe(403);
  });

  it("201 for an admin", async () => {
    const admin = await createUser({ role: "admin" });
    const res = await request(app)
      .post(PRODUCTS)
      .set("Authorization", authHeader(admin))
      .send(validProduct);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ ...validProduct, stock: 0, isActive: true });
  });

  it("400 with every invalid field listed", async () => {
    const admin = await createUser({ role: "admin" });
    const res = await request(app)
      .post(PRODUCTS)
      .set("Authorization", authHeader(admin))
      .send({ name: "x", priceInCents: -5, category: "toys" });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { path: string }) => e.path).sort()).toEqual([
      "category",
      "name",
      "priceInCents",
    ]);
  });

  it("400 when the referenced brand doesn't exist", async () => {
    const admin = await createUser({ role: "admin" });
    const res = await request(app)
      .post(PRODUCTS)
      .set("Authorization", authHeader(admin))
      .send({ ...validProduct, brand: "64b000000000000000000000" });
    expect(res.status).toBe(400);
  });

  // REGRESSION test: malformed JSON used to return 500.
  it("400 for malformed JSON", async () => {
    const admin = await createUser({ role: "admin" });
    const res = await request(app)
      .post(PRODUCTS)
      .set("Authorization", authHeader(admin))
      .set("Content-Type", "application/json")
      .send('{"name": ');
    expect(res.status).toBe(400);
  });
});

describe("PATCH and DELETE /api/v1/products/:id (admin only)", () => {
  it("updates only the fields sent", async () => {
    const admin = await createUser({ role: "admin" });
    const product = await createProduct({ name: "Old name", stock: 5 });

    const res = await request(app)
      .patch(`${PRODUCTS}/${product._id.toString()}`)
      .set("Authorization", authHeader(admin))
      .send({ stock: 42 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "Old name", stock: 42 });
  });

  it("deletes, after which the product is gone", async () => {
    const admin = await createUser({ role: "admin" });
    const product = await createProduct();
    const url = `${PRODUCTS}/${product._id.toString()}`;

    await request(app).delete(url).set("Authorization", authHeader(admin)).expect(204);
    await request(app).get(url).expect(404);
  });
});
