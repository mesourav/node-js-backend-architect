import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrandModel } from "../../src/modules/brand/brand.model";
import { ProductModel } from "../../src/modules/product/product.model";
import { app, authHeader, createBrand, createProduct, createUser } from "../helpers/factories";

const PRODUCTS = "/api/v1/products";

async function productCountOf(brandId: { toString(): string }) {
  const brand = await BrandModel.findById(brandId.toString()).lean();
  return brand?.productCount;
}

let admin: string;
beforeEach(async () => {
  admin = authHeader(await createUser({ role: "admin" }));
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("brand.productCount stays in sync", () => {
  it("increments on create, moves on brand change, decrements on delete", async () => {
    const apple = await createBrand({ name: "Apple" });
    const sony = await createBrand({ name: "Sony" });

    const created = await request(app)
      .post(PRODUCTS)
      .set("Authorization", admin)
      .send({ name: "Phone", priceInCents: 100, category: "electronics", brand: apple.id })
      .expect(201);
    expect(await productCountOf(apple._id)).toBe(1);

    const url = `${PRODUCTS}/${created.body.data._id}`;
    await request(app).patch(url).set("Authorization", admin).send({ brand: sony.id }).expect(200);
    expect(await productCountOf(apple._id)).toBe(0);
    expect(await productCountOf(sony._id)).toBe(1);

    await request(app).delete(url).set("Authorization", admin).expect(204);
    expect(await productCountOf(sony._id)).toBe(0);
  });
});

describe("rollback", () => {
  it("undoes the counter increment when inserting the product fails", async () => {
    const brand = await createBrand();
    // Simulate a failure AFTER linkProduct() has already incremented the counter.
    vi.spyOn(ProductModel, "create").mockRejectedValueOnce(new Error("disk full"));

    const res = await request(app)
      .post(PRODUCTS)
      .set("Authorization", admin)
      .send({ name: "Doomed", priceInCents: 100, category: "home", brand: brand.id });

    expect(res.status).toBe(500);
    // Without a transaction this would be 1: a counter for a product that doesn't exist.
    expect(await productCountOf(brand._id)).toBe(0);
  });
});

describe("race: create a product while its brand is being deleted", () => {
  // The bug from the brand-delete homework. Run both requests AT THE SAME TIME, many
  // times. The fix is correct only if the database never ends up with a product that
  // points to a deleted brand, no matter who wins.
  it("never leaves a product pointing to a deleted brand", async () => {
    for (let round = 0; round < 15; round++) {
      const brand = await createBrand();

      const [create, del] = await Promise.all([
        request(app)
          .post(PRODUCTS)
          .set("Authorization", admin)
          .send({ name: `Race ${round}`, priceInCents: 1, category: "home", brand: brand.id }),
        request(app).delete(`/api/v1/brands/${brand.id}`).set("Authorization", admin),
      ]);

      const brandExists = await BrandModel.exists({ _id: brand._id });
      const orphans = await ProductModel.countDocuments({ brand: brand._id });

      if (brandExists) {
        // Product won: it was linked first, so the delete was refused.
        expect(create.status).toBe(201);
        expect(del.status).toBe(409);
        expect(await productCountOf(brand._id)).toBe(1);
      } else {
        // Delete won: the product creation was refused, nothing points to the brand.
        expect(del.status).toBe(204);
        expect(create.status).toBe(400);
        expect(orphans).toBe(0);
      }
    }
  });
});

it("409 when deleting a brand used only by an inactive product", async () => {
  const brand = await createBrand();
  await createProduct({ brand: brand.id, isActive: false });

  await request(app).delete(`/api/v1/brands/${brand.id}`).set("Authorization", admin).expect(409);
});
