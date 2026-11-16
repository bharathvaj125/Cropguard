import mongoose from 'mongoose';
import { z } from 'zod';
import { ApiError } from './errors.js';

/** Parse `data` with a zod schema, turning failures into a 400 with field-level messages. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const details = result.error.issues.map((i) => ({
    field: i.path.join('.'),
    message: i.message,
  }));
  const first = details[0];
  throw ApiError.badRequest(first.field ? `${first.field}: ${first.message}` : first.message, details);
}

export const objectId = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), { message: 'is not a valid id' });

export function assertId(value, what = 'Resource') {
  if (!mongoose.isValidObjectId(value)) throw ApiError.notFound(what);
  return value;
}

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Escape user input before it is used inside a RegExp. */
export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function paged(items, total, { page, limit }) {
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}
