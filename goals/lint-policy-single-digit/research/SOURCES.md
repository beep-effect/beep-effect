# Lint Policy Single Digit — Sources & Provenance

- **Source exploration:** none — authored directly from a 2026-08-13 profiling +
  grill-with-docs session (no `explorations/` packet). The evidence corpus was produced
  in-session by a five-lane Codex (GPT-5.6 Sol, effort medium) fan-out and copied here
  verbatim as `00`–`05`.
- **Provenance:** hosted CI logs (run `31683014887`, job `94392586624`, PR #673) for the
  baseline timing table; live-checkout `file:line` citations inside each report.

## 1. In-packet evidence corpus

| Source | What it is | Disposition |
|--------|------------|-------------|
| `research/00-evidence-brief.md` | Shared measured baseline: per-step timing table, lane mechanics, runner hardware, report contract given to all five lanes | binding baseline |
| `research/01-engine-swap.md` | oxlint-tsgolint feasibility, killed alternatives (flat-tsconfig projectService, tsgo scanner, Biome, ts-morph scanner), cutover sketch + parity-corpus inventory | P2/P3 contract |
| `research/02-inplace-optimization.md` | Shard parallelism + per-shard caches + cache-correctness analysis (why CI-persisted ESLint cache is unsound for no-deprecated) | P1 contract (§3) |
| `research/03-lane-orchestration.md` | LPT schedule model (c=2/4/6/8), resource classes, docgen redundancy analysis, CLI boot overhead | P1 ordering (§3.1) + backlog rationale |
| `research/04-pr-scoping-deferred.md` | Full 25-step scoping trigger table + escalation predicate design — DEFERRED except the §3 empty-set fix | deferred design (P1 takes §3 only) |
| `research/05-long-tail.md` | Post-deprecated long-pole analysis (docgen 197s, semantic-delta 78s, schema-first 51s, circular/madge) | backlog levers |

**How these inform implementation:** P1 executes `02` §3 + `03` §3.1 + `04` §3; P2/P3
execute `01` §3 behind its §1 gates; everything else is recorded backlog, with killed
ideas listed in `ops/manifest.json` so they are not re-explored.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| oxc-project/oxc (oxlint 1.78.0, installed) | MIT | dependency use | `typescript/no-deprecated` type-aware rule via `--type-aware` |
| oxc-project/tsgolint (`oxlint-tsgolint` peer, not yet installed) | MIT | dependency use (P3 cutover PR only) | typed-rule backend on TS-go |
| typescript-eslint (installed) | MIT | dependency use (current engine) | `@typescript-eslint/no-deprecated` reference semantics for the parity corpus |

External documentation cited inside `01`: oxc.rs type-aware linting guide and rule page;
typescript-eslint typed-linting FAQ (projectService `tsconfig.json` discovery rule).

## 3. Prior repo evidence

- `goals/one-round-loop/history/p0-parity-evidence.md` — local/hosted lane parity proof;
  binding invariant for every change here.
- `goals/ci-fleet-endgame/research/ci-graph-check-baseline.md` — flat source-mode
  tsconfig measurements (PR #668) referenced and ruled out for projectService in `01`.
- Commit `4cd02e6962` — deprecated-apis shard split for memory bounding (why one big
  ESLint invocation is a killed idea).
