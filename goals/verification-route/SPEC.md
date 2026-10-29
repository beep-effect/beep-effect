# Verification Route Spec

## Objective

Run only the checks a change's kind can affect, cheapest first, and prove it by
replay rather than by waiting. Observable end state: a total footprint record
keyed by `CiLaneId`, `classify` and `route` in repo-cli, `beep ci route
plan|census|replay` over a digest-pinned corpus of hosted heads, the loss census
printed by atom kind, at least one footprint refinement enforced in
`yeet final-check` with its mutation fixture and 100% replay recall, the
file-grain half of that refinement compiled into turbo task inputs and
generated root `package.json` field projections, and hosted lanes completing
`skip-satisfied` with a route receipt where the route excludes them. Source:
[`explorations/verification-route`](../../explorations/verification-route/README.md)
(BRIEF.md, MAP.md, DECISIONS.md: 16 rulings, 2026-10-27/28).

## Non-Goals

- A measurement window or sample-size gate of any kind; the replay is the gate
  and the live shadow is a monitor (ruling: enforcement gate).
- An ontology, T-Box, auditor run or OWL artifact; the footprint record is code
  with fixtures.
- Reordering lanes: `WaveOrder` and `gate-order-lexicographic/v1` stand
  (time-to-certainty rulings 76–79).
- Re-keying `ProofFact` or editing `ProofEpoch` (DEFERRED; gated MAP candidate
  `proof-key-footprint`).
- Per-PR ruleset edits or removing a required context from the hosted matrix.
- Scheduler, lock or admission changes.
- Symbol-grain propagation, per-law footprints, the pre-push tier as its own
  population, the merge queue (B9/E8), any lab.

## Source Hierarchy

1. The exploration's `DECISIONS.md` rulings and `BRIEF.md` (shape accepted 2026-10-28).
2. `AGENTS.md`, `CLAUDE.md`, and required skills (effect-first, schema-first, yeet).
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Ci/**`: new `ChangeAtom`,
  `ChangeAtomKind`, `CheckFootprint`, `Propagation`, the total
  `Record<CiLaneId, CheckFootprint>`, `classify`, `route`, the corpus fetch,
  and the `beep ci route` command surface; `HeavyAdmission` extended per lane
  (slice 3).
- `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck*.ts`: the
  route section of the receipt, the shadow sentinel row, enforcement per
  refinement.
- `turbo.json` and the 21 package-local `turbo.json` files (layer 1 inputs);
  a prepare-phase writer for the root `package.json` field projections and the
  tracked generated files it emits (location decided in P1 and recorded in the
  Decision Log).
- `.github/workflows/heavy.yml` and the hosted lane entrypoints (slice 3).
- Packet files under `goals/verification-route/` and the exploration's
  `research/OPPORTUNITIES.md` for friction receipts.

Untouched: `goals/time-to-certainty/**`, `ProofFact.ts`, `ProofDigest.ts`,
`WaveOrder.ts` ordering logic, the ontology tree, `apps/labs/ciops`.

## Constraints

- Schema → `Context.Service` contract → implementation; Effect v4 validated
  against `.repos/effect`; `LiteralKit` for literal domains; `effect/HashSet`
  and `HashMap`, never native `Set`/`Map`; `effect/Graph` for the package DAG.
- `classify` is total: an unclassifiable hunk is `unknown`, never an error.
  Every lane's footprint includes `unknown` on day one; at all-`unknown` the
  route equals "run everything".
- Semantic atoms for `package.json`, `bun.lock`, `turbo.json`, `tsconfig*`,
  `biome.jsonc`, workflow YAML; path-pattern atoms with the owning package
  elsewhere (ruling: atom grain).
- Propagation is package-grain per check class (`none | reverse-deps |
  covered-pkgs`) over turbo's package graph (ruling: propagation).
- Transformers run first; the route is computed over the post-transform diff
  (ruling: transformers).
- A refinement is admitted only by census rank, with a mutation fixture per
  claimed-absent kind driving the production `classify`/`route` path and 100%
  replay recall (ruling: admission rule).
- Recall uses base-green attribution per hosted head: a red on a would-skip lane
  counts only when the lane was green on main's latest push run at or before
  the merge-base; unknown base counts (fail-closed) and its share is reported
  (ruling: recall corpus).
- Corpus: hosted PR Check runs since 2026-09-01 by head sha, fetched via
  `refs/pull/N/head`, outcomes and base runs digest-pinned, resumable by head,
  never re-fetching a pinned head.
- Layer 1 is sound only with the root `package.json` field projections: a
  task-input negation of root `package.json` lands together with the projection
  that re-adds the `scripts` dependency; the layer-1 fixture pins the turbo
  version it was proven on (2.11.10, `futureFlags.globalConfiguration` and
  `affectedUsingTaskInputs` on).
- The hosted job always starts; `skip-satisfied` is a success completion with the
  receipt (atoms, footprint, reason) in the job summary; required contexts are
  unchanged (ruling: hosted mechanics).
- Record friction receipts at the moment they happen, redacted for a public
  repo; run `bun run beep quality package-verify @beep/repo-cli` before any
  handoff; one PR per slice through Yeet.

## Acceptance Criteria

Slice 1 (cut line):

- [ ] Schemas and the total footprint record exist in `commands/Ci/`; a test
      proves removing a lane's row is a type error and that every row contains
      `unknown`.
- [ ] A fixture proves `classify` is total and emits semantic atoms for a root
      `package.json` catalog edit (`pkg:catalog`), a script edit (`pkg:script`),
      and a docs edit (`docs:markdown`).
- [ ] `beep ci route plan` prints the selected set with the atoms that selected
      each lane; at all-`unknown` it equals every lane.
- [ ] `beep ci route census` prints, over the pinned corpus, machine-time turbo
      or CI ran that the route would not select, by atom kind, with the
      `unknown` share and the A1 cost source per lane.
- [ ] `beep ci route replay` prints recall and the base-unknown share; recall is
      100% at all-`unknown`.
- [ ] The corpus receipts are digest-pinned and the fetch resumes by head.

Slice 2:

- [ ] At least one refinement is enforced: its mutation fixtures and a 100%
      replay recall are green and cited in the PR.
- [ ] Layer 1 landed for that refinement: turbo task inputs, the root
      `package.json` field projections written in the prepare phase and
      drift-checked, and the package-local `turbo.json` sweep; a dry-run fixture
      shows the biome catalog bump invalidates at most the lanes whose footprint
      names `pkg:catalog`.
- [ ] `yeet final-check` receipts carry the route section (selected, skipped,
      reasons); the shadow sentinel row exists; enforcement is per refinement
      and revocable from the sentinel.
- [ ] The proof-ledger shadow's resulting misses are attributed in the receipt
      as key change, not disagreement.

Slice 3:

- [ ] A hosted lane the route excludes starts, routes, and completes
      `skip-satisfied` success with the receipt in its job summary; the
      required-context set on `main`'s ruleset is unchanged.

All slices:

- [ ] `bun run beep quality package-verify @beep/repo-cli` green on each PR.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/verification-route/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/verification-route/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/verification-route` | Passes |
| Package handoff | `bun run beep quality package-verify @beep/repo-cli` | Green |
| Route at all-unknown | `bun run beep ci route plan --json # slice 1 creates this command` on a branch with a change | Selected set = every lane |
| Census | `bun run beep ci route census --json # slice 1 creates this command` | Rows by atom kind, `unknown` share, pinned receipts |
| Recall | `bun run beep ci route replay --json # slice 1 creates this command` | 100% at all-unknown; per-refinement 100% before enforcement |
| Layer-1 fixture | repo-cli test: biome catalog bump dry-run under pinned turbo | Lint-only invalidation for the compiled refinement |
| Hosted receipt (slice 3) | a PR whose route excludes a lane: job summary | `skip-satisfied` success with receipt; ruleset contexts unchanged |
| Reflection | `bun run beep lint reflection-artifacts` | Passes at close |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

Inherited from the exploration (`explorations/verification-route/DECISIONS.md`);
new rulings append here.

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-27 | Own packet, not the ontology packet or time-to-certainty D | Different mechanism; neither parent's gate fired | Park this goal; reopen the parent at decompose |
| 2026-10-27 | final-check first, hosted second, pre-push inherits | Push-first made cheap-gates the default local proof | Re-point the first stage in PLAN |
| 2026-10-27 | Semantic atoms for structured files, path atoms elsewhere, `unknown` catch-all | The measured loss was a package.json blob | Collapse kinds to path grain; sound by totality |
| 2026-10-28 | Footprint home: total `Record<CiLaneId, CheckFootprint>` beside `CiLane.ts` | Shared key across all three stages; compile-time totality | Move rows to a document with a lint |
| 2026-10-28 | Admission by measured loss + fixture + 100% replay recall | Catch-all keeps soundness; audit-admission grew to 52 terms | Declare more rows at `unknown` |
| 2026-10-28 | Propagation package-grain per check class | Sound, no fresh index needed | Add symbol grain under the same rule |
| 2026-10-28 | Transformers first, route the post-transform diff | Matches the prepare phase; no second footprint table | Add a writer→kinds table |
| 2026-10-28 | Code home repo-cli `commands/Ci`, `beep ci route` | The function that matters must be the one that runs | None needed |
| 2026-10-28 | Enforcement gate = fixtures + replay; live shadow is a monitor | No windows; corpus has >1,000 heads | Hold enforcement on the sentinel |
| 2026-10-28 | Base-green recall attribution, live corpus since 2026-09-01 | Inherited reds; frozen inputs end 09-28 | Count every red |
| 2026-10-28 | Select only; `WaveOrder` unchanged | Ordering is built and ruled | Separate ruling with its own census |
| 2026-10-28 | Hosted: `skip-satisfied` success with receipt, job always starts | Required contexts stay present; receipt auditable | Fall back to local-only |
| 2026-10-28 | Two layers: compile to turbo + route the rest | Free hosted-side win; negations alone unsound | Route only |
| 2026-10-28 | Appetite: three PR slices, cut line at the census | Replay, not a window | Stop after slice 1 |
| 2026-10-28 | DEFERRED: ProofFact re-key | time-to-certainty's surface; needs an enforced refinement first | Fire `proof-key-footprint` |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
