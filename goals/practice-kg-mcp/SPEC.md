# Practice KG MCP — SPEC

Status: `active` · Created: 2026-07-27 · Anchor: this file is normative; PLAN.md
sequences it; GOAL.md launches it.

## Mission

Ship the first queryable IP-law knowledge graph over the Oppold practice corpus
to the first user's (Tom's) Claude Desktop within one week, as a read-only,
local-first stdio MCP server plus a portable data bundle — and in doing so take
live ownership of the knowledge-graph scope orphaned when
`goals/ip-law-knowledge-graph` was deleted (2026-07-14, PR #401).

## Strategic frame (binding for scope calls)

The MCP surface is not an interim shim around `apps/professional-desktop`; it is
the product thesis executed — the integration layer that multiplies Claude
Desktop (client #1; Word, Outlook, cron jobs, and codex-style background
processes are the same consumer). When a scope tradeoff arises, prefer the
choice that makes the MCP surface durable over the one that makes a demo
prettier.

**Acceptance test:** a question Tom actually asks, answered verifiably better
than grep over his SSD corpus copy (his current interim setup). Cross-document
joins, provenance, and side-by-side document pulls are the wedge; "tables
populated" is not success.

## Decisions (locked 2026-07-27)

| # | Decision |
| --- | --- |
| D-1 | **P4-lite + MCP.** Reuse the proven extraction path (file-processing + langextract → candidate claims with span provenance into epistemic/KG rows). The full librarian/critic/SHACL ClaimGate loop stays in `legal-document-intake` P4-proper and is NOT in scope here. |
| D-2 | **Week-1 data families:** (a) deterministic docket-family spine — clients → docket families → applications → documents from the corpus catalog/organize/enrich outputs, no LLM anywhere in this layer; (b) OA span-grounded candidate claims over the curated demo subset (`staging/oppold-demo-inputs`) with a real LanguageModel layer; (c) email correspondence edges from PST message JSONL (archive-level matter linkage; confidence stated in tool output); (d) corpus full-text search over the extracted text with click-through to source. |
| D-3 | **Topology:** local stdio server on Tom's Windows x64 machine; `bun build --compile --target=bun-windows-x64`; data ships as a file bundle (PGlite dir + DuckDB file + pointers into his existing SSD corpus copy). |
| D-4 | **Read-only, labeled.** Every tool is read-only. Candidate claims are labeled `candidate — unreviewed` with their evidence span; spine rows are labeled derived-from-official-records. No write tools: no collision with the in-flight `agent-execution-authority` write wall, no approval-semantics debt. Approval surfaces later (portal P4 or a gated write tool once execution-authority lands). |
| D-5 | **Governance:** this packet + the ROADMAP amendment land in the same PR; this packet is Lane 1's live front for the week; `legal-document-intake` P4-proper resumes after handoff. |
| D-6 | **Storage** per intake SPEC D6: KG/epistemic rows in PGlite (schema-first node/edge projection tables); catalog + FTS stay DuckDB (`@beep/duckdb`). Both embedded, both ship as files. Corpus content and PII never enter the repo. |
| D-7 | **Product split (Phase 2):** immediately post-handoff, a separate packet ships the generic IP-practice starter stack to firms (uspto-mcp + FOLIO MCP + curated skills + one-click setup; no per-firm data work). Per-firm KG onboarding (productized salvage→enrich engagement) is a later packet gated on Tom's dogfood evidence. |
| D-8 | **Packaging: .mcpb-first.** Ship as an MCP Bundle: `binary` server type (verified supported), data-folder path via manifest `user_config` directory prompt (verified supported). Skills have NO one-click path (manual ZIP upload only — verified); the .mcpb carries only the server. Fallback if the packaging spike fails: bun.exe + app folder + documented `claude_desktop_config.json` stanza. Unsigned-binary SmartScreen behavior is tested on the target machine; signing is a Phase-2 concern. |

## Scope

In: the KG build lane (`beep corpus graph` command over the existing Corpus
command family); schema-first spine/edge models; the new read-only MCP host
package (~9 tools, mcp-kit-composed: `kg_clients`, `kg_docket_family`,
`kg_application_lookup`, `kg_find`, `corpus_search_text`, `corpus_get_document`,
`email_search`, `kg_candidate_claims`, `kg_provenance`); the OA candidate-claim
batch run (workstation-side); .mcpb packaging + install/refresh runbook (the
runbook doubles as a machine-readable install manifest seeding Phase 2);
ROADMAP amendment.

Out: write/approval tools; librarian/critic/SHACL loop (intake P4-proper);
pgvector/embeddings and fused retrieval (intake P5 +
`hybrid-retrieval-fusion-core`); per-docket email linkage; the refresh batch's
un-extracted files (base corpus run only); skills curation and firm
distribution (Phase-2 packet); any professional-desktop UI work; graph DB
engines (D6 stands — benchmarks reopen it, not preference).

## Non-negotiables (inherited)

- Candidate-only writes into the epistemic store; evidence by stable span;
  provenance on every row (catalog digest / USPTO anchor / extraction Activity).
- Local-first: zero network egress from the shipped server (uspto-mcp ships
  alongside as a separate, public-data-only, opt-in-key config entry).
- Schema-first, effect-first, typed errors; new-package first-CI gates cleared
  by a full local `bun run beep lint policy`.
- Corpus/PII stays outside the repo; gitleaks stays clean.

## Acceptance criteria

- AC-1 `beep corpus graph` is deterministic: rerun yields identical counts;
  counts reconcile against catalog reports (105 docket families, 643 docket
  files, 99 USPTO anchors from the base run).
- AC-2 Every KG row resolves to provenance (catalog digest, USPTO anchor, or
  extraction Activity) via `kg_provenance`.
- AC-3 Every candidate claim returned by `kg_candidate_claims` carries a
  resolvable evidence span into real source text and the `candidate —
  unreviewed` label.
- AC-4 The compiled server passes the 5-question acceptance gauntlet in Claude
  Desktop on the workstation, strictly better than the grep baseline (joins,
  provenance, side-by-side pulls), before install on Tom's machine.
- AC-5 Zero network calls from the practice-kg-mcp process under observation
  during the gauntlet.
- AC-6 Install on Tom's machine completes from the runbook alone (one .mcpb
  install + one bundle copy), and his first real questions are captured as the
  post-week backlog.

## Exception ledger

(Empty. Record dated exceptions here; clearing conditions required.)
