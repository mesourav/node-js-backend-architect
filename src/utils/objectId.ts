import { z } from "zod";

// A MongoDB ObjectId as a 24-char hex string. We don't use mongoose.isValidObjectId()
// because it also accepts ANY 12-character string (e.g. "abcdefghijkl").
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
