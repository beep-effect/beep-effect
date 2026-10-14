# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

beep's agents (librarian, researchers, patent drafters) need to reach the
practice's real documents and correspondence — which, for Tom's OIP practice as
for most lawyers, live in Microsoft 365 (OneDrive/SharePoint, Outlook,
Word/Excel). Today there is no connector: the runtime data loop ingests local
fixtures only, and the product authority's standing open question is *"which
existing tools will the practice use for document storage?"* The answer is M365 —
and a privileged-data practice cannot route that content through an opaque
third-party process. We need an owned, observable, least-privilege way in.

## Appetite

A thin, owned slice: a native `@beep/m365` Graph driver plus an MCP exposure —
**read-only first, write-ready by design**. Explicitly NOT a full Graph SDK, NOT
the document-portal MVP, and NOT a write/automation surface. Budget is two small
driver packages that mirror existing precedents (`@beep/hubspot`, `@beep/box`,
`@beep/nlp-mcp`); anything larger graduates as a separate follow-on.

## Solution Sketch

```
Entra app (delegated, auth-code + PKCE)
      │  @azure/msal-node  (token provider, encrypted cache)
      ▼
@beep/m365  ──  FetchHttpClient + effect/Schema  ──►  Microsoft Graph v1.0
   read verbs:
     Files/Sites : list drives/sites · delta · download content ·
                   listItem.fields + /versions
     Mail/Cal    : list/get messages · list/get events
      │  Context.Service + Layer · M365Error typed errors · S.Redacted secrets ·
      │  OTel spans (counts/sizes, never raw content)
      ▼
@beep/m365-mcp  ──  effect/ai (Tool.make · McpServer.layerStdio)  ──►
      agents in apps/professional-desktop

(future) m365-document-ingest:  content → @beep/tika / @beep/langextract →
      @beep/epistemic-domain candidate claims, matter-walled.
```

The driver's service shape, auth, error, and scope model are write-ready, so the
later "true assistant" phase adds write verbs/scopes (or delegates write-back to
Microsoft's Work IQ MCP servers, now an option since Copilot is present) without a
rewrite.

## Rabbit Holes

- Layered, per-service throttling — honor `Retry-After`; budget SharePoint
  resource units (a solo tenant sits in the lowest tier).
- Encrypted / sensitivity-labeled files — detect + flag + skip in v1; never
  `Content.SuperUser`.
- Desktop token-cache encryption (`@azure/msal-node-extensions`); keep secrets in
  the sidecar, never the renderer.
- No structured Word API — `.docx` text comes from `@beep/tika` after byte
  download (an ingest concern, but it shapes the driver's content verb).
- Delta-token lifecycle and `410 Gone` resync.
- Graph surface drift — pin `v1.0`; track the changelog (24-month deprecation).

## No-Gos

- No write scopes or write verbs in v1 (read-only; write-ready shape only).
- No off-the-shelf MCP sidecar as the durable core (owned driver instead).
- No Work IQ / Copilot dependency for ingest (local-first).
- No document-portal ingest wiring in these two goals (that is the follow-on).
- No Teams or Excel-workbook-content verbs in v1.
- No Microsoft Search API in v1.
