import { withApi } from "@/lib/api/handler";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";
import { notFound } from "@/lib/api/errors";
import { previewInvitation } from "@/server/services/invitations";

export const GET = withApi<{ token: string }>(
  async ({ req, params }) => {
    await rateLimit(`invite-preview:${clientIp(req.headers)}`, 60, 600);
    const preview = await previewInvitation(params.token);
    if (!preview) throw notFound("Invitation not found.");
    return { invitation: preview };
  },
  { auth: false },
);
