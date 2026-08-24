# Semantica Port Atlas & Lab

## Status

Stage: `research`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Benjamin deployed the Semantica KG framework (Python, 27 modules) locally, found it valuable and
buggy in equal measure, and built a Notion atlas to map it — toward an `apps/labs/semantica`
Tauri lab that ports the best ideas schema-first, improves them with beep-effect capabilities,
and opens a neuro-symbolic reasoning work stream.

## Next Open Question

Post-D17 state (B1–B6): all five bake-offs reconciled to **candidate screens**; formal family
verdicts are park-pending-canary. Next: Benjamin reviews the reconciliation, then the packet
moves to **shape** — the BRIEF's first milestone is the B2 canary (corpus manifest → F1
fixtures → minimal gold → the offline end-to-end run that freezes dimensions and ratifies or
falsifies each family slate).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - grounding sweep + pending research (stage 1).
4. [`DECISIONS.md`](./DECISIONS.md) - 18 decisions locked 2026-08-24 (pre-seeded from grilling).
5. [`research/criteria-rubric.md`](./research/criteria-rubric.md) - DRAFT bake-off rubric.
6. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - live opportunity/friction ledger.

The Notion atlas (`@beep/semantica`, workspace Todox) owns component/module *facts*; this packet
owns *decisions and research* (D2).

## Trail

- 2026-08-24 (opportunities grill, O1–O5): every OPPORTUNITIES entry dispositioned (absorbed /
  actioned / gated / recorded — see the ledger's Dispositions section). Launched draft-only
  jobs: repo-issue drafts (4 verified defects), upstream draft-and-hold (danklocal cherry-pick
  branch + 3 doc issues, nothing posted), operator run 3 (6 docs-drift Findings rows). Atlas
  backlog formally gated behind canary; OSS ambitions become two named MAP gates. Next: shape.
- 2026-08-24 (reconciliation grill, G1–G7): Fable independently verified the reviewers' live-
  source claims (all held), then /grilling settled: staged canary C0→C1→C2; graduate-fast with
  canary code in the lab; EYE = test-time oracle (architectural grounds; the 2GB budget crisis
  was retracted as an artifact of a hypothetical laptop reference — dev machine is a verified
  128GB/64GB-VRAM Threadripper); budgets re-anchored two-tier (contract v1.2); models
  hosted-first for M1 ("this is a lab after all"); offline rescoped to replay-offline/
  hosted-live. Awaiting Benjamin's final shared-understanding confirmation → shape.
- 2026-08-24 (D17 reconciliation): both bake-off reviews landed (Sol REWORK ×5; Grok mixed) and
  CONVERGED: winners named before §0/§4 prerequisites existed; five composition seams (span
  canonicalization, dim 256/384/768, EYE-vs-ledger ownership, vector migration, bundle-level
  budgets); live-source falsifications (@beep/duckdb has no vector surface; corpus = 76 PDFs
  not 443). Reconciled to B1–B6: sheets = candidate screens, all families park-pending-canary,
  canary probe = M1 gateway; contract v1.1 + shared-schema v1.1 (CanonicalText, EvidenceBatch)
  corrected. Awaiting Benjamin's review of the reconciliation, then shape.
- 2026-08-24 (all five bake-offs landed): reasoning = conditional pick-one EYE WASM (only
  gate-survivor; gate 8 killed nine of ten); extraction = already-have bricks + hybrid
  EvidenceBatch method contract (found LangExtract relation-drop + WinkBackend span-fabrication
  in live source); input = per-stage stack verdict (Unified/Remark+Rehype; PDF.js↔MuPDF tie
  pending shared probe; langextract offset-kernel → normalize service); embeddings =
  snowflake-arctic-m-v1.5 int8 ONNX + native ORT in sidecar (typed DegradedEmbedding law);
  storage = BUNDLE (PGlite append-only ledger SoR + @beep/duckdb exact vector M1 + derived
  PGlite graph tables + @beep/oxigraph SPARQL projection; pgvector demoted to contingent
  runner-up). Docs miner landed 7 drift findings + 78-URL inventory. D17 batch adversarial
  pass (Sol + Grok over all five sheets + composition round) launched.
- 2026-08-24 (bake-offs launched): atlas operator run 1 SUCCEEDED via `--approve-for-me` (34
  data sources upgraded, 215 rows Kind-filled, 27 maturity grades, sqlite-vec+Anzo added, 13
  auto-parks, Findings DB seeded with 12 — `research/atlas-upgrade-report.md`). Benjamin routed
  the deep-research fan-out to Codex. Launched: five rubric-governed Sol xhigh bake-offs
  (storage, embeddings, input, reasoning-baseline, extraction → `research/bakeoff-*.md`) +
  operator run 2 (Glossary—Rosetta DB import + Docs URL application + license notes). Next on
  landing: D17 adversarial pass per bake-off, then verdicts into DECISIONS + atlas columns.
- 2026-08-24 (adhd): D15 pass complete — 5 isolated divergence branches (30 ideas), scored/
  clustered into 6 angles, 3 syntheses deepened. Outcome in `research/adhd-reasoning.md`:
  proof-ledger kernel + budget-certified membrane + evidence-graph workspace compose into ONE
  NET-NEW spike candidate with three kill-criteria probes; ★ design language = rules as
  proof-shape schemas. Reasoning family sheet FROZEN. All five bake-offs now clear to launch.
- 2026-08-24 (ratification): Benjamin ratified rubric v2.0 + A1–A9 (+ `PostgreSQL` SPDX in the
  permissive list). Drafted both bake-off inputs: `research/workload-contract.md` (W1 = 25
  academia papers, gold sets G-structure/entity/relation/entailment, budgets, offline criterion,
  two-week falsifier) and `research/shared-schema.md` (10 families, 3 cross-family laws).
  Docs census landed earlier with the TS-Datalog-gap finding. Awaiting: Benjamin's review of
  the two drafts; Notion operator attempt 3 still running.
- 2026-08-24 (latest): both adversarial reviews landed (Grok RATIFY-WITH-EDITS, Sol REWORK) —
  convergent on storage de-unification, quality-axis split, envelope double-count, license/
  maintenance gate rebuilds, NET-NEW spike discipline, shared-schema + workload contract as
  bake-off inputs. Reconciled → rubric v2 + PROPOSED amendments A1–A9 awaiting ratification.
  Notion operator relaunched twice (write-approval friction: `--approve-for-me`, exclusive
  with `-s`). Glossary miner done; IR builder + docs census still running.
- 2026-08-24 (later): v3 logos grounding landed — `rete` SALVAGE (working Rete + 46-test
  oracle), `rules`/`logos` PATTERN. Parallel wave launched: Notion atlas operator (columns,
  maturity fill, delta rows, Findings DB), IR extraction pipeline builder
  (`scratchpad/semantica-ir/`), docs-URL/llms.txt census (Grok), glossary miner. Sol+Grok
  adversarial rubric reviews still in flight.

- 2026-08-24: packet opened at `research`. Three Sol-xhigh grounding files imported
  (semantica repo, labs doctrine, Notion atlas forensics); grill-with-docs session locked D1–D18
  (envelope, bake-off roster, charter split vs trustgraph-workbench, Tauri headless-first,
  eval corpus, phase-2 design laws); criteria rubric drafted; v3 `beep-effect-logos`
  rules/rete/logos exploration agent launched. Stopped at: rubric adversarial pass + ratification.
