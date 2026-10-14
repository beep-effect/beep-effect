# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-06-18 — architecture leaning (build vs buy vs hybrid)

**Question:** Should M365 integration be a native `@beep/m365` Effect driver, an
off-the-shelf M365 MCP server run as a sidecar, or both?

**Answer:** HYBRID. Build a thin native `@beep/m365` Effect driver that wraps
only the Graph verbs the product needs, and expose it as the repo's *own* MCP
server via `effect/ai/McpServer` + `Tool.make` / `Toolkit` (the
`@beep/nlp-mcp` model).

**Rationale:** Owning the driver keeps OpenTelemetry spans, typed errors,
`S.Redacted` secrets, and least-privilege scopes; the MCP authorization spec
forbids token passthrough and mandates audience-bound, least-privilege tokens,
which is easiest to guarantee when you mint your own Graph tokens. The repo
already ships both ingredients (`@beep/box` driver pattern + `@beep/nlp-mcp`
server pattern), so this is incremental, not greenfield. *Rejected:*
pure-driver-no-MCP (defers agent tool access we'll want); off-the-shelf sidecar
as the durable core (a third-party process would hold the attorney's privileged
tokens, with weaker typing and no Effect telemetry). *Stopgap allowed:* Softeria
`@softeria/ms-365-mcp-server` in read-only mode with narrowed `--allowed-scopes`
may serve as a short-term coverage bridge or reference implementation.

## 2026-06-18 — build toolchain

**Question:** Raw HTTP, the fluent Graph client, or the Kiota SDK for calling
Microsoft Graph from the driver?

**Answer:** Raw HTTP. Call Graph REST `v1.0` directly via `effect/http`
`FetchHttpClient` + `effect/Schema` decoding, pulling request/response **types**
(not runtime) from `@microsoft/microsoft-graph-types`; use `@azure/msal-node`
for OAuth.

**Rationale:** Mirrors the existing `@beep/hubspot` raw-HTTP + Schema driver and
keeps one transport for uniform spans/retry/redaction. The fluent client
(`@microsoft/microsoft-graph-client`) has not shipped since 2023-09 and bundles
its own fetch middleware; the Kiota SDK (`@microsoft/msgraph-sdk`) is still
`1.0.0-preview`, split across 70+ packages, with documented tree-shaking
issues. Re-implement only the helpers worth it (paging, `$batch` ≤ 20,
large-file upload).

## 2026-06-18 — authentication model

**Question:** Which OAuth flow and permission model for accessing Graph?

**Answer:** Delegated permissions via OAuth2 **authorization code + PKCE** as a
public client (`@azure/msal-node`) in the Bun sidecar, with a `http://127.0.0.1`
loopback redirect; request `offline_access` + least-privilege delegated scopes;
persist the MSAL token cache encrypted (`@azure/msal-node-extensions`).

**Rationale:** Delegated access is attributable and bounded by the attorney's
own rights — the right posture for privileged client material. *Rejected:*
device code flow (Microsoft began default-blocking it via Conditional Access in
Feb 2025 after the STORM-2372 phishing campaign) and ROPC (deprecated,
MFA-incompatible). App-only/client-credentials is reserved strictly for a future
headless "librarian" daemon, tightly scoped — never the tenant-wide
`Content.SuperUser`.

## 2026-06-18 — Copilot present, Work IQ as future write path

**Question:** Does the environment have a Microsoft 365 Copilot license, and
does it change the plan?

**Answer:** Yes — the build account is M365 Business professional + Copilot. This
makes Microsoft's official **Work IQ (Agent 365) MCP servers** (read+write
Mail/Calendar/SharePoint/OneDrive/Word/Teams, consumable from Claude Code) a
real **future** managed-write option. Keep them on the watch-list for the
write-back phase; near-term read-only ingest still goes through the local-first
native driver (no Copilot/cloud dependency).

**Rationale:** Work IQ is preview, hosted-only, and Copilot-license/credits-
billed, so it is unsuitable as the local-first ingest path, but a governed,
observable managed-write surface is attractive for sensitive write-backs once it
is GA. *Open:* confirm Tom's production tenant also carries Copilot.

## 2026-06-18 — first slice scope and forward-compatibility

**Question:** What is the first concrete slice, and how read/write-capable must
the design be?

**Answer:** Read-only **document ingest** from OneDrive/SharePoint (delta sync +
content download → the local provenance loop) is v1. It requests and exercises
only **read** scopes. But the driver's service shape, auth, error, telemetry,
and scope model must be **write-ready from day one**, so the eventual "true
assistant" write-back phase is a scope/verb extension, not a rewrite.

**Rationale:** Read-only ingest is the lowest-risk wedge and matches the
existing ingest → candidate-claims loop; over-fitting to read-only would force a
later rewrite. Write-back may eventually route through the native driver's write
verbs **or** delegate to Work IQ (prior decision) — that choice is deferred.

## 2026-06-18 — v1 Graph scopes (delegated, read-only)

**Question:** Which Graph permission scopes does v1 request, and which are
reserved?

**Answer:** v1 requests delegated **read** scopes only: `offline_access`,
`User.Read`, `Files.Read.All`, `Sites.Read.All`, `Mail.Read`, `Calendars.Read`.
Reserved for phase 2 (not requested in v1): `Files.ReadWrite.All`,
`Sites.ReadWrite.All`, `Mail.Send`, `Calendars.ReadWrite`.

**Rationale:** Least-privilege for the read-only ingest wedge; `offline_access`
enables silent refresh. Prefer granular `Sites.Selected` for any future app-only
path. Requesting only read scopes keeps consent narrow and honors the MCP
scope-minimization guidance.

## 2026-06-18 — encrypted / sensitivity-labeled documents

**Question:** How does v1 handle Purview/RMS-encrypted matter files?

**Answer:** Detect, flag, and **skip** content extraction for encrypted items
(record them as known-skipped artifacts with their metadata). Do not attempt
programmatic decryption.

**Rationale:** RMS bytes stay ciphertext over Graph; decrypting would require the
tenant-wide `Content.SuperUser` grant (a "read everything ever encrypted"
privilege to avoid) or a delegated context with the user's usage rights.
Delegated-decrypt is deferred; v1 prioritizes a safe, auditable default.

## 2026-06-18 — provenance anchoring

**Question:** What gives a stable immutable anchor for prose-to-proof Evidence
across document edits?

**Answer:** The driver returns each `driveItem` id plus `eTag`/`cTag` and exposes
`/versions` (driveItemVersion); the ingest follow-on persists item-id + version +
fetch timestamp so Evidence spans anchor to a specific version.

**Rationale:** Edits change content; anchoring to a version id keeps citations
sound. Surfacing these fields is a driver capability; persistence is an ingest
concern.

## 2026-06-18 — matter ↔ M365 mapping

**Question:** How does an M365 location map to a beep matter wall?

**Answer:** A per-matter configured **source locator** (SharePoint site/library/
folder or a drive path) maps to a matter; the driver exposes `listItem.fields`
custom columns (matter/client/app-number) for enrichment. Mapping logic lands in
the `m365-document-ingest` follow-on.

**Rationale:** Keeps the driver technical-only; the product mapping is a slice
concern. Custom-column metadata rides `listItem.fields` (driveItem's superclass).

## 2026-06-18 — slice ownership

**Question:** Where does the M365 product verb-port live?

**Answer:** The driver stays flat/technical-only at `packages/drivers/m365`
(+ `packages/drivers/m365-mcp`). The product ingest **port** is deferred to the
`m365-document-ingest` follow-on (decide `law-practice` new tiers vs
`agents-use-cases` then).

**Rationale:** Per `standards/ARCHITECTURE.md` driver boundaries, drivers never
learn product language; `law-practice` currently has only a `domain` tier, so the
port/tier decision belongs with the ingest goal, not now.

## 2026-06-18 — MCP runtime shape

**Question:** How is the MCP server run, and how is the token cache protected?

**Answer:** In-process **stdio** MCP (`@beep/m365-mcp`, `McpServer.layerStdio`,
the `@beep/nlp-mcp` pattern); the MSAL token cache is encrypted via
`@azure/msal-node-extensions` (DPAPI/Keychain/libsecret) inside the sidecar.

**Rationale:** The MCP spec prefers stdio for local servers (avoids HTTP-transport
attack surface) and says stdio servers should take credentials from the
environment; encrypting the cache protects refresh tokens at rest.

## 2026-06-18 — Microsoft Search API

**Question:** Use Microsoft Search for retrieval in v1?

**Answer:** Defer. Not part of the v1 file/mail ingest verbs.

**Rationale:** `POST /search/query` is delegated-only, so a future headless
app-only librarian could not use it and would fall back to delta + drive
enumeration anyway; keep v1's surface small.

## 2026-06-18 — compliance commitments

**Question:** What compliance posture does the brief commit to?

**Answer:** Minimum data / minimum permissions (request only the read scopes
needed); honor deletions (the delta `deleted` facet removes items from any local
store); no broad copies beyond ingest need; local-first, delegated, attributable
access per ABA Formal Opinion 512.

**Rationale:** Satisfies the Microsoft APIs Terms of Use and the lawyer's
confidentiality / vendor-due-diligence duties; these become brief constraints and
no-gos.
