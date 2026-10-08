import { Request, Response } from "express";
import * as brandService from "./brand.service";
import { BrandSummaryQuery, CreateBrandInput } from "./brand.schema";

type IdParams = { id: string };

export async function create(req: Request<object, unknown, CreateBrandInput>, res: Response) {
  const brand = await brandService.createBrand(req.body);
  res.status(201).json({ success: true, data: brand });
}

export async function list(_req: Request, res: Response) {
  const brands = await brandService.listBrands();
  res.json({ success: true, data: brands });
}

export async function getById(req: Request<IdParams>, res: Response) {
  const brand = await brandService.getBrandWithProducts(req.params.id);
  res.json({ success: true, data: brand });
}

export async function summary(_req: Request, res: Response) {
  const brands = await brandService.getBrandsSummary(res.locals.query as BrandSummaryQuery);
  res.json({ success: true, count: brands.length, data: brands });
}
