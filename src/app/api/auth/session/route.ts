import { withApi } from "@/lib/api/handler";
import { serializeActor } from "@/lib/authz/serialize";

/** Current session summary. Authority is always re-derived server-side; this is display data only. */
export const GET = withApi(async ({ actor }) => ({ session: actor.user ? serializeActor(actor) : null }), { auth: false });
