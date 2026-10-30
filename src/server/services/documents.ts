import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { AppError, notFound } from "@/lib/api/errors";
import { pageArgs, toPage, type Pagination } from "@/lib/api/pagination";
import { rateLimit } from "@/lib/api/rate-limit";
import type { AuthedActor } from "@/lib/authz/actor";
import { assert, canContributeInOrg, isOrgAdmin, isOrgMember } from "@/lib/authz/permissions";
import { visibleDocuments } from "@/lib/authz/visibility";
import {
  ALLOWED_SUMMARY,
  contentMatchesKind,
  FILE_KINDS,
  kindFromFilename,
  sanitizeFilename,
} from "@/components/portal/collab/file-rules";
import { accessFor, loadProject, PROJECT_ACCESS_SELECT } from "@/server/services/projects";

/** Metadata only — the blob relation is never selected for listings. */
const META_SELECT = {
  id: true,
  organisationId: true,
  projectId: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  sha256: true,
  createdAt: true,
  uploaderId: true,
  uploader: { select: { id: true, name: true } },
} satisfies Prisma.DocumentSelect;

export const maxUploadBytes = () => env().MAX_UPLOAD_MB * 1024 * 1024;

const invalidFile = (message: string) => new AppError("validation_failed", message, { file: [message] });

export interface UploadInput {
  file: File;
  workspaceId: string;
  projectId?: string | null;
}

export async function uploadDocument(actor: AuthedActor, input: UploadInput) {
  const { workspaceId } = input;
  if (!isOrgMember(actor, workspaceId)) throw notFound("Workspace not found.");
  assert(canContributeInOrg(actor, workspaceId), "Viewers cannot upload documents.");
  let projectId: string | null = null;
  if (input.projectId) {
    const { project, access } = await loadProject(actor, input.projectId);
    if (project.organisationId !== workspaceId) throw notFound("Project not found.");
    assert(access.contribute, "You cannot upload documents to this project.");
    projectId = project.id;
  }
  await rateLimit(`upload:${actor.user.id}`, 20, 600);

  const max = maxUploadBytes();
  if (input.file.size > max) throw new AppError("payload_too_large", `Files must be ${env().MAX_UPLOAD_MB} MB or smaller.`);
  if (input.file.size === 0) throw invalidFile("The file is empty.");

  const filename = sanitizeFilename(input.file.name || "file");
  const kind = kindFromFilename(filename);
  if (!kind) throw invalidFile(`Unsupported file type. Allowed: ${ALLOWED_SUMMARY}.`);

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  if (bytes.byteLength > max) throw new AppError("payload_too_large", `Files must be ${env().MAX_UPLOAD_MB} MB or smaller.`);
  if (!contentMatchesKind(kind, bytes)) {
    throw invalidFile(
      FILE_KINDS[kind].signature === "text"
        ? "Text files must be UTF-8 encoded and contain no binary data."
        : `The file content does not look like a ${FILE_KINDS[kind].label}.`,
    );
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const mimeType = FILE_KINDS[kind].mime; // canonical type for the verified kind, never the client-declared one

  return db.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        organisationId: workspaceId,
        projectId,
        uploaderId: actor.user.id,
        filename,
        mimeType,
        sizeBytes: bytes.byteLength,
        sha256,
        blob: { create: { data: bytes } },
      },
      select: META_SELECT,
    });
    await audit(
      {
        actorId: actor.user.id,
        action: "document.upload",
        entityType: "Document",
        entityId: doc.id,
        organisationId: workspaceId,
        metadata: { ...(projectId ? { projectId } : {}), mimeType, sizeBytes: bytes.byteLength },
      },
      tx,
    );
    return doc;
  });
}

export async function listProjectDocuments(actor: AuthedActor, projectId: string, page: Pagination) {
  const { project, access } = await loadProject(actor, projectId);
  const rows = await db.document.findMany({
    where: { AND: [visibleDocuments(actor), { projectId }] },
    select: META_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...pageArgs(page),
  });
  const result = toPage(rows, page);
  const admin = isOrgAdmin(actor, project.organisationId);
  return {
    ...result,
    items: result.items.map((d) => ({ ...d, canDelete: d.uploaderId === actor.user.id || access.manage || admin })),
    canUpload: access.contribute,
  };
}
export type DocumentRow = Awaited<ReturnType<typeof listProjectDocuments>>["items"][number];

/** Workspace-level documents (not attached to a project). */
export async function listWorkspaceDocuments(actor: AuthedActor, organisationId: string, page: Pagination) {
  if (!isOrgMember(actor, organisationId)) throw notFound("Workspace not found.");
  const rows = await db.document.findMany({
    where: { AND: [visibleDocuments(actor), { organisationId, projectId: null }] },
    select: META_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...pageArgs(page),
  });
  const result = toPage(rows, page);
  const admin = isOrgAdmin(actor, organisationId);
  return {
    ...result,
    items: result.items.map((d) => ({ ...d, canDelete: d.uploaderId === actor.user.id || admin })),
    canUpload: canContributeInOrg(actor, organisationId),
  };
}

async function loadDocument(actor: AuthedActor, documentId: string) {
  const doc = await db.document.findFirst({
    where: { AND: [{ id: documentId }, visibleDocuments(actor)] },
    select: { ...META_SELECT, project: { select: PROJECT_ACCESS_SELECT } },
  });
  if (!doc) throw notFound("Document not found.");
  let manage = isOrgAdmin(actor, doc.organisationId);
  if (doc.project) {
    const access = accessFor(actor, doc.project);
    if (!access.view) throw notFound("Document not found.");
    manage ||= access.manage;
  }
  return { doc, canDelete: doc.uploaderId === actor.user.id || manage };
}

export async function getDocument(actor: AuthedActor, documentId: string) {
  const { doc, canDelete } = await loadDocument(actor, documentId);
  const { project, ...meta } = doc;
  return { document: { ...meta, project: project ? { id: project.id, name: project.name } : null }, canDelete };
}

export async function deleteDocument(actor: AuthedActor, documentId: string) {
  const { doc, canDelete } = await loadDocument(actor, documentId);
  assert(canDelete, "Only the uploader, a project manager or a workspace administrator can delete this document.");
  await db.$transaction(async (tx) => {
    await tx.document.delete({ where: { id: doc.id } });
    await audit(
      {
        actorId: actor.user.id,
        action: "document.delete",
        entityType: "Document",
        entityId: doc.id,
        organisationId: doc.organisationId,
        metadata: { ...(doc.projectId ? { projectId: doc.projectId } : {}), mimeType: doc.mimeType },
      },
      tx,
    );
  });
}

/** Authorise, then return the bytes. Same visibility rules as listing (404 when not visible). */
export async function readDocumentForDownload(actor: AuthedActor, documentId: string) {
  const { doc } = await loadDocument(actor, documentId);
  const blob = await db.documentBlob.findUnique({ where: { documentId: doc.id }, select: { data: true } });
  if (!blob) throw notFound("Document content is unavailable.");
  return { filename: doc.filename, mimeType: doc.mimeType, sizeBytes: doc.sizeBytes, sha256: doc.sha256, data: blob.data };
}
