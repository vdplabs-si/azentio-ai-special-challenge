# azentio.ai — Website & Intelligent Collaboration Portal

Azentio.ai Build Labs submission. One Next.js application with:

- **A public website**: offerings catalogue, solutions by industry, media, insights, about, careers, demo enquiries, hackathon registration and public live sessions.
- **A secure portal**: distinct **employee** and **client** experiences, governed **collective learning**, workspaces, projects, tasks, documents, Playground sandboxes, live sessions, administration, and the AIRA assistant.

Everything is backed by PostgreSQL (Voroa Managed Postgres), and all access control is enforced on the server.

> Product details are indicative and subject to validation. The Playground uses synthetic data only. Its outputs are simulations, not credit or business decisions.

---

## Contents
1. [Quick start](#quick-start)
2. [Environment variables](#environment-variables)
3. [Database & migrations](#database--migrations)
4. [Deploying on Voroa](#deploying-on-voroa)
5. [OAuth setup](#oauth-setup)
6. [Architecture](#architecture)
7. [Roles & access model](#roles--access-model)
8. [Collective-learning workflow](#collective-learning-workflow)
9. [Website design and the 3D scene](#website-design-and-the-3d-scene)
10. [Testing](#testing)
11. [Known limitations](#known-limitations)

---

## Quick start

Requirements: Node ≥ 22.12 and npm ≥ 10. Bun ≥ 1.2 is optional and used as a fast local runner. You also need a PostgreSQL database; use a Voroa Managed Postgres instance.

```bash
cp .env.example .env            # then set DATABASE_URL (with sslmode=require) and AUTH_SECRET
npm ci                          # or: bun install   (npm's package-lock.json is the canonical lockfile)
npm run db:migrate              # prisma migrate deploy
npm run db:sync-catalogue       # reference data: offerings, internal org, playground scenarios
npm run db:seed                 # OPTIONAL, development only: synthetic orgs + test accounts
npm run dev                     # or: bun run dev   → http://localhost:3000
```

Every script runs with both `npm run <script>` and `bun run <script>`:

| Script | Purpose |
|---|---|
| `dev` / `build` / `start` | Next.js dev server, production build, production server (honours `PORT`) |
| `typecheck` / `lint` | `tsc --noEmit` / ESLint |
| `test` | Unit tests with `bun test` (permission matrix, learning lifecycle, privacy scan, engines) |
| `test:e2e` | Playwright end-to-end tests (see [Testing](#testing)) |
| `db:migrate` | Apply migrations (`prisma migrate deploy`) |
| `db:sync-catalogue` | Idempotent reference data, safe on every deploy |
| `db:seed` | **Development-only** seed. Refuses to run in production unless `ALLOW_SEED=1` |
| `db:migration:create` | Print the SQL diff between existing migrations and the schema, for authoring a new migration |

The **development seed** creates clearly labelled fictional organisations: Northwind Bank (synthetic), Cedar Takaful (synthetic) and Harbor Microfinance (synthetic). It also creates test accounts. The password comes from `SEED_PASSWORD`; if that's unset, a random password is printed once.

| Account | Persona |
|---|---|
| `dev.admin@azentio.com` | Super admin + portal admin |
| `dev.moderator@azentio.com` | Learning moderator |
| `dev.product@azentio.com` | Product owner |
| `dev.publisher@azentio.com` | Content + broadcast publisher |
| `dev.employee@azentio.com` | Employee, no grants |
| `admin@northwind.example` | Client administrator |
| `analyst@northwind.example` | Client member |
| `admin@cedar.example` | Client owner |
| `member@harbor.example` | Client member |

The seed also loads the problem statement's scenario. Three organisations each submit an observation about seasonal SME cash-flow treatment; all three are `SUBMITTED` and wait in the moderation queue.

## Environment variables

See [`.env.example`](.env.example). Without the required values the app fails fast with a clear message.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Voroa connection URL. Production refuses to start without `sslmode=require` (or `verify-*`). |
| `DATABASE_CA_CERT` | – | A PEM CA certificate. Upgrades TLS to full certificate verification. |
| `AUTH_SECRET` | ✅ | 32+ random characters. Used as the HMAC key for one-time codes and rate-limit keys. |
| `AUTH_URL` | ✅ in prod | Public base URL, used for OAuth callbacks, invitation links and the CSRF origin check. Must be `https://` in production (plain HTTP is accepted only on loopback). `Secure` / `__Host-` cookies, HSTS and `upgrade-insecure-requests` follow its scheme. HSTS and `upgrade-insecure-requests` are fixed at build time, and if `AUTH_URL` is unset during the build they default to on. |
| `GOOGLE_CLIENT_ID/SECRET` | – | Enables Google sign-in. |
| `GITHUB_CLIENT_ID/SECRET` | – | Enables GitHub sign-in. |
| `RESEND_API_KEY`, `EMAIL_FROM` | prod | Email codes and invitations. Development without a key prints codes to the server console, labelled `[DEV MAIL]`. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_ZDR` | – | AIRA. Without a key the assistant shows as unavailable and never simulates answers. |
| `EMPLOYEE_EMAIL_DOMAIN` | – | Default `azentio.com`. |
| `LEARNING_MIN_COHORT` | – | Default `3`. The minimum number of distinct organisations before shared trend counts are shown. |
| `MAX_UPLOAD_MB` | – | Default `5`. |
| `BOOTSTRAP_SUPER_ADMIN_EMAIL` | – | Grants the first super admin when `db:sync-catalogue` runs. The account must already exist and be verified. |

## Database & migrations

- **ORM:** Prisma 7 with the `@prisma/adapter-pg` driver adapter. The schema is in [`prisma/schema.prisma`](prisma/schema.prisma) and migrations are in [`prisma/migrations`](prisma/migrations).
- **Changing the schema:**
  1. Edit the schema.
  2. Write the diff into a new folder: `npm run db:migration:create > prisma/migrations/<timestamp>_<name>/migration.sql`.
  3. Apply it with `npm run db:migrate`.

  This approach avoids needing shadow-database permissions on managed Postgres.
- **TLS:** Voroa Postgres is TLS-only, and its certificate is not signed by a public CA. Voroa therefore documents `sslmode=require`: the connection is encrypted but the CA isn't pinned. node-postgres would otherwise treat `require` as `verify-full`, so [`src/lib/db.ts`](src/lib/db.ts) translates the setting explicitly. Set `DATABASE_CA_CERT` for full verification.
- **Seeding:** `db:sync-catalogue` writes reference data only and is safe in production. `db:seed` creates synthetic demo data and is refused in production.

## Deploying on Voroa

Voroa has no CLI yet, so deployment uses the dashboard (see https://getvoroa.com/docs/).

1. **Push this repository to GitHub.** In Voroa, choose **Connect GitHub**, install the Voroa app on the repository, then **New service** → select the repository and branch.
2. **Database:** Voroa may offer to create Postgres with the service, in which case it injects `DATABASE_URL` for you. Otherwise create a Managed PostgreSQL database and copy the URL from the **Connect** tab, replacing the masked password. Make sure the URL ends with `?sslmode=require`.
3. **Build command:** `npm ci && npx prisma generate && npm run build`
4. **Start command:** `npx prisma migrate deploy && npm run db:sync-catalogue && npm run start`

   Voroa has no documented pre-deploy hook. `migrate deploy` is idempotent and uses an advisory lock.
5. **Node version:** pinned through `.nvmrc` (22) and `engines`. Voroa's default for new services is Node 20, so the pin matters.
6. **Environment variables:** set the variables from the table above under the service's **Environment**. Voroa stores them encrypted. Set `AUTH_URL` to the service's HTTPS URL or custom domain.
7. **Health check path:** `/api/health`. It returns 200 when the database round-trip succeeds, otherwise 503.
8. **Deploy.** Voroa streams logs during the build. The app writes structured JSON logs with credentials redacted. HTTPS is automatic, including on custom domains.
9. **First admin:**
   1. Sign up with your work email and verify it.
   2. Set `BOOTSTRAP_SUPER_ADMIN_EMAIL` to that address and redeploy. The start command runs `db:sync-catalogue`, which grants the role.
   3. Remove the variable afterwards.

**Docker (optional):** the `Dockerfile` builds a production image. Select the Docker runtime in Voroa and point it at `Dockerfile`. Secrets are read at runtime and are never passed as build args.

## OAuth setup

Both providers use the authorization-code flow with state cookies; Google also uses PKCE. They're implemented with [`arctic`](https://arcticjs.dev). Until both of a provider's environment values are set, its button stays disabled and shows a configuration message.

- **Google:**
  - Create a Google Cloud OAuth client of type **Web application**.
  - Authorized redirect URI: `${AUTH_URL}/api/auth/oauth/google/callback`.
  - The user must have a verified email. For `@azentio.com` addresses, the Workspace hosted-domain claim (`hd`) must also match.
- **GitHub:**
  - Create a GitHub OAuth App with callback URL `${AUTH_URL}/api/auth/oauth/github/callback`.
  - The app uses the account's primary *verified* email.
- **Scope of OAuth sign-in:** OAuth proves identity only. It never creates a trusted tenant membership by itself.
  - **Employees:** a verified `@azentio.com` identity creates a `PENDING_APPROVAL` membership that a portal admin approves.
  - **Clients:** clients join by invitation.

## Architecture

```
src/
  app/(site)/        public website (server components, SEO metadata, sitemap/robots)
  app/(auth)/        sign-in, registration, invitation landing
  app/portal/(gate)/ onboarding (terms + learning notice) and access-status pages
  app/portal/(app)/  authenticated portal (sidebar shell)
  app/api/auth/      register, login, logout, session, email codes, OAuth start/callback
  app/api/v1/        REST API (consistent {error:{code,message,details}} envelope)
  lib/auth/          sessions (hashed opaque tokens), Argon2id, email codes, OAuth, mailer
  lib/authz/         actor resolution, permission matrix, visibility (tenant isolation) builders
  lib/api/           handler wrapper (CSRF origin check, errors, no stack traces), rate limit, pagination
  server/services/   domain services — every authz + DB rule lives here
  server/learning/   observation lifecycle, privacy scan, coarsening, cohort suppression, DTOs
  server/playground/ deterministic synthetic-data engines
prisma/              schema, migrations, reference-data sync, dev seed
tests/unit           bun test (pure logic)      tests/e2e   Playwright
```

**Security controls**

- **Sessions:** a 256-bit random token is stored only as a SHA-256 hash. The cookie is HttpOnly, `SameSite=Lax`, `Secure` with the `__Host-` prefix in production, and has a 30-day sliding expiry. Sessions are revoked when a user is deactivated.
- **Passwords:** Argon2id via WebAssembly (`hash-wasm`, OWASP parameters, no native binary), compared in uniform time for unknown accounts.
- **One-time codes:** HMAC-hashed, with a 10-minute expiry, 5 attempts and single use.
- **CSRF:** every mutating `/api/v1` and `/api/auth` request is checked for a same-origin `Origin` header, in addition to `SameSite` cookies.
- **Rate limiting:** a PostgreSQL-backed fixed window covering login, codes, registration, contact, hackathon, invitations, uploads, AIRA and search.
- **Tenant isolation:** every query composes the visibility builders in `src/lib/authz/visibility.ts`. A resource the actor can't see returns **404**, which prevents IDOR probing. The active workspace is re-validated against memberships on every request; client-supplied tenant IDs are never trusted.
- **Headers:** CSP (`frame-ancestors 'none'`; video frames are limited to YouTube-nocookie and Vimeo), `nosniff`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in production.
- **Uploads:** type allow-list with magic-byte checks, a size limit and SHA-256. Files are stored privately in Postgres and downloaded only through an authorised route (`Content-Disposition: attachment`, `no-store`).
- **XSS:** user content is never rendered as HTML.

## Roles & access model

Access requires all of the following: the identity must be allowed by the resource's **audience**, the **membership** must be ACTIVE where tenancy applies, and the **action** must be authorised. Public resources are explicitly marked `PUBLIC`; missing metadata is never treated as public.

| Persona | How it's granted |
|---|---|
| Employee | Verified `@azentio.com` identity **and** an ACTIVE membership of the internal organisation, approved by a portal admin. Employee status confers no administrator rights. |
| Client member / Client admin | Workspace membership through a single-use, 7-day invitation bound to the verified email. Client admins can invite and revoke members and assign ADMIN, MEMBER or VIEWER roles within their own organisation only. They can't grant OWNER, platform roles or entitlements. |
| Learning moderator | `LEARNING_MODERATOR` grant. Sees only *submitted* contributions, never unsubmitted drafts. |
| Content publisher | `CONTENT_PUBLISHER` grant. Manages banners, public media and insights. |
| Broadcast publisher | `BROADCAST_PUBLISHER` grant. Manages live sessions and recordings. |
| Product owner | `PRODUCT_OWNER` grant. Works with approved shared evidence and improvement ideas. |
| Portal admin | `PORTAL_ADMIN`. Manages organisations, entitlements, users and grants, and approves employees. Viewing a client's private content requires a **time-boxed support-access grant** with a reason, which is audited. |
| Super admin | `SUPER_ADMIN`. The only role that can grant `PORTAL_ADMIN` or `SUPER_ADMIN`. Nobody can change their own grants. |

The generic collaboration roles map onto this model. **Workspace Owner/Admin** are the membership roles OWNER/ADMIN. **Project Manager** is the project role MANAGER. **Team Member** is MEMBER at workspace level or CONTRIBUTOR at project level. **Viewer** is VIEWER.

## Collective-learning workflow

1. **Capture:** a structured observation form covering type, offering, industry, region, observation period, evidence type, confidence, topics and links.
   - Every observation starts as a **private draft**. Saving never shares it.
   - An automated scan flags likely sensitive content: emails, phone numbers, IBANs, card numbers (Luhn-checked), account numbers, credentials, exact amounts and dates. The scan is **not a privacy guarantee**, and the UI says so.
2. **Sharing choice:** private to the author, within the author's organisation, or proposed to the approved learning community. Four consents are recorded separately and append-only: (a) store and process, (b) publish a reviewed shared version, (c) organisation attribution, (d) future training.
3. **Moderation:** moderators can return a submission for clarification, reject it, or publish a **separate, redacted shared copy**. The shared copy has coarsened region and period, and organisation attribution only with consent and moderator approval. Publishing a flagged item requires the moderator to acknowledge the flags. Duplicate hints are based on keyword similarity.
4. **Lifecycle:** `DRAFT → SUBMITTED → (RETURNED ↔ SUBMITTED) → PUBLISHED | REJECTED`. `PUBLISHED → SUSPENDED → PUBLISHED | REJECTED`, and an author can withdraw at any point. A material edit creates a new version that needs fresh review. Every transition is audited and notifies the author.
5. **Shared feed and themes:**
   - The shared feed is searchable and filterable, with saved searches, bookmarks, comments (inheriting the copy's audience, moderatable and reportable), quality feedback and CSV export. All of these use the same visibility rule.
   - Shared payloads never include tenant IDs, author profiles, links, attachments or reviewer notes.
   - Theme dashboards count **distinct** contributing organisations and suppress counts below `LEARNING_MIN_COHORT`.
6. **Improvement ideas:** created by product owners from approved evidence, with statuses Proposed → Under review → Planned → In progress → Released / Not proceeding. Every status change is audited. Clients see the title, a plain-language status, the owner/team, the last update and an approved public note, but never internal notes or priority.
7. **Withdrawal propagation:** shared reads, search, counts, saved searches, export and AIRA retrieval are all live, uncached queries, so a withdrawal takes effect **immediately (0 s)** in this deployment. The production target if a search index or CDN is added is **≤ 60 seconds**. Material that others have already viewed, and third-party copies, can't be recalled automatically. Withdrawal doesn't "untrain" anything; no model is trained on contributions.

**AIRA** summarises only approved shared copies and permitted content, and cites them. It runs through OpenRouter with `provider.data_collection = "deny"`. Raw private records are never sent to the AI provider.

**Federated learning** (the PDF's optional P2 track) is **not implemented**. Retrieval and summarisation don't retrain any model.

## Website design and the 3D scene

The public site tells one story: **governed collective learning**. The homepage hero shows it in WebGL (three.js via `@react-three/fiber`), driven by scroll:

1. **Contribute.** Each institution is a green point cloud inside its own boundary.
2. **Review.** Observations travel to a translucent membrane. As they cross it, their positions snap to a coarse grid (de-identification) and they turn mint.
3. **Share and improve.** They settle into a shared seasonal cash-flow surface (the Build Labs scenario), and pulses travel back to every institution.

Other heroes reuse the same scene in calmer presets:

| Preset | Pages |
|---|---|
| `surface` | Products. Each product detail page gets its own deterministic shape |
| `membrane` | Technology |
| `institutions` | About and Solutions. The current industry is highlighted |
| `lab` | AI Lab and Hackathon. You can drag it |

- **Colour carries meaning.** Green is an institution's own data and the primary action. Mint is used *only* for approved, shared learning.
- **Type.** One variable family, Archivo. Its width axis separates expanded display text from normal-width body text.

**Delivery and fallbacks** (`src/components/three/`):
- **Server render:** every hero renders an SVG poster first. The scene loads only after `load` plus idle, in a separate chunk (`next/dynamic`, `ssr: false`).
- **Capability gate:** a silent check decides between the live canvas, a single still frame (`prefers-reduced-motion`) and the poster. The poster is used for Save-Data, no or software-only WebGL2, low-end devices, and page backdrops below 1024 px.
- **At runtime:**
  - rendering pauses offscreen and in hidden tabs;
  - a frame-time governor lowers the particle count and pixel ratio;
  - a lost WebGL context falls back to the poster.
- **What it doesn't need:** no textures, workers or network fetches, so the CSP is unchanged.
- **Import boundary:** an ESLint rule keeps `three` imports inside `src/components/three`, so it never reaches the portal or auth pages.
- **QA override:** set `localStorage["az:scene"]` to `"force"` (allows software GL) or `"off"`.

## Testing

```bash
npm run typecheck && npm run lint
npm test                                   # bun test tests/unit
npm run build
E2E_DATABASE_URL="<voroa-url>&schema=e2e" npx playwright test
```

The e2e global setup migrates and seeds an **isolated schema**; it refuses to run against `public`. The suites cover:
- public routes and the health check;
- authentication, session persistence and logout;
- protected routes and API 401s;
- the CSRF origin check and disabled OAuth states;
- tenant isolation, role restrictions and the collaboration CRUD flows;
- the full moderation scenario, including withdrawal;
- a **portal crawl**: every seeded persona signs in and walks every reachable portal page. It fails on any 5xx response, route-error fallback, uncaught exception or console error;
- **the 3D scene:**
  - forced canvas and scroll stages;
  - a still frame under reduced motion;
  - silent poster fallbacks for Save-Data and no WebGL;
  - three.js never loads on auth pages.

`E2E_SERVER=dev` runs the same suites against `next dev`, which surfaces hydration warnings.

## Known limitations

- **Email:** delivery requires `RESEND_API_KEY`. Without it, development prints codes to the console, production refuses to send, and the UI never claims an email was delivered. Password reset isn't offered until a provider is configured.
- **Production SSO:** the PDF's preferred production identity provider, Microsoft Entra ID via OIDC, isn't wired up. The email-code, Google and GitHub flows are.
- **Support tickets:** stored in-app, with no external helpdesk integration.
- **P2 federated model-training track:** not built.
