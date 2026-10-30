import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { contentDisposition, isInlineSafeImage } from "@/components/portal/collab/file-rules";
import { readDocumentForDownload } from "@/server/services/documents";

/**
 * Authorised download from the Postgres blob store. Always an attachment; non-image types are
 * served as application/octet-stream with nosniff so the browser never renders untrusted content.
 */
export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  const doc = await readDocumentForDownload(actor, params.id);
  return new Response(doc.data, {
    status: 200,
    headers: {
      "Content-Type": isInlineSafeImage(doc.mimeType) ? doc.mimeType : "application/octet-stream",
      "Content-Length": String(doc.data.byteLength),
      "Content-Disposition": contentDisposition(doc.filename),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ETag: `"${doc.sha256}"`,
    },
  });
});
