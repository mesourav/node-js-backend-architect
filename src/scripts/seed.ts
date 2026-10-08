import { env } from "../config/env";
import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { BrandModel } from "../modules/brand/brand.model";
import { CreateBrandInput } from "../modules/brand/brand.schema";
import { ProductModel } from "../modules/product/product.model";
import { CreateProductInput } from "../modules/product/product.schema";
import { UserModel } from "../modules/user/user.model";
import { hashPassword } from "../modules/auth/auth.service";

// Prices are in paise (₹1 = 100 paise).
const products: CreateProductInput[] = [
  // electronics
  {
    name: "iPhone 17",
    description: "256GB, Midnight",
    priceInCents: 7999900,
    category: "electronics",
    stock: 15,
  },
  {
    name: "Samsung Galaxy S26",
    description: "12GB RAM, 256GB",
    priceInCents: 7499900,
    category: "electronics",
    stock: 20,
  },
  {
    name: "Sony WH-1000XM6",
    description: "Noise cancelling headphones",
    priceInCents: 2999000,
    category: "electronics",
    stock: 40,
  },
  {
    name: "MacBook Air M5",
    description: "13-inch, 16GB RAM",
    priceInCents: 11490000,
    category: "electronics",
    stock: 8,
  },
  {
    name: "Logitech MX Master 4",
    description: "Wireless ergonomic mouse",
    priceInCents: 999500,
    category: "electronics",
    stock: 60,
  },
  {
    name: "Mechanical Keyboard",
    description: "RGB, hot-swappable switches",
    priceInCents: 549900,
    category: "electronics",
    stock: 35,
  },
  {
    name: "Dell 27 4K Monitor",
    description: "IPS, USB-C 90W",
    priceInCents: 3499900,
    category: "electronics",
    stock: 12,
  },
  // clothing
  {
    name: "Levis 511 Slim Jeans",
    description: "Dark indigo denim",
    priceInCents: 329900,
    category: "clothing",
    stock: 80,
  },
  {
    name: "Cotton Crew T-Shirt",
    description: "Pack of 3, assorted colours",
    priceInCents: 99900,
    category: "clothing",
    stock: 150,
  },
  {
    name: "Puffer Winter Jacket",
    description: "Water resistant, hooded",
    priceInCents: 549900,
    category: "clothing",
    stock: 25,
  },
  {
    name: "Formal Oxford Shirt",
    description: "Slim fit, white",
    priceInCents: 179900,
    category: "clothing",
    stock: 60,
  },
  {
    name: "Running Shorts",
    description: "Quick-dry fabric",
    priceInCents: 79900,
    category: "clothing",
    stock: 90,
  },
  {
    name: "Wool Sweater",
    description: "Merino wool, navy",
    priceInCents: 259900,
    category: "clothing",
    stock: 0,
    isActive: false,
  },
  // books
  {
    name: "Clean Code",
    description: "Robert C. Martin",
    priceInCents: 45000,
    category: "books",
    stock: 30,
  },
  {
    name: "Designing Data-Intensive Applications",
    description: "Martin Kleppmann",
    priceInCents: 189900,
    category: "books",
    stock: 25,
  },
  {
    name: "System Design Interview Vol 1",
    description: "Alex Xu",
    priceInCents: 79900,
    category: "books",
    stock: 40,
  },
  {
    name: "Node.js Design Patterns",
    description: "Mario Casciaro, Luciano Mammino",
    priceInCents: 299900,
    category: "books",
    stock: 18,
  },
  {
    name: "You Dont Know JS Yet",
    description: "Kyle Simpson",
    priceInCents: 69900,
    category: "books",
    stock: 22,
  },
  {
    name: "The Pragmatic Programmer",
    description: "Hunt & Thomas",
    priceInCents: 99900,
    category: "books",
    stock: 27,
  },
  // home
  {
    name: "Philips Air Fryer",
    description: "4.1L, digital",
    priceInCents: 899900,
    category: "home",
    stock: 20,
  },
  {
    name: "Prestige Pressure Cooker",
    description: "5L, stainless steel",
    priceInCents: 249900,
    category: "home",
    stock: 45,
  },
  {
    name: "Ceramic Dinner Set",
    description: "18 pieces",
    priceInCents: 349900,
    category: "home",
    stock: 15,
  },
  {
    name: "LED Desk Lamp",
    description: "Adjustable brightness",
    priceInCents: 149900,
    category: "home",
    stock: 50,
  },
  {
    name: "Memory Foam Pillow",
    description: "Orthopedic, pack of 2",
    priceInCents: 199900,
    category: "home",
    stock: 35,
  },
  // sports
  {
    name: "Yonex Badminton Racket",
    description: "Graphite frame",
    priceInCents: 459900,
    category: "sports",
    stock: 30,
  },
  {
    name: "SG Cricket Bat",
    description: "English willow",
    priceInCents: 1299900,
    category: "sports",
    stock: 10,
  },
  {
    name: "Yoga Mat",
    description: "6mm, anti-slip",
    priceInCents: 89900,
    category: "sports",
    stock: 70,
  },
  {
    name: "Adjustable Dumbbells",
    description: "2 x 10kg",
    priceInCents: 399900,
    category: "sports",
    stock: 14,
  },
  {
    name: "Nike Football",
    description: "Size 5",
    priceInCents: 149900,
    category: "sports",
    stock: 40,
  },
  {
    name: "Running Shoes",
    description: "Cushioned, breathable",
    priceInCents: 699900,
    category: "sports",
    stock: 28,
  },
];

// Bose and Adidas have no products on purpose: they show up in a LEFT join but not an INNER join.
const brands: CreateBrandInput[] = [
  { name: "Apple", country: "USA", website: "https://www.apple.com" },
  { name: "Samsung", country: "South Korea" },
  { name: "Sony", country: "Japan" },
  { name: "Logitech", country: "Switzerland" },
  { name: "Dell", country: "USA" },
  { name: "Levi's", country: "USA" },
  { name: "Philips", country: "Netherlands" },
  { name: "Prestige", country: "India" },
  { name: "Yonex", country: "Japan" },
  { name: "SG", country: "India" },
  { name: "Nike", country: "USA" },
  { name: "O'Reilly", country: "USA" },
  { name: "Pearson", country: "UK" },
  { name: "Packt", country: "UK" },
  { name: "Bose", country: "USA" },
  { name: "Adidas", country: "Germany" },
];

// product name -> brand name. Products not listed here are unbranded (brand: null):
// they show up in a LEFT join but not an INNER join.
const productBrand: Record<string, string> = {
  "iPhone 17": "Apple",
  "MacBook Air M5": "Apple",
  "Samsung Galaxy S26": "Samsung",
  "Sony WH-1000XM6": "Sony",
  "Logitech MX Master 4": "Logitech",
  "Dell 27 4K Monitor": "Dell",
  "Levis 511 Slim Jeans": "Levi's",
  "Philips Air Fryer": "Philips",
  "Prestige Pressure Cooker": "Prestige",
  "Yonex Badminton Racket": "Yonex",
  "SG Cricket Bat": "SG",
  "Nike Football": "Nike",
  "Running Shoes": "Nike",
  "Designing Data-Intensive Applications": "O'Reilly",
  "Clean Code": "Pearson",
  "The Pragmatic Programmer": "Pearson",
  "Node.js Design Patterns": "Packt",
};

async function seed() {
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production database");
  }

  await connectDB();

  // 1. Brands first: products reference them, so they must exist (like a parent table in SQL).
  //    Upsert by name: one round trip for all, and safe to run repeatedly.
  const brandResult = await BrandModel.bulkWrite(
    brands.map((b) => ({
      updateOne: { filter: { name: b.name }, update: { $set: b }, upsert: true },
    })),
  );

  // 2. Look up the generated _ids so products can reference them.
  const brandDocs = await BrandModel.find({}, { name: 1 }).lean();
  const brandIdByName = new Map(brandDocs.map((b) => [b.name, b._id.toString()]));

  // 3. Products, each pointing at its brand's _id (or null).
  const productResult = await ProductModel.bulkWrite(
    products.map((p) => {
      const brandName = productBrand[p.name];
      const brand = brandName ? brandIdByName.get(brandName) : null;
      return {
        updateOne: { filter: { name: p.name }, update: { $set: { ...p, brand } }, upsert: true },
      };
    }),
  );

  // 4. An admin account. The public /auth/register endpoint only ever creates customers,
  //    so the first admin has to be created out-of-band like this.
  const adminSeeded = await seedAdmin();

  logger.info(
    {
      brands: { inserted: brandResult.upsertedCount, alreadyExisted: brandResult.matchedCount },
      products: {
        inserted: productResult.upsertedCount,
        alreadyExisted: productResult.matchedCount,
      },
      admin: adminSeeded ? env.SEED_ADMIN_EMAIL : "skipped (SEED_ADMIN_PASSWORD not set)",
    },
    "Seed done",
  );
}

async function seedAdmin() {
  if (!env.SEED_ADMIN_PASSWORD) return false;
  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  await UserModel.updateOne(
    { email: env.SEED_ADMIN_EMAIL },
    { $set: { name: "Admin", passwordHash, role: "admin" } },
    { upsert: true },
  );
  return true;
}

seed()
  .catch((err: unknown) => {
    logger.error({ err }, "Seed failed");
    process.exitCode = 1;
  })
  .finally(disconnectDB);
