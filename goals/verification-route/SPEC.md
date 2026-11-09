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

- [x] Schemas and the total footprint record exist in `commands/Ci/`; a test
      proves removing a lane's row is a type error and that every row contains
      `unknown`.
- [x] A fixture proves `classify` is total and emits semantic atoms for a root
      `package.json` catalog edit (`pkg:catalog`), a script edit (`pkg:script`),
      and a docs edit (`docs:markdown`).
- [x] `beep ci route plan` prints the selected set with the atoms that selected
      each lane; at all-`unknown` it equals every lane.
- [x] `beep ci route census` prints, over the pinned corpus, machine-time turbo
      or CI ran that the route would not select, by atom kind, with the
      `unknown` share and the A1 cost source per lane.
- [x] `beep ci route replay` prints recall and the base-unknown share; recall is
      100% at all-`unknown`.
- [x] The corpus receipts are digest-pinned and the fetch resumes (by run id, checkpointed per
      completed UTC day; see the 2026-10-31 Decision Log row).

Slice 2:

- [x] At least one refinement is enforced: its mutation fixtures and a 100%
      replay recall are green and cited in the PR (`packet-markdown-out-of-build-check`,
      `research/slice-2-replay.md`).
- [x] Layer 1 landed for that refinement: turbo task inputs, the root
      `package.json` field projections written in the prepare phase and
      drift-checked, and the package-local `turbo.json` sweep; a dry-run fixture
      shows the biome catalog bump invalidates at most the lanes whose footprint
      names `pkg:catalog` (met: every lane still names it; a Biome bump stays global because
      Biome is a root dependency, and a non-root catalog bump invalidates only its dependents,
      `research/slice-2-layer1-dryrun.md`).
- [x] `yeet final-check` receipts carry the route section (selected, skipped,
      reasons); the shadow sentinel row exists; enforcement is per refinement
      and revocable from the sentinel.
- [x] The proof-ledger shadow's resulting misses are attributed in the receipt
      as key change, not disagreement.
- [x] Package-grain propagation reads the workspace graph at the requested head,
      not the checkout, before any lane is selected from affected packages (see
      the 2026-10-31 Decision Log row). Slice 2 selects no lane from affected packages
      (decision `2026-11-07-propagation-stays-a-label-in-slice-2`).

Slice 3:

- [x] A hosted lane the route excludes starts, routes, and completes
      `skip-satisfied` success with the receipt in its job summary; the
      required-context set on `main`'s ruleset is unchanged. Proven on #2885 (packet markdown only),
      `heavy-admit.yml` run 42364996454: Heavy / Build (job 128381390298) and Heavy / Check (job
      128381390311) ran admitted with `ROUTE_SKIPS: build,check`, wrote the route receipt to their
      job summaries and succeeded, while the other Heavy lanes ran; no ruleset or required context
      changed (#2879, #2884).

All slices:

- [x] `bun run beep quality package-verify @beep/repo-cli` green on each PR, with named skips where
      the workstation's OOM killer stopped a local gate; hosted CI proved each skipped gate, and each
      PR body records the skips.
- [x] No unrelated refactors or formatting churn.

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
| 2026-10-31 | Affected packages from `@beep/repo-workspaces` `ChangeDetector`, not a re-derived turbo graph | The library already computes changed and affected packages over the workspace graph | Swap the injected `affected` for a turbo dry-run reader |
| 2026-10-31 | Classifier owner lookup reads the root `workspaces` globs at the commit, not `WorkspaceDiscovery` | Discovery reads the working tree and cannot answer for a historical commit | Use discovery when classifying the working tree only |
| 2026-10-31 | Corpus resumes by run id and checkpoints per completed UTC day; a day with a running run keeps its finished runs without advancing `until` | A 60-day end-only capture was lost to the shared 5,000/h GitHub limit; advancing past a running day would drop its runs forever | Revert to an end-only write |
| 2026-10-31 | `commits` atom kind: one atom per head for the commit range | Replay: two PR #1399 heads had trees identical to their base yet added commits; commitlint reads the range | Drop the kind and treat empty-tree heads as `unknown` |
| 2026-10-31 | `external` footprint flag; `security` external (always selected) | Replay: Security red on an empty-tree head while green on the base; osv-scanner reads the live advisory DB | Clear the flag; Security then follows its atom kinds |
| 2026-10-31 | Missing PR heads are fetched by SHA; an unfetchable head is a counted `unknown` change | 4 of 5,083 heads were force-pushed over and absent from `refs/pull/*/head`; one missing head failed the whole census | Fail the census on a missing head |
| 2026-10-31 | Census purity is judged over tree kinds (ignores `commits`) | Nearly every head carries `commits`; including it empties the pure columns that rank refinements | Count `commits` in purity |
| 2026-10-31 | Slice 1 reports affected packages from the live workspace graph, not the graph at each head | The field only labels the plan; every lane selects from atoms, which already resolve owners at the commit. A graph per head means reading every workspace manifest at each of 5,083 census heads | Read the graph at the head (batched `git cat-file`) once propagation selects lanes in slice 2 |
| 2026-10-31 | Corpus capture assumes one writer per corpus directory | Capture is a hand-run operator refresh of committed evidence; a safe lock needs stale-lock recovery after a crash | Add an exclusive directory lock when slice 2 adds an unattended corpus refresh |

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug verification-route`; add a `kind: decision` file there, never edit this block._

### First enforced refinement: packet markdown and commits out of build and check, 2026-11-07

Census rank 2 narrowed to the two lanes where the absence is provable from the checkout: packet markdown is root-owned (outside every workspace glob), turbo registers no //#build or //#check, and no non-test source imports .md/.mdx. Both lanes read the tree only, so the commits atom is removed too. Packet data stays in both footprints. Fixtures: test/ci-route-refinements.test.ts; replay: research/slice-2-replay.md.

Lane feat/verification-route-slice-2

Reverse: Set the refinement's mode to shadow, or revoke it in standards/verification-route.sentinel.json

### Layer 1: root package.json replaced by a catalog-free projection; root-dependency bumps stay global, 2026-11-07

tsconfig-sync writes standards/root-package.projection.generated.json (every top-level field but catalog, scripts included) and config-sync:check drift-checks it; turbo.json global.inputs carries the projection instead of package.json, in one commit. Measured under turbo 2.11.10: a catalog bump of a dependency the root does not itself depend on invalidates only its dependents (fixture: verification-layer1-turbo.test.ts, gated by BEEP_LAYER1_DRYRUN). A bump of a root dependency (the Biome case in SPEC's acceptance row) still invalidates every task because turbo hashes the root's external dependencies into each task; moving Biome out of the root manifest is outside this goal. SPEC's row is met as written, since every lane's footprint still names pkg:catalog. The 25 package-local turbo.json files were swept and none re-adds the root manifest.

Lane feat/verification-route-slice-2

Reverse: Restore package.json in turbo.json global.inputs and drop the projection section from tsconfig-sync

### Propagation stays a label in slice 2, 2026-11-07

No slice-2 refinement selects lanes from affected packages; every decision comes from atoms whose owners already resolve at the commit. The SPEC row about the head graph applies only once a lane selects from affected packages, which slice 2 does not do.

Lane feat/verification-route-slice-2

Reverse: Read the workspace graph at the head (batched git cat-file) when a lane first selects from affected packages

### Refinement registry and revocation sentinel, 2026-11-07

ROUTE_REFINEMENTS beside ROUTE_FOOTPRINTS; each row's kinds are derived from it so a refinement and its footprint effect cannot drift. Only enforced refinements not listed in the tracked standards/verification-route.sentinel.json skip a lane (routeLaneDecision); revoking is a one-line commit.

Lane feat/verification-route-slice-2

Reverse: Inline the removals into ROUTE_FOOTPRINTS and delete the sentinel file

### Reject src:test out of build, 2026-11-07

Census rank 3 is unsound as stated: apps/docket-intake, apps/labs/ciops and others build with tsrs -p tsconfig.check.json, which includes test/, and their package-local turbo.json re-includes test/ in build inputs.

Lane feat/verification-route-slice-2

Reverse: Admit it per package once app builds stop type-checking test/

### research-intake-2026-11 routed 123 affirmative findings here, 2026-11-07

The research-intake-2026-11 intake routed 252 findings to this packet (123 affirmative, 20 critiques or disputes; 110 public, the rest from the private partition and not quoted). Routing table and method: goals/research-intake-2026-11/research/ROUTING.md; per-finding rows with spans live in the research library, filtered by packet in goals/research-intake-2026-11/research/routing.jsonl. Contested claims, if any, are clustered in goals/research-intake-2026-11/research/CONTRADICTIONS.md. Strongest public evidence:

- citesAsEvidence: https://www.deccanchronicle.com/artificial-intelligence/openai-pauses-training-of-top-ai-models-after-agent-bypasses-internet-controls-1990979 — Model-assisted red-teaming of sandbox/network controls is adopted as an ongoing verification practice.
- citesAsEvidence: https://arxiv.org/abs/2609.30123 — The authors explicitly bound the method's assurance: missing requirements and unobserved branches can remain absent, and model reasoning within a state can still fail. Admission should therefore disti
- citesAsEvidence: https://ipwatchdog.com/2026/08/28/uspto-issues-its-first-ai-predicated-discipline-order-involving-hallucinated-cites-to-intrinsic-record/ — A second AI review did not prevent the reported citation failures or the resulting disciplinary findings. For a citation-verification workflow, this case supports requiring checks against source docum
- citesAsEvidence: https://modelcontextprotocol.io/seps/2640-skills-extension — A disk cache must either be exclusively writable by the host with immutable cached files or rehash cached bytes on every access. Integrity checks must evaluate the bytes actually served, including aft
- citesAsEvidence: https://github.com/modelcontextprotocol/typescript-sdk/pull/2818 — The README points to runnable client/server pairs described as self-verifying. These are potential integration-validation references; the capture itself does not include their implementations or execu

This amendment adds evidence only; it changes no acceptance criterion. The owning lane decides whether any finding changes its plan.

Lane feat/research-intake-2026-11

Reverse: Delete this decision file and regenerate the block; the findings stay in the library and in research-intake-2026-11/research/routing.jsonl

### Taxonomy refinement: packet:data, cfg:baseline, scratchpad; src:test narrowed, 2026-11-07

Census rank 1. New kinds are on every footprint, so the change is sound by construction. src:test no longer matches a file under the owner's src/ (packages/foundation/modeling/schema/src/internal/test/Markdown.test-kit.ts compiles into dist), and packet roots win over the test rule (goals/**/test/items.json is packet data).

Lane feat/verification-route-slice-2

Reverse: Drop the three kinds and restore the directory-anywhere src:test rule

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
