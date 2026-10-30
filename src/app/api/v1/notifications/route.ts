import { z } from "zod";
import { withApi, parseQuery } from "@/lib/api/handler";
import { paginationSchema } from "@/lib/api/pagination";
import { requireUser } from "@/lib/authz/actor";
import { listNotifications, unreadCount } from "@/server/services/notifications";

const query = paginationSchema.extend({ unread: z.enum(["1", "0"]).optional() });

export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  const q = parseQuery(req, query);
  const [page, unread] = await Promise.all([listNotifications(actor, q, q.unread === "1"), unreadCount(actor)]);
  return { ...page, unreadCount: unread };
});
