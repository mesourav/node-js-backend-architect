import { Request, Response } from "express";
import * as productService from "./product.service";
import { CreateProductInput, ListProductsQuery, UpdateProductInput } from "./product.schema";

// Controller layer: translates HTTP <-> service calls. No business logic here.
// Express 5 forwards rejected promises to the error handler, so no try/catch needed.

// Request<Params, ResBody, ReqBody>: typing the body documents what the
// validate() middleware has already guaranteed, instead of passing `any` around.
type IdParams = { id: string };

export async function create(req: Request<object, unknown, CreateProductInput>, res: Response) {
  const product = await productService.createProduct(req.body);
  res.status(201).json({ success: true, data: product });
}

export async function list(_req: Request, res: Response) {
  const result = await productService.listProducts(res.locals.query as ListProductsQuery);
  res.json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
}

export async function getById(req: Request<IdParams>, res: Response) {
  const product = await productService.getProductById(req.params.id);
  res.json({ success: true, data: product });
}

export async function update(req: Request<IdParams, unknown, UpdateProductInput>, res: Response) {
  const product = await productService.updateProduct(req.params.id, req.body);
  res.json({ success: true, data: product });
}

export async function remove(req: Request<IdParams>, res: Response) {
  await productService.deleteProduct(req.params.id);
  res.status(204).send();
}

export async function productsStats(_req: Request, res: Response) {
  const productsStats = await productService.getProductsStats();
  res.json({ success: true, data: productsStats });
}
