import { withApi } from "@/lib/api/handler";
import { listOpenHackathonEvents } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

/** Public list of hackathons currently open for registration. */
export const GET = withApi(
  async () => {
    const events = await listOpenHackathonEvents();
    return { items: events };
  },
  { auth: false },
);
