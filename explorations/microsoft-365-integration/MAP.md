# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `m365-driver` | `@beep/m365` native Microsoft Graph driver: MSAL auth-code+PKCE token provider + `FetchHttpClient`/`effect/Schema` Graph `v1.0` client; read verbs for OneDrive/SharePoint (list drives/sites, delta, download content, `listItem.fields` + `/versions`) and Outlook mail/calendar; write-ready `Context.Service` shape, read-only scopes. | none | `@beep/hubspot` (raw HTTP + Schema + bearer), `@beep/box` (config/service/errors + `S.Redacted`), `effect/http`, `@beep/schema`, `@beep/identity`; NET-NEW deps `@azure/msal-node`, `@microsoft/microsoft-graph-types`, `@azure/msal-node-extensions` |
| `m365-mcp` | `@beep/m365-mcp` MCP server: expose `@beep/m365` read verbs as MCP tools via `effect/ai` (`Tool.make` + `Tool.HandlersFor` + `McpServer.toolkit` + `makeServerLayer` over `McpServer.layerStdio`, `bin` entry, `failureMode: "return"`). | `m365-driver` | `@beep/nlp-mcp` (Server/bin/toolkit pattern), `effect/ai`, `@effect/platform-node`; NET-NEW `@beep/m365` |
| `m365-document-ingest` *(follow-on — named, not graduated)* | Wire M365 files into the runtime data loop: per-matter source-locator mapping, delta-sync state, content download → `@beep/tika`/`@beep/langextract` → `@beep/epistemic-domain` candidate claims, surfaced via a new ingest RPC + file-drop UI. | `m365-driver`, document-portal MVP | `@beep/tika`, `@beep/langextract`, `@beep/file-processing` (`ArtifactLocator`), `@beep/epistemic-domain` / `@beep/epistemic-tables`, `@beep/law-practice-domain`; NET-NEW ingest RPC + UI + `ArtifactLocator`/`Evidence`/`Matter` schema extensions + slice tiers |

## Sequencing

`m365-driver` is the first bet — everything depends on it. `m365-mcp` follows
immediately (depends only on the driver) and ships alongside it; both are
self-contained, technical-only driver packages verifiable in isolation.
`m365-document-ingest` is a deliberate follow-on: it is gated on the
document-portal MVP (PRD P1) and on the slice-ownership + schema-extension
decisions (D9/D10), so it is named here but not graduated now.

**Known downstream consumer.** The sibling exploration
[`solo-firm-docketing`](../solo-firm-docketing/README.md) depends on `@beep/m365`
for Outlook calendar push and will need the **reserved** `Calendars.ReadWrite`
write scope (D6, phase 2) — which is exactly why the driver's service/scope shape
is built write-ready in v1.

## First Vertical Slice

For `m365-driver`: authenticate (delegated auth-code + PKCE), list a SharePoint
document library, download one file's content, and read one Outlook message —
verified by `effect/Schema`-decoder unit tests over recorded fixtures plus a
credential-gated live smoke test. This proves the auth + HTTP + decode + error +
span plumbing end to end on the smallest real surface.

## Open Risks Inherited From The Brief

- Layered throttling — honor `Retry-After`; budget SharePoint resource units.
- Encrypted / labeled files — detect + flag + skip (no `Content.SuperUser`).
- Desktop token-cache encryption; secrets stay in the sidecar.
- No structured Word API — text via `@beep/tika` after byte download.
- Delta-token lifecycle and `410 Gone` resync.
- Graph surface drift — pin `v1.0`; track the changelog.
