import { z } from "zod";

export const LimitSchema = z.number().int().min(1).max(1000).default(50);

export function withLimit<T extends z.ZodRawShape>(shape: T): z.ZodObject<T & { limit: typeof LimitSchema }> {
  return z.object({ ...shape, limit: LimitSchema }) as z.ZodObject<T & { limit: typeof LimitSchema }>;
}
