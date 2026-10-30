import { z } from "zod";

export const paginationSchema = z.object({
  cursor: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

/** Prisma args for cursor pagination ordered by a stable unique id. Fetches one extra row. */
export function pageArgs({ cursor, limit }: Pagination) {
  return {
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  };
}

/** Trim the extra row and expose `nextCursor`. */
export function toPage<T extends { id: string }>(rows: T[], { limit }: Pagination) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
}
