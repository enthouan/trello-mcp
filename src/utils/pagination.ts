import { z } from "zod";

export const LimitSchema = z
  .number()
  .int()
  .min(1)
  .max(1000)
  .default(50)
  .describe(
    "Maximum number of Trello objects to return; Trello caps this at 1000.",
  );

export const PageSchema = z
  .number()
  .int()
  .min(0)
  .default(0)
  .describe("Zero-based result page for Trello action collections.");

export const CursorSchema = z
  .union([z.string().min(1), z.null()])
  .optional()
  .describe(
    "ISO-8601 date, Mongo id, or null cursor for Trello since/before paging.",
  );

export const PagingInput = z.object({
  limit: LimitSchema,
  since: CursorSchema,
  before: CursorSchema,
});

export const ActionPagingInput = PagingInput.extend({
  page: PageSchema,
});

type PagingQueryInput = z.infer<typeof PagingInput> &
  Partial<Pick<z.infer<typeof ActionPagingInput>, "page">>;

export function withLimit<T extends z.ZodRawShape>(
  shape: T,
): z.ZodObject<T & { limit: typeof LimitSchema }> {
  return z.object({ ...shape, limit: LimitSchema }) as z.ZodObject<
    T & { limit: typeof LimitSchema }
  >;
}

export function pagingQuery({
  limit,
  since,
  before,
  page,
}: PagingQueryInput): Record<string, string | number | null | undefined> {
  return {
    limit,
    ...(since !== undefined ? { since } : {}),
    ...(before !== undefined ? { before } : {}),
    ...(page !== undefined ? { page } : {}),
  };
}
