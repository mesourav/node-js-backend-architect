import { AppError } from '../../utils/AppError';
import { ProductModel } from './product.model';
import { CreateProductInput, ListProductsQuery, UpdateProductInput } from './product.schema';

// Service layer: business logic + DB access. Knows nothing about HTTP (req/res),
// so it can be reused from a script, a queue worker, or tests.

export async function createProduct(input: CreateProductInput) {
  return ProductModel.create(input);
}

export async function listProducts(q: ListProductsQuery) {
  const filter: Record<string, unknown> = { isActive: true };
  if (q.category) filter.category = q.category;
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.priceInCents = {
      ...(q.minPrice !== undefined && { $gte: q.minPrice }),
      ...(q.maxPrice !== undefined && { $lte: q.maxPrice }),
    };
  }
  if (q.search) filter.$text = { $search: q.search };

  const skip = (q.page - 1) * q.limit;

  // Run the page query and the count in parallel.
  const [items, total] = await Promise.all([
    ProductModel.find(filter).sort(q.sort).skip(skip).limit(q.limit).lean(),
    ProductModel.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  };
}

export async function getProductById(id: string) {
  const product = await ProductModel.findById(id).lean();
  if (!product) throw new AppError(404, 'Product not found');
  return product;
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const product = await ProductModel.findByIdAndUpdate(id, input, {
    returnDocument: 'after', // return the updated document, not the old one
    runValidators: true, // apply schema rules (min, enum...) on updates too
  }).lean();
  if (!product) throw new AppError(404, 'Product not found');
  return product;
}

export async function deleteProduct(id: string) {
  const product = await ProductModel.findByIdAndDelete(id);
  if (!product) throw new AppError(404, 'Product not found');
}
