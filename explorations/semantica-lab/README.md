# Semantica Port Atlas & Lab

## Status

Stage: `decompose`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json). `BRIEF.md` v1.0 ratified 2026-08-24; the next
session drafts `MAP.md`.

## Spark

Benjamin deployed the Semantica KG framework (Python, 27 modules) locally, found it valuable and
buggy in equal measure, and built a Notion atlas to map it — toward a future apps/labs/semantica
Tauri lab that ports the best ideas schema-first, improves them with beep-effect capabilities,
and opens a neuro-symbolic reasoning work stream.

## Next Open Question

Tracker questions answered (DECISIONS T1–T3): after #794 merges, land the sweep as a docs PR
from `main` (with the benchmarks vocabulary skim and the HermiT/Pellet issue draft). Then draft
`MAP.md`: canary C0-C2 as Goal 1 with C0 on F1 + one W1 paper as the first vertical slice;
the `@beep/openai` driver as a pre-C1 slice; the storage-inversion and NET-NEW reasoning spikes as
post-C2 goals; two O4 OSS gates and the atlas-sync candidate queued; every row passes the
capability check. Then graduate and scaffold the lab. Background: decompose
(`MAP.md` — canary = Goal 1, two O4 gates, queued atlas-sync candidate), graduate, scaffold the
lab. Also awaiting him:
`research/glossary-rosetta-draft.md` (36 Rosetta cells), `research/drafts/repo-issues.md`, and
`research/drafts/upstream-contributions.md` — nothing posts without him.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`BRIEF.md`](./BRIEF.md) - v1.0 ratified pitch (stage 3): problem, stop rule, staged canary,
   service roster, rabbit holes, no-gos.
3. [`DECISIONS.md`](./DECISIONS.md) - open with the Current law table; the dated log below it
   is history. Terminology table lives there too.
4. [`research/criteria-rubric.md`](./research/criteria-rubric.md) - v2.0, ratified.
5. [`research/workload-contract.md`](./research/workload-contract.md) - v1.3 budgets, corpus, stop rule.
6. [`research/shared-schema.md`](./research/shared-schema.md) - v1.2 schema contract.
7. [`RESEARCH.md`](./RESEARCH.md) - grounding sweep and what landed (stage 1).
8. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - opportunity/friction ledger
   with dispositions.
9. [`CAPTURE.md`](./CAPTURE.md) - the raw stage-0 dump; read last, never tidy it.

The Notion atlas (`@beep/semantica`, workspace Todox) owns component/module *facts*; this packet
owns *decisions and research* (D2).

## Trail

- 2026-08-24 (tracker sweep, stage loop): mined the full semantica tracker (725 items) with
  seven Grok lanes + Grok synthesis + Codex skeptic (RATIFY-WITH-EDITS, applied). Both O4 gates
  STRENGTHENED; held danklocal fixes confirmed unreported; Benjamin answered the six questions
  (T1–T3). Benchmarks sidecar unfetchable (metric names only); HermiT/Pellet upstream issue
  drafted and spot-checked. Feeds MAP.
- 2026-08-24 (shape grill, S1–S5): Benjamin asked "what is the need for a timeline?" and for
  opinions on the four design items. Built a private teaching workspace
  (the private, untracked docs-internal teach workspace for semantica-lab: mission, lesson 1,
  reference sheet, 22 verified primary
  sources) and grilled in two rounds. Settled: probe-denominated circuit breaker instead of a
  calendar (S1); gold-proposer provider ≠ extractor provider as a schema refinement (S2);
  embeddings = `effect/unstable/ai` `EmbeddingModel` with OpenAI through a new `/embeddings`
  op + factory in `@beep/openai-compat` (S3; Anthropic has no embeddings API); tauri + frozen
  crate + hand-written `server/` runtime (S4); C2 runtime = ρdf closure + SKOS rule, G-entailment
  split rdfs/rules (S5). Contract → v1.3. Loop back to research: the `scratchpad/effect-ontology`
  deep read (open since RESEARCH.md) ran as S6 (3 mappers + 3 skeptics, 159 rows) and folded into
  shared-schema v1.2 + BRIEF v1.0. Mid-session corrections: `.repos/effect` re-linked to
  `Effect-TS/effect` main (effect-smol retired), which exposed the shipped `@effect/ai-openai`
  `OpenAiEmbeddingModel.layer` → S3-rev (new `@beep/openai` driver mirroring `@beep/anthropic`,
  no engine code). Benjamin ratified BRIEF v1.0 ("matches the picture"); stage → decompose;
  published as a docs-only PR.
- 2026-08-24 (shape, draft): entered shape. Drafted `BRIEF.md` v0.1 from the Current law
  table: two-week appetite (C0 in four days), staged canary diagram, a 13-row service-boundary
  roster with cited bricks (all verified live: `@beep/pglite`/`duckdb`/`rdf`/`provenance`/
  `langextract`/`nlp-processing`/`file-processing`, drivers oxigraph/shacl/n3/wink/tika), 13
  rabbit holes, no-gos. Live-source corrections while shaping: no `EmbeddingModel` Layer exists
  in-repo but the contract is Effect's own (`effect/unstable/ai`, rc.111) and `@beep/venice-ai`
  has `createEmbedding` — NET-NEW shrinks to one Layer; no EYE driver exists (oracle wiring is
  NET-NEW). Drafted the 36 Rosetta `tbd` cells (`research/glossary-rosetta-draft.md`). O5's
  clone-skill read discharged (generic task-selection stub, nothing load-bearing). Awaiting
  Benjamin's shape review; five challenge items listed in the brief.
- 2026-08-24 (quality loop + publish): three-lane adversarial review (integrity, clarity,
  hygiene; Sol + Grok mix) over the packet; round 1 found 8 blockers (Notion-id and home-path
  redaction, Current-law table, four-clocks sync, workload-contract rewrite, superseded-verdict
  banners, template residue, citation paths); round 2 verified fixes and found small residuals
  (Apache-2.0 correction for v3 logos, v1-rubric snapshot line stability, two invented Tier-L
  gates reverted to alarms); round 3 self-check clean. Published via yeet.
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
  hosted-live. Shared understanding confirmed; opportunities grill followed.
- 2026-08-24 (D17 reconciliation): both bake-off reviews landed (Sol REWORK ×5; Grok mixed) and
  CONVERGED: winners named before §0/§4 prerequisites existed; five composition seams (span
  canonicalization, dim 256/384/768, EYE-vs-ledger ownership, vector migration, bundle-level
  budgets); live-source falsifications (@beep/duckdb has no vector surface; corpus = 76 PDFs
  not 443). Reconciled to B1–B6: sheets = candidate screens, all families park-pending-canary,
  canary probe = M1 gateway; contract v1.1 + shared-schema v1.1 (CanonicalText, EvidenceBatch)
  corrected. Awaiting Benjamin's review of the reconciliation, then shape.
- 2026-08-24 (all five bake-offs landed — verdicts superseded by B1, see Current law): the
  sheets screened reasoning (EYE the only gate survivor; gate 8 killed nine of ten),
  extraction (found LangExtract relation-drop + WinkBackend span-fabrication in live source),
  input (per-stage slate; PDF.js/MuPDF tie), embeddings, and storage (ledger + projections
  shape; pgvector demoted to contingent runner-up). Docs miner landed 7 drift findings +
  78-URL inventory. D17 batch adversarial pass launched.
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
- 2026-08-24 (rubric adversarial pass): both adversarial reviews landed (Grok
  RATIFY-WITH-EDITS, Sol REWORK) —
  convergent on storage de-unification, quality-axis split, envelope double-count, license/
  maintenance gate rebuilds, NET-NEW spike discipline, shared-schema + workload contract as
  bake-off inputs. Reconciled → rubric v2 + amendments A1–A9 (ratified later the same day).
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
