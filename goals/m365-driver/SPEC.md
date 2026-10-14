# M365 Driver Spec

## Objective

Deliver `@beep/m365` (at `packages/drivers/m365`): a native Microsoft Graph
`v1.0` driver that authenticates with delegated OAuth2 authorization-code + PKCE
via `@azure/msal-node`, and exposes typed, read-only verbs decoded with
`effect/Schema`:

- OneDrive/SharePoint: resolve sites, list drives/document libraries, enumerate
  via delta, download `driveItem` content, and read `listItem.fields` + item
  `/versions`.
- Outlook: list/get mail messages and list/get calendar events.

The driver is a `Context.Service` with a Layer factory, `M365Error` tagged
errors, `S.Redacted` secrets, and OTel spans that record counts/sizes but never
raw content. Its shape is write-ready (verbs/scopes are extensible) but v1 only
requests read scopes.

## Non-Goals

- No write verbs or write scopes (read-only; write-ready shape only).
- No MCP exposure (that is `goals/m365-mcp`).
- No Teams or Excel-workbook-content verbs.
- No Microsoft Search API.
- No document-portal ingest wiring, matter mapping, or persistence (that is the
  `m365-document-ingest` follow-on).
- No off-the-shelf MCP sidecar; no Work IQ / Copilot dependency.

## Source Hierarchy

1. User objective: implement the graduated `microsoft-365-integration` plan
   (driver goal).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `explorations/microsoft-365-integration/{DECISIONS.md,BRIEF.md,MAP.md,RESEARCH.md}`.
4. Governing architecture/package standards (`standards/ARCHITECTURE.md` driver
   boundaries) and schema-first doctrine.
5. This `SPEC.md`.
6. `PLAN.md`.
7. `GOAL.md`.
8. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/drivers/m365/**` (new package `@beep/m365`).
- Root `package.json` `catalog` (register `@azure/msal-node`,
  `@microsoft/microsoft-graph-types`, `@azure/msal-node-extensions`).
- `@beep/identity` namespace registry (new `M365` composer key, per convention).

## Constraints

- Raw HTTP via `effect/http` `FetchHttpClient` + `HttpClientRequest`
  bearer token; decode every response with `effect/Schema`. Do NOT adopt the
  fluent Graph client or the Kiota SDK runtime; pull TYPES only from
  `@microsoft/microsoft-graph-types`.
- Delegated scopes requested in v1: `offline_access User.Read Files.Read.All
  Sites.Read.All Mail.Read Calendars.Read`. Reserve write scopes; do not request
  them.
- Secrets via `S.Redacted`; extract only at the call boundary. Persist the MSAL
  token cache encrypted (`@azure/msal-node-extensions`); never log tokens or raw
  content.
- Honor `Retry-After` on 429/503; pin Graph `v1.0` (never `beta` in product code).
- Encrypted / sensitivity-labeled items: detect + flag + skip content; never
  `Content.SuperUser`.
- Driver stays technical-only — no product/law vocabulary (architecture driver
  boundary).
- Tests under `test/` import via `@beep/m365` aliases (not relative `src/` paths).

## Acceptance Criteria

- [ ] `@beep/m365` exists at `packages/drivers/m365` with the config/service/
      errors split, builds, and lints/type-checks green.
- [ ] Delegated auth-code+PKCE token acquisition + silent refresh works via
      `@azure/msal-node` with an encrypted token cache.
- [ ] Read verbs implemented and Schema-decoded: list drives/sites, delta,
      download `driveItem` content, read `listItem.fields` + `/versions`, list/get
      mail messages, list/get calendar events.
- [ ] Unit tests decode recorded Graph fixtures; a credential-gated live smoke
      test lists a library, downloads a file, and reads a message.
- [ ] Only read scopes are requested; the service shape is documented as
      write-ready (verb/scope-extensible).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Package types/lint | repo `check`/`lint` filtered to `@beep/m365` | Passes |
| Unit decoders | repo `test` filtered to `@beep/m365` (fixtures) | Passes |
| Live smoke (gated) | opt-in test: list library + download file + read message | Passes when creds present; skipped otherwise |
| Packet launcher size | `test "$(wc -m < goals/m365-driver/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/m365-driver/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/m365-driver` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (e.g. write verbs, MCP, ingest).
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec (the live smoke test is opt-in and skipped
  without credentials).
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
