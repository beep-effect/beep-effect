# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-10-27

Operator, verbatim from the session that opened this packet:

> The basic idea was given a change compute the dependency graph -> determine
> which changes need to be run given a type of change via the ontology ->
> order verification of the change by cheapest first until the thread returns
> to its source. Simply from a logical stand point I'm fairly certain this
> would decrease the Time To Certainty. Like say we change the @biomejs
> version, this is a change that wouldn't warrant needing to re-run test,
> check or build... only lint & even then only a subset of what lint runs as a
> whole. Now compare that to what the CI, yeet verify & publish would run by
> default with the 'dumb' turbo.

> Can we use a taxonomy to describe the entire domain of changes an agent can
> make in the repository as well as all of the laws, checks, lints, etc & can
> we compose that taxonomy into a graph which tells us which checks can be
> affected by which changes & can we define the axioms that would allow us to
> compute the number of checks we would need to run given a set of changes
> ordered by cheapest to most expensive such that we can reduce the Time to
> Certainty by eliminating those checks that would otherwise be run by a less
> intelligent build graph.

Also from the operator: measurement windows do not fit this repo. The
machinery changes daily by design, so a goal gated on "wait X days" is
forgotten and never closes (time-to-certainty C4.2 is the standing example:
paused 2026-09-28 on a 200-attempt sample; 46 recorded by 2026-10-27, last row
2026-10-05, because push-first #1427 moved the proof it counts to hosted CI).
The acceptance instrument here is replay over history, not a window.

The experiment that opened the packet (clean `main`, 2026-10-27, `turbo run
build check lint test --dry-run=json` before and after bumping
`@biomejs/biome` 2.5.6 -> 9.9.9 in the root catalog, package.json only, then
restored): build 188/189 task hashes invalidated, check 188/189, lint 187/189,
test 187/189. Global hash unchanged; no workspace external-deps hash changed;
one workspace declares biome. The moved input is `../../../package.json` in
every task's input map: root package.json is an implicit input of every task.
Root package.json changed in 110 commits since 2026-09-01. Same-day cache
status on that checkout: test 139 MISS / 50 HIT.

The proof ledger is blind the same way: `ProofEpoch` salts every fact with
`lockfileDigest`, and turbo-backed lanes key on turbo's task hash (ttc C3).

Sketch written in the session (to be challenged in align, not doctrine):

- Changes: `classify : Hunk -> ChangeAtom`, total, with an `unknown` kind that
  maps to every lane. Semantic atoms for structured files (package.json,
  bun.lock, turbo.json, tsconfig*, biome.jsonc, workflows); path-pattern atoms
  elsewhere.
- Checks: the lane vocabulary (`CiLaneId`, 24 ids, shared by pre-push,
  final-check and hosted). Each lane gets a `CheckFootprint`: the atom kinds
  that can change its verdict, a propagation class, a transformer flag, and a
  fixture ref per claimed absence.
- Graphs: `affects` (bipartite kinds x lanes), the package dependency DAG for
  propagation, the lane DAG for ordering.
- Axioms: soundness (empirical; fixtures + replay recall), totality via the
  catch-all, monotonicity, verdict determinism (footprint digest as the proof
  key), transformer fixpoint.
- Computation: `Required(delta)`, `Route` = topo-sort by (cost P50, first-red
  share, precise before imprecise), `Saved = Cost_turbo - Cost`.
- Admission of refinements by measured loss (loss census over history), each
  refinement carrying its fixture and a clean replay recall.

What is proven and what is not, as stated in the session: the premise (the
loss for one kind) is measured; `Cost <= Cost_turbo` under soundness is a
theorem; frequency (census), soundness (per row) and cost-to-KPI (critical
path on hosted; fix time inside an episode) are open and answerable by replay.

Pointers: `THE_AGENTIC_YOYO.md` (repo root); Addy Osmani, "How the Claude
Code team does code review", x.com/addyosmani/status/2114604912520921136
(2026-10-26), for the review-lane analogue (incidents as the eval; precision
from dispositions; convergence capped).

## 2026-10-28

Correction to the 2026-10-27 entry, found by the landscape research and
verified by dry-run: root `package.json` is not a turbo implicit. Our own
`turbo.json` sets `futureFlags.globalConfiguration: true` and lists
`package.json` (with `.bun-version`, `.nvmrc`, `tsconfig.json`,
`tsconfig.base.json`, `tsconfig.packages.json`) in `global.inputs`; turbo
2.11.10 copies every global input into each task's input map rather than the
global hash, which is the `../../../package.json` row that moved.

Dry-run 2026-10-28, same biome bump, with `"!$TURBO_ROOT$/package.json"`
appended to the root `lint` task's inputs (turbo.json and package.json
restored afterwards): lint 1 of 189 hashes changed, down from 187. The one
survivor is `@beep/identity`, whose package-local `turbo.json` declares
`$TURBO_ROOT$/**/package.json` for lint.

What this does and does not mean. A per-task negation is the file-grain
footprint, expressible in turbo today with no new runtime. It is not sound on
its own for root `package.json`: every package script delegates to a root
script (`"build": "bun run beep:build"`), so the root `scripts` section is a
real input of build/check/lint/test; the `catalog` and dependency sections
reach tasks through the lockfile-derived external-dependency hash (unchanged
in the experiment because no install ran); `patchedDependencies`,
`trustedDependencies` and `workspaces` have their own consumers. Excluding
the whole file drops the `scripts` dependency. The sound form is semantic: a
transformer that projects each field family of root `package.json` into a
generated file (`root-scripts`, `root-catalog`, ...) and per-task inputs that
name the projections a lane reads. That is the atom-grain ruling compiled
into turbo's own input language, and with `affectedUsingTaskInputs: true`
the hosted `--affected` runs would sharpen with it for free. Open: whether
that compile layer is the first slice, with `beep ci route` reserved for what
turbo cannot express (dependency-kind footprints, propagation classes, the
hosted skip-satisfied receipt).
