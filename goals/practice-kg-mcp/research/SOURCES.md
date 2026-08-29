# Sources — Practice KG MCP

Provenance ledger. Dated; verify before reuse.

## In-repo grounding (2026-07-27 session survey; 5-agent workflow)

- `docs/ROADMAP.md` (freshness 2026-07-14) — north star, lanes, intake D6
  storage doctrine, BeepGraph demoted to proposal.
- `goals/legal-document-intake/{README,SPEC,PLAN}.md` — P0–P3 evidence, P4/P5
  definitions this packet cuts down (D-1).
- `goals/oppold-corpus-pipeline/history/outputs/` + corpus reports at the
  out-of-repo corpus home (`catalog/reports/{catalog,organize,enrich}-summary.json`)
  — base-run counts used by AC-1: 105 docket families, 643 docket files, 99
  USPTO anchors, 16,774 source files / 125.5 GB cataloged, 28 GB extracted.
- `packages/drivers/uspto-mcp/src/` — 5-file stdio host template (bin/Server/
  Tools/Handlers/SourceAuth); `packages/foundation/capability/mcp-kit` —
  TierGate/FieldTier/SanitizedSpan/ToolAnnotations substrate.
- `packages/epistemic/*` — bitemporal claim/edge authority, ClaimGate, tables.
- `packages/law-practice/*` — OfficeActionReview loop precedent (fixture-model
  spike; P3 swaps in a real LanguageModel layer).
- `apps/professional-desktop/scripts/build-sidecar.ts` — bun single-binary
  compile precedent.

## External verification (2026-07-27, claude-code-guide agent; URLs in report)

- MCP Bundles (.mcpb): `binary` server type CONFIRMED; `user_config` with
  `directory` picker CONFIRMED; Windows Claude Desktop one-click CONFIRMED;
  no documented bundle size cap. Spec: github.com/modelcontextprotocol/mcpb
  (MANIFEST.md); worked example: containers/kubernetes-mcp-server manifest.
- Unsigned Windows binaries: SmartScreen "unknown publisher" likely on
  consumer machines ("Run anyway" available); hardened WDAC environments may
  block — test on target; no explicit Anthropic signing requirement for .mcpb
  found (UNCERTAIN).
- Claude Desktop skills: manual ZIP upload / `%USERPROFILE%\.claude\skills\`
  copy only; NO one-click or first-party marketplace; no unified MCP+skills
  distribution mechanism (shapes Phase-2 starter-stack scope).

## User-supplied context (2026-07-27)

- Tom's machine: Windows x64; Claude Desktop with FOLIO MCP, Office extensions,
  SSD copy of the corpus, curated legal skills already installed (the grep
  baseline the acceptance gauntlet must beat).
- Skills goldmine repos under the user's `research/law_stuff/repos/` (mixed /
  partly absent licenses — Phase-2 license pass required before any
  redistribution).
