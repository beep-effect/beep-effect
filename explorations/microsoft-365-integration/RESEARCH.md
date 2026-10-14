# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## External Landscape (researched 2026-06-18)

Sourced from a deep, adversarially-verified web sweep (6 dimensions, primary
sources = Microsoft Learn, official GitHub, npm). Load-bearing claims were
re-checked against primary docs; numbers tied to throttling/limits should be
re-verified before code relies on them.

### 1. Microsoft Graph API surface

- **One unified REST API.** Microsoft Graph `v1.0` (`https://graph.microsoft.com/v1.0`)
  covers every surface the practice needs — SharePoint/OneDrive (`driveItem`),
  Outlook mail & calendar, Teams (`chatMessage`), Excel (`workbook`), Microsoft
  Search, To Do, Planner — under one bearer-token scheme. One driver suffices;
  each resource family still needs its own least-privilege scope.
  [overview](https://learn.microsoft.com/en-us/graph/api/overview?view=graph-rest-1.0)
- **File content download.** `GET …/driveItem/{id}/content` returns `302 Found`
  → a short-lived preauthenticated `@microsoft.graph.downloadUrl` (no `Authorization`
  header; supports `Range`/`206`). Robust ingest pattern:
  `GET …?select=id,@microsoft.graph.downloadUrl` then fetch the URL (avoids the
  CORS/302 problem and lets us control the HTTP client). Large upload via
  `createUploadSession` (fragments < 60 MiB, multiples of 320 KiB).
  [download content](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0)
- **No structured Word API.** Excel has a rich structured workbook API
  (worksheets/ranges/tables/charts/functions; `.xlsx` in business storage only),
  but Word `.docx` is **only** retrievable as raw OOXML bytes or converted via
  `?format=pdf`. **Integration seam:** after content download, extract text +
  character offsets through the existing `@beep/tika` / `@beep/pandoc-ast` /
  `@beep/md` pipeline.
  [Excel](https://learn.microsoft.com/en-us/graph/api/resources/excel?view=graph-rest-1.0) ·
  [convert to PDF](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content-format?view=graph-rest-1.0) ·
  [no Word API (MS staff Q&A)](https://learn.microsoft.com/en-us/answers/questions/1424335/graph-api-for-microsoft-word)
- **Incremental ingest.** Delta queries (`…/delta` → `@odata.deltaLink`;
  `410 Gone` ⇒ resync; delta-with-token costs only 1 SharePoint resource unit)
  plus change-notification subscriptions/webhooks. Subscription max lifetimes
  vary sharply (driveItem/list ~30 days, mail/event 7 days, Teams 3 days); all
  require renewal; the driveItem webhook is a **hint** (no changed-file detail)
  → on notification, re-run a delta query.
  [delta](https://learn.microsoft.com/en-us/graph/delta-query-overview) ·
  [subscription](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0)
- **Throttling is layered.** Global 130,000 req/10s per app; Outlook 10,000
  req/10 min + 4 concurrent per app+mailbox; SharePoint/OneDrive uses a separate
  resource-unit model (1,250–6,250 RU/min by license tier). Always honor
  `Retry-After`. Recent changes: 2025-09-30 the per-app/per-user per-tenant limit
  was halved; 2025-08-25 Teams message/export APIs are **no longer metered**
  (`model=A/B` ignored), de-risking Teams ingest.
  [throttling](https://learn.microsoft.com/en-us/graph/throttling) ·
  [limits](https://learn.microsoft.com/en-us/graph/throttling-limits) ·
  [Teams metering removed](https://learn.microsoft.com/en-us/graph/teams-licenses)
- **SharePoint metadata.** Custom library columns (matter no., client, app no.)
  live on `listItem.fields`; read by `$expand=listItem($expand=fields)`. The
  Search API returns custom fields only for `entityType=listItem`.

### 2. Authentication & identity

- **Delegated by default.** Delegated permissions (app acts on behalf of the
  signed-in attorney) keep every read/write attributable and bounded by the
  attorney's own access — the right posture for privileged client material.
  Application/app-only grants tenant-wide access with no user; reserve it strictly
  for a future headless "librarian" daemon, tightly scoped.
  [permissions overview](https://learn.microsoft.com/en-us/graph/permissions-overview)
- **Flow: authorization code + PKCE** as a **public client** via `@azure/msal-node`
  (MIT, v5.x) in the Bun sidecar, capturing the redirect on a `http://127.0.0.1`
  loopback. Request `offline_access` + least-privilege delegated scopes; MSAL
  handles silent refresh (~60–90 min access tokens; refresh tokens ~90 days).
  [MSAL flows](https://learn.microsoft.com/en-us/entra/identity-platform/msal-authentication-flows) ·
  [@azure/msal-node](https://www.npmjs.com/package/@azure/msal-node)
- **Avoid device code & ROPC.** Microsoft began default-**blocking** device code
  flow via Conditional Access in Feb 2025 after the STORM-2372 phishing campaign;
  ROPC is deprecated and incompatible with MFA/CA.
  [block auth flows](https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-block-authentication-flows)
- **Token storage.** Persist the MSAL cache **encrypted** via
  `@azure/msal-node-extensions` (DPAPI / Keychain / libsecret) inside the
  sidecar — never the Tauri renderer.

### 3. MCP servers (the "buy" options) — none cleanly fit

- **Official "Microsoft MCP Server for Enterprise"** = hosted, preview,
  **READ-ONLY**, scoped to **Entra identity/directory** only (no mail/files/
  calendar/SharePoint/Teams; all scopes `MCP.*.Read.All`; delegated-only). Wrong
  shape for a document/mail product.
  [overview](https://learn.microsoft.com/en-us/graph/mcp-server/overview)
- **Official "Work IQ" (Microsoft Agent 365) MCP servers** = read+**write**
  across Mail/Calendar/SharePoint/OneDrive/Word/Teams, consumable from Claude
  Code via a registered Entra app — but **preview, hosted-only, and require a
  Microsoft 365 Copilot license** (now also usage-billed via Copilot Credits
  starting 2026-06-16). Real **future managed-write** path given Copilot is
  present; not a local-first ingest path.
  [Work IQ MCP overview](https://learn.microsoft.com/en-us/microsoft-agent-365/tooling-servers-overview)
- **Community — Softeria `@softeria/ms-365-mcp-server`** (MIT, ~786★, ~200 typed
  tools, `--read-only`, `--allowed-scopes`, keytar/Key Vault token storage,
  stdio + HTTP) = strongest self-hostable buy / reference implementation. Built
  on `@azure/msal-node` + `@modelcontextprotocol/sdk` + zod (not Effect).
  [GitHub](https://github.com/Softeria/ms-365-mcp-server)
- **Community — `@merill/lokka`** (MIT, ~262★) = generic Graph/Azure passthrough
  (one arbitrary-call tool, `USE_GRAPH_BETA=true` default). Convenient for ad-hoc
  admin; ill-suited as the product's auditable data path.
  [GitHub](https://github.com/merill/lokka)
- **MCP security spec** forbids token passthrough and mandates audience-bound,
  least-privilege tokens — easiest to guarantee when you own the driver.
  [MCP authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization) ·
  [security best practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices)

### 4. TypeScript toolchain (the "build" path)

- **Recommended: raw HTTP + Schema + types-only.** Call Graph REST `v1.0`
  directly via `effect/http` `FetchHttpClient` + `effect/Schema`
  decoding, pulling request/response **types** (not runtime) from
  `@microsoft/microsoft-graph-types` (v2.43.x, 0 runtime deps). Mirrors the
  existing `@beep/hubspot` driver and keeps one transport for uniform spans/
  retry/redaction.
- **Avoid the SDKs for a thin subset.** `@microsoft/microsoft-graph-client`
  (fluent, v3.0.7) has not shipped since 2023-09 and bundles its own fetch
  middleware; `@microsoft/msgraph-sdk` (Kiota) is still `1.0.0-preview`, split
  across 70+ packages, with documented tree-shaking issues. They only earn their
  keep for heavy helpers (PageIterator, `$batch` ≤20, LargeFileUploadTask) — cheap
  to re-implement against the REST contracts.
  [Graph SDK overview](https://learn.microsoft.com/en-us/graph/sdks/sdks-overview) ·
  [Kiota subset client](https://learn.microsoft.com/en-us/graph/sdks/generate-with-kiota)

### 5. Compliance & security (law-firm context)

- **Sensitivity labels keep encrypted bytes ciphertext over Graph.** Purview/RMS
  (Azure Rights Management) files stay encrypted wherever they go. Programmatic
  decryption needs either tenant-wide `Content.SuperUser` (a "read everything
  ever encrypted" grant to **avoid**) or a delegated user context with that
  user's usage rights → another reason to default to delegated auth and granular
  `Sites.Selected` over `*.All`.
  [metered/SuperUser context](https://learn.microsoft.com/en-us/graph/metered-api-list)
- **Microsoft APIs Terms of Use** govern caching M365 data in a third-party app:
  minimum data + minimum permissions, no scraping/copies "except as necessary",
  honor deletions/corrections, retention/deletion policy, a published privacy
  statement, security obligations, and Microsoft audit rights.
- **ABA Formal Opinion 512 (Jul 2024)** layers the lawyer's own duties: AI
  competence, "reasonable measures" for confidentiality, vendor due diligence,
  breach notification, and informed client consent for self-learning GAI.
- **Supporting controls via Graph/Entra** are first-class: least-privilege
  (`Sites.Selected`), Conditional Access, admin-consent governance, unified audit
  + Entra sign-in logs, data residency, eDiscovery/holds, and information
  barriers ("ethical walls"). For a solo practice the attorney is both Global
  Admin and the consenting party — less consent friction, all liability
  concentrated on one person.

### 6. Build-vs-buy-vs-hybrid — recommendation: HYBRID

Build a thin native `@beep/m365` Effect driver wrapping only the verbs the
product needs (ingest files, read mail/calendar, write-back), and expose it as
the repo's **own** MCP server via `effect/ai/McpServer` + `Tool.make` /
`Toolkit` (the `@beep/nlp-mcp` model). The repo already ships both ingredients
(`@beep/box` driver pattern + `@beep/nlp-mcp` server pattern), so this is
incremental, not greenfield. The MCP no-token-passthrough rule and scope
minimization are easiest to honor when you own the driver; a 200+-tool generic
sidecar advertises a far larger surface than a bespoke driver exposing only
e.g. `Files.Read.All`, `Mail.Read`, `Calendars.ReadWrite`. Pragmatic blend:
ship the hybrid native driver as the durable core; optionally adopt Softeria
short-term (read-only + narrowed `--allowed-scopes`) as a coverage stopgap; keep
Work IQ on the watch-list for managed write-back once it exits preview. Cost of
owning a slice of Graph's large surface is bounded by keeping the verb set tiny,
pinning `v1.0`, and tracking the changelog (24-month deprecation policy).
[versioning policy](https://learn.microsoft.com/en-us/graph/versioning-and-support)

## In-Repo Capability Inventory

Verify exact export paths with ripgrep / the `repo-symbol-discovery` skill
before composing.

- **HAVE** — `@beep/box` (`packages/drivers/box`): driver pattern — `S.Class`
  config with `S.Redacted` secrets + `Config.redacted`, `Box.errors.ts`,
  `Context.Service` + Layer factories. Closest structural analogue.
- **HAVE** — `@beep/hubspot`: canonical raw-HTTP driver — `effect/http`
  `FetchHttpClient` + `Schema` decoding + bearer token. The D2 precedent.
- **HAVE** — `@beep/nlp-mcp` (`packages/drivers/nlp-mcp/src/Server.ts`):
  Effect-native MCP — `effect/ai/McpServer`, `Tool.make` / `Toolkit`,
  `makeServerLayer` over `McpServer.layerStdio`, `failureMode: "return"` →
  `AiToolError`; spans annotate counts/sizes, never raw content. The D1 precedent.
- **HAVE** — `effect/http` (`FetchHttpClient`,
  `HttpClientRequest.bearerToken`/`setHeader`,
  `HttpClientResponse.filterStatusOk`); `S.Redacted` / `Config.redacted` /
  `Redacted.value` for secrets.
- **HAVE** — `apps/professional-desktop` (Tauri + React + Bun sidecar RPC-on-HTTP
  `:3939`, PGlite; `src/runtime/Layer.ts`) — host for the driver + stdio MCP.
- **HAVE** — ingest-pipeline targets: `@beep/file-processing`, `@beep/tika`,
  `@beep/md`, `@beep/pandoc-ast`, `@beep/langextract` (span grounding) →
  `@beep/epistemic-domain` (`Evidence` / `Claim` / `Activity` / provenance).
- **HAVE (thin)** — `law-practice` slice (`@beep/law-practice-domain`: `Matter`,
  `PatentAsset`) — matter-wall mapping target.
- **NET-NEW** — `@beep/m365` driver; its MCP toolkit/server; MSAL encrypted
  token-cache persistence; delta-sync state store; matter-to-M365 mapping port.
  New deps: `@azure/msal-node`, `@microsoft/microsoft-graph-types` (types only),
  `@azure/msal-node-extensions`.

## Constraints Discovered

- **No structured Word content API** — `.docx` ingest must go through the repo's
  text-extraction pipeline after byte download.
- **Sensitivity-labeled/encrypted files** are unreadable as plaintext over Graph
  without RMS rights; `Content.SuperUser` is a tenant-wide grant to avoid.
- **Throttling is per-service and layered**; the driver must honor `Retry-After`
  and budget SharePoint resource units (a solo tenant sits in the lowest tier).
- **Microsoft Search is delegated-only** — a future headless app-only librarian
  must fall back to delta + drive enumeration for retrieval.
- **Official write-capable MCP (Work IQ) is Copilot-gated, preview, hosted-only**
  — fine as a future managed-write option, not as the local-first ingest path.
- **MCP spec forbids token passthrough** and mandates least-privilege,
  audience-bound tokens — a governance constraint favoring an owned driver.
- **Compliance**: Microsoft APIs ToU (min data/min perms, honor deletions) +
  ABA Op 512 (confidentiality, vendor due diligence, client consent).
