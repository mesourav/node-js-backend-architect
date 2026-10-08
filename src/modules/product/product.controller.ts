import { Request, Response } from 'express';
import * as productService from './product.service';
import { ListProductsQuery } from './product.schema';

// Controller layer: translates HTTP <-> service calls. No business logic here.
// Express 5 forwards rejected promises to the error handler, so no try/catch needed.

type IdParams = { id: string };

export async function create(req: Request, res: Response) {
  const product = await productService.createProduct(req.body);
  res.status(201).json({ success: true, data: product });
}

export async function list(_req: Request, res: Response) {
  const result = await productService.listProducts(res.locals.query as ListProductsQuery);
  res.json({ success: true, data: result.items, pagination: result.pagination });
}

export async function getById(req: Request<IdParams>, res: Response) {
  const product = await productService.getProductById(req.params.id);
  res.json({ success: true, data: product });
}

export async function update(req: Request<IdParams>, res: Response) {
  const product = await productService.updateProduct(req.params.id, req.body);
  res.json({ success: true, data: product });
}

export async function remove(req: Request<IdParams>, res: Response) {
  await productService.deleteProduct(req.params.id);
  res.status(204).send();
}
