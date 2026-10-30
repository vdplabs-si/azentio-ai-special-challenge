import { withApi } from "@/lib/api/handler";
import { destroyCurrentSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const POST = withApi(
  async ({ actor }) => {
    if (actor.user) await audit({ actorId: actor.user.id, action: "auth.logout", entityType: "User", entityId: actor.user.id });
    await destroyCurrentSession();
    return { ok: true };
  },
  { auth: false },
);
