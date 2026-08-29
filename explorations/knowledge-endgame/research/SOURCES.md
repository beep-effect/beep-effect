# Sources — provenance ledger

Stage 0 packet: this ledger records where the capture's material came from.
No RESEARCH.md exists yet; the primary research corpus is machine-local
(untracked) because this repo is public.

## Primary corpus (machine-local, untracked)

- `docs/_internal/knowledge-endgame/` — ten Grok lane reports
  (`reports/01..10-*.md`, ~430KB), raw lane transcripts (`raw/`), lane
  prompts (`prompts/`), and `SYNTHESIS.md` (four-part synthesis; mirrored
  into `CAPTURE.md` here with redactions). Produced 2026-08-25.
- `~/.config/JetBrains/WebStorm2026.2/scratches/KNOWLEDGE_ENDGAME.md` — the
  operator's original vision note (content mirrored, redacted, in
  `CAPTURE.md`).

## In-repo packets and standards this capture composes

- `explorations/packet-system-redesign` (+ its
  `research/2026-08-25-agento-ontology-mapping.md` and
  `research/2026-08-25-ontology-tooling-recon.md`; MAP queued Amendments
  H/I/J) — the join-layer critical path.
- `explorations/protocol-as-value` — orchestration-as-value (Part III).
- `explorations/project-intelligence`, `goals/nightly-research-routine` —
  the intelligence loop lane.
- `explorations/document-structure-ontologies`,
  `explorations/deterministic-doc-structure-extraction` — the ingestion
  border (Part II hard part 2).
- `goals/repo-codegraph-jsdoc`, `packages/tooling/library/repo-utils/src/JSDoc`
  — the code T-Box lane.
- `goals/ontology-workbench`, `explorations/semantica-lab`,
  `packages/foundation/modeling/ontology` — workbench/taxonomy lanes.
- `goals/folio-lynx-taxonomy-browse`, `apps/practice-kg-mcp` — the FOLIO
  triple pattern.
- `@beep/qa-capture`, Yeet command tree, `@beep/rdf` (`Prov.ts`,
  `Evidence.ts`), AI-metrics stack — the evidence/agent-metrics lane.
- `standards/memory-architecture` — the ratified demotion the synthesis
  confronts (Part I "why you can't verbalize it", reason 3).
- `explorations/computable-workspace-geometry` — the tool for Part IV's
  four-ring substrate/instance partition.
- `goals/agentic-professional-runtime` — the existing product-definition
  authority Parts II–IV extend.

## External references

Fetched/verified during the lane runs (URLs appear in the machine-local lane
reports' source ledgers):

- FOLIO taxonomy browser — https://folio.openlegalstandard.org/taxonomy/browse
- FOLIO MCP — https://openlegalstandard.org/resources/folio-mcp/
- FOLIO repo — https://github.com/alea-institute/FOLIO (license per upstream;
  slice/pin doctrine in `goals/folio-lynx-taxonomy-browse`)
- xAI docs MCP — https://docs.x.ai/developers/docs-mcp
- Effect website API page — https://www.effect.website/docs/v4/api

Local clones referenced (reference/pattern study, not vendoring):

- `~/YeeBois/dev/folio-mapper` — FOLIO grounding app clone.
- `~/YeeBois/dev/LemmaScript` — proof-fiber system (lane 06).
- `~/YeeBois/dev/effect-website` — API page generation pipeline (lane 05).
- `~/YeeBois/dev/mykg` — MIT; Markdown→KG pipeline; dispositions recorded in
  `explorations/packet-system-redesign/research/2026-08-25-ontology-tooling-recon.md`.

Named in conversation, not fetched (reference only — no URLs recorded to
avoid fabrication):

- Theo (t3) video tearing down agent-memory products (mem0/supermemory-class),
  pro repo-as-truth — operator-referenced.
- Palantir Foundry Ontology / Workshop / AIP and the FDE model — discussed
  from general knowledge in Part III; landscape grounding lives in the
  machine-local lane 10 report.
- Fossil, git-bug, git-appraise, Radicle — forge-state-in-repo prior art
  named in Part IV.
