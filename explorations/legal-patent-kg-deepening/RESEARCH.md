# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## Campaign Operating Plan (2026-08-01)

The locked design from [`DECISIONS.md`](./DECISIONS.md), in execution order.
A cold session resumes from the first incomplete step.

1. **Catalog + dedupe** — inventory every corpus file, content-hash dedupe
   the duplicate PDFs, exclude noise (`pimpbunny.com_cookies.txt`,
   screenshots), classify each unique source into the four track themes.
   Output: `research/00-catalog.md` + machine rows (gold-intake nugget
   schema).
2. **Mining waves (codex)** — `codex exec` (Sol, `--effort medium`) per-source
   distillates for every unique paper into `research/mined/`; `links.md`
   URLs fetched (firecrawl lane) and distilled the same way; FOPNet thread
   first. Repos: one medium triage pass, then xhigh deep-mines on survivors.
3. **Deep-research tracks (sequential, one at a time)** — Workflow harness
   per track over the distillates, adversarial verify + synthesis:
   1. Legal core ontology + Hohfeldian formalization → `research/10-track-legal-core.md`
   2. Patent KGs + functional patent knowledge (FOPNet) → `research/11-track-patent-kg.md`
   3. Legal GraphRAG + temporal norm reasoning → `research/12-track-graphrag.md`
   4. Patent LLM authoring + multi-agent IP workflows → `research/13-track-patent-llm.md`
4. **/adhd on integration plays** — post-synthesis divergence ("what should
   beep-effect build/absorb?"), diverge/deepen as codex background jobs,
   critic inline. Output: `research/20-adhd-integration-plays.md`.
5. **Catalog + ROUTING-SEED + HANDOFF** — nugget catalog rows, routing seed
   mapping findings → goals/packets, handoff doc. Campaign stops here;
   BRIEF/MAP shaping is gated on Benjamin's sign-off.

## External Landscape

<Fills during mining waves. Every claim gets a link; license/maintenance/fit
concerns inline. Wave-1 external landscape lives in
[`legal-ontology-landscape/RESEARCH.md`](../legal-ontology-landscape/RESEARCH.md)
and is presumed standing.>

## In-Repo Capability Inventory

Standing bricks wave 2 composes against (verify at mining time):

- `goals/semantic-foundation` — SKOS concept schemes under
  `https://ns.beep.sh/`, FOLIO alignment policy, `@beep/ontology`
  registry/loader; no graph store, no SPARQL engine (locked wave-1 outcome).
- `foundation/capability/langextract` — source-grounded char-span extraction
  (absorbed from effect-langextract).
- Epistemic slice goals — `epistemic-bitemporal-edge-core`,
  `epistemic-claim-lifecycle-gate`, `epistemic-contradiction-triage`;
  EvidenceSpan-as-jsonb decision.
- `goals/agentic-cad-patent-tooling`, `explorations/uspto-patent-driver-depth`,
  `goals/trustgraph-doc-ontology`, `explorations/ontology-agent-surface`.
- `_gold-intake` v1 artifact contracts — nugget catalog schema, routing seed,
  handoff shape (reused verbatim by this campaign).

## Constraints Discovered

- Deep-research harness tracks must run sequentially — 3+ parallel runs trip
  server-side rate limiting that silently degrades verify/synthesis
  (2026-06-18 incident memory).
- All bulk reading routes to codex (`--effort medium` unless escalated);
  Anthropic agents only verify/synthesize (standing quota doctrine).
- Fetched third-party ontology files stay gitignored under `assets/vendor/`
  (public repo); the committed record is manifest + fetch script (wave-1
  precedent).
- Wave-1 conclusions and semantic-foundation locked decisions are standing
  inputs — wave-2 findings that contradict them get surfaced as explicit
  challenges in the track syntheses, not silently re-decided.
