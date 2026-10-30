import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";
import { apiLogin, USERS } from "./helpers";

test.describe.configure({ mode: "serial" });

let baseURL: string;
const ctx: Record<string, APIRequestContext> = {};
async function as(user: keyof typeof USERS) {
  if (!ctx[user]) {
    ctx[user] = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
    await apiLogin(ctx[user], baseURL, USERS[user]);
  }
  return ctx[user];
}
test.beforeAll(({}, info) => {
  baseURL = info.project.use.baseURL!;
});
test.afterAll(async () => {
  for (const c of Object.values(ctx)) await c.dispose();
});

const state: { projectId?: string; taskId?: string; documentId?: string; workspaceId?: string } = {};

test("project CRUD inside the active workspace", async () => {
  const admin = await as("northwindAdmin");
  const session = (await (await admin.get("/api/auth/session")).json()).session;
  state.workspaceId = session.activeOrganisation.id;
  const created = await admin.post("/api/v1/projects", {
    data: { name: "E2E project", description: "Created by the e2e suite.", status: "ACTIVE", visibility: "WORKSPACE", workspaceId: state.workspaceId },
  });
  expect(created.status(), await created.text()).toBe(201);
  const project = (await created.json()) as { id?: string; project?: { id: string } };
  state.projectId = project.id ?? project.project!.id;

  const patched = await admin.patch(`/api/v1/projects/${state.projectId}`, { data: { status: "ON_HOLD" } });
  expect(patched.status(), await patched.text()).toBe(200);
  expect((await admin.get(`/api/v1/projects/${state.projectId}`)).status()).toBe(200);
});

test("other tenants and employees without membership get 404 on the project", async () => {
  for (const u of ["cedarAdmin", "employee", "admin"] as const) {
    const c = await as(u);
    expect((await c.get(`/api/v1/projects/${state.projectId}`)).status(), u).toBe(404);
  }
});

test("task CRUD, assignment notification and comments", async () => {
  const admin = await as("northwindAdmin");
  const analyst = await as("northwindAnalyst");
  const analystId = ((await (await analyst.get("/api/v1/me")).json()) as { profile: { id: string } }).profile.id;

  const created = await admin.post(`/api/v1/projects/${state.projectId}/tasks`, {
    data: { title: "E2E task", description: "Check the board.", priority: "HIGH", assigneeId: analystId },
  });
  expect(created.status(), await created.text()).toBe(201);
  const task = (await created.json()) as { id?: string; task?: { id: string } };
  state.taskId = task.id ?? task.task!.id;

  const notes = (await (await analyst.get("/api/v1/notifications?unread=1")).json()) as { items: { type?: string; title: string }[]; unreadCount: number };
  expect(notes.unreadCount).toBeGreaterThan(0);

  const done = await analyst.patch(`/api/v1/tasks/${state.taskId}`, { data: { status: "DONE" } });
  expect(done.status(), await done.text()).toBe(200);

  const comment = await analyst.post(`/api/v1/tasks/${state.taskId}/comments`, { data: { body: "Done — see attached analysis." } });
  expect(comment.status(), await comment.text()).toBe(201);
  const comments = await (await admin.get(`/api/v1/tasks/${state.taskId}/comments`)).text();
  expect(comments).toContain("Done — see attached analysis.");

  // Mark-all-read clears the unread count.
  expect((await analyst.post("/api/v1/notifications/read-all")).status()).toBe(200);
  const after = (await (await analyst.get("/api/v1/notifications")).json()) as { unreadCount: number };
  expect(after.unreadCount).toBe(0);

  expect((await admin.delete(`/api/v1/tasks/${state.taskId}`)).status()).toBe(200);
  expect((await admin.get(`/api/v1/tasks/${state.taskId}`)).status()).toBe(404);
});

test("documents: validated upload, authorised download, other tenants blocked", async () => {
  const admin = await as("northwindAdmin");
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  const upload = await admin.post("/api/v1/documents", {
    multipart: {
      workspaceId: state.workspaceId!,
      projectId: state.projectId!,
      file: { name: "analysis.pdf", mimeType: "application/pdf", buffer: pdf },
    },
  });
  expect(upload.status(), await upload.text()).toBe(201);
  const doc = (await upload.json()) as { id?: string; document?: { id: string } };
  state.documentId = doc.id ?? doc.document!.id;

  const dl = await admin.get(`/api/v1/documents/${state.documentId}/download`);
  expect(dl.status()).toBe(200);
  expect(dl.headers()["content-disposition"]).toContain("attachment");
  expect(dl.headers()["x-content-type-options"]).toBe("nosniff");

  const cedar = await as("cedarAdmin");
  expect((await cedar.get(`/api/v1/documents/${state.documentId}/download`)).status()).toBe(404);
  const anon = await pwRequest.newContext({ baseURL });
  expect((await anon.get(`/api/v1/documents/${state.documentId}/download`)).status()).toBe(401);
  await anon.dispose();

  // Disguised executable is rejected.
  const fake = await admin.post("/api/v1/documents", {
    multipart: { workspaceId: state.workspaceId!, file: { name: "invoice.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ\x90\x00not a pdf") } },
  });
  expect(fake.status()).toBe(422);
});

test("role restrictions: viewers and clients cannot reach admin or employee areas", async () => {
  const analyst = await as("northwindAnalyst");
  expect((await analyst.get("/api/v1/admin/users")).status()).toBeGreaterThanOrEqual(403);
  expect((await analyst.get("/api/v1/experiments")).status()).toBe(404);
  const employee = await as("employee");
  expect((await employee.get("/api/v1/admin/users")).status()).toBeGreaterThanOrEqual(403);
  expect((await employee.get("/api/v1/moderation/queue")).status()).toBe(404);
  // Client admin cannot escalate a member to OWNER.
  const admin = await as("northwindAdmin");
  const analystId = ((await (await analyst.get("/api/v1/me")).json()) as { profile: { id: string } }).profile.id;
  const escalate = await admin.patch(`/api/v1/workspaces/${state.workspaceId}/members/${analystId}`, { data: { role: "OWNER" } });
  expect(escalate.status()).toBe(403);
});

test("contact form submission persists and is visible to administrators", async () => {
  const anon = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const res = await anon.post("/api/v1/contact", {
    data: {
      name: "E2E Visitor",
      email: "visitor@example.org",
      company: "Example Org",
      interest: "riva",
      message: "We'd like a demonstration of RIVA validation workflows.",
      consentContact: true,
      website: "",
    },
  });
  expect(res.status(), await res.text()).toBe(200);
  await anon.dispose();
  const admin = await as("admin");
  const inquiries = await (await admin.get("/api/v1/admin/inquiries")).text();
  expect(inquiries).toContain("visitor@example.org");
});
