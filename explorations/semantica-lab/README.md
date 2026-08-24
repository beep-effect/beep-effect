# Semantica Port Atlas & Lab

## Status

Stage: `research`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json). Research is complete; the next session
enters shape by drafting `BRIEF.md`.

## Spark

Benjamin deployed the Semantica KG framework (Python, 27 modules) locally, found it valuable and
buggy in equal measure, and built a Notion atlas to map it — toward an `apps/labs/semantica`
Tauri lab that ports the best ideas schema-first, improves them with beep-effect capabilities,
and opens a neuro-symbolic reasoning work stream.

## Next Open Question

Draft `BRIEF.md` (enter shape). Milestone 1 is the staged canary C0 → C1 → C2 (G1). Family
sheets are candidate slates, not winners (B1). M1 models are hosted (G6). Offline means replay
from a content-addressed cache (G7). Benjamin reviews `research/drafts/repo-issues.md` and
`research/drafts/upstream-contributions.md` before anything is posted.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`DECISIONS.md`](./DECISIONS.md) - open with the Current law table; the dated log below it
   is history. Terminology table lives there too.
3. [`research/criteria-rubric.md`](./research/criteria-rubric.md) - v2.0, ratified.
4. [`research/workload-contract.md`](./research/workload-contract.md) - v1.2 budgets and corpus.
5. [`research/shared-schema.md`](./research/shared-schema.md) - v1.1 schema contract.
6. [`RESEARCH.md`](./RESEARCH.md) - grounding sweep and what landed (stage 1).
7. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - opportunity/friction ledger
   with dispositions.
8. [`CAPTURE.md`](./CAPTURE.md) - the raw stage-0 dump; read last, never tidy it.

The Notion atlas (`@beep/semantica`, workspace Todox) owns component/module *facts*; this packet
owns *decisions and research* (D2).

## Trail

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
