import { env } from "../config/env";
import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { ProductModel } from "../modules/product/product.model";
import { CreateProductInput } from "../modules/product/product.schema";

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

async function seed() {
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production database");
  }

  await connectDB();

  // Upsert by name: one round trip for all products, and safe to run repeatedly.
  const result = await ProductModel.bulkWrite(
    products.map((p) => ({
      updateOne: { filter: { name: p.name }, update: { $set: p }, upsert: true },
    })),
  );

  logger.info({ inserted: result.upsertedCount, alreadyExisted: result.matchedCount }, "Seed done");
}

seed()
  .catch((err: unknown) => {
    logger.error({ err }, "Seed failed");
    process.exitCode = 1;
  })
  .finally(disconnectDB);
