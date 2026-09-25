# time-to-certainty — decisions

Grill log. Each entry records the question, the ruling, the rationale, and the rejected options.
Rulings are the operator's; the orchestrator proposes and records.

## 2026-09-03 — C1 schema grill, round 1 (six rulings, steward: Benjamin)

Inputs: `research/g1-prior-art.md` (ideas 1, 2, 3, 6), the existing shadow ledger
(`packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts`, keyed by command hash and a
whole-tree diff fingerprint), and the 2026-09-02 closeout episode.

**Ruling 1 — the reuse key is a tier-independent action digest.**
`digest(lane command, sorted env profile, lane input file digests, epoch salt)`, independent of
git SHA and of the tier that produced the proof. Rejected: extending the whole-tree fingerprint
with a tier field (any edit anywhere invalidates every lane, which is the docs-change-reruns-
coverage defect); Turbo-hash-only reuse (coverage and tsgo tests, the largest lanes, would never
reuse). Consequence: lanes without declared inputs are marked non-reusable rather than guessed.

**Ruling 2 — the first enforced pair is attempt-to-attempt within pre-push.**
A review fix reruns only the lanes whose inputs changed; this was ship-velocity B5's original
target (the roughly 1,000-second full-proof rerun after small review fixes). Same machine, same
epoch, same tier. Rejected as first pair: pre-push to merged preview (crosses env profiles; second
pair once profiles are in the key and shadow is clean there too); both at once (largest blast
radius before the key has a record).

**Ruling 3 — the ledger is per-checkout, append-only NDJSON under `.beep/yeet/`.**
One writer, no coordination primitive, reuse within a checkout's own history. Rejected for now:
a machine-wide ledger keyed by origin (cross-agent reuse; deferred until provenance and epoch
checks have a record) and a remote ledger carried as Turbo cache artifacts (the path to hosted
reuse, which stays gated on the parity ledger).

**Ruling 4 — the epoch salt is lockfile + toolchain pins + root config.**
`digest(bun.lock, Bun and Node pins, root turbo.json, root tsconfig.base.json, policy-pack
version)`. Any change starts a new epoch; a deps bump still invalidates everything, as today.
Rejected for now: per-lane external-dependency subsets (Nx/Pants shape; more reuse across deps
PRs, but catalog and workspace-protocol holes make it a second-phase item with its own fixtures);
lockfile-only (misses toolchain and root-config changes).

**Ruling 5 — script-lane inputs are declared as Turbo tasks with explicit inputs.**
Coverage shards, tsgo tests, policy, and labs become Turbo tasks (with `cache: false` where
outputs must not be cached); Turbo computes the hash, the ledger records it, and the lanes become
cache-shaped for the remote cache as a side effect. Rejected: input globs in the lane descriptor
(a second hashing engine with its own drift); mixed by lane fitness (two engines to keep honest).
Migration order is decided after the economics report ranks lanes by minutes.

**Ruling 6 — the changed-package tripwire stays as a runtime guard and a must-fail fixture.**
Any lane for a package whose source the change touches is never served from the ledger, even when
the digests say it could be. Redundant when digests are right; the guard that catches an
undeclared input when they are wrong. Rejected: digest-only trust.

**Orchestrator defaults recorded without a question (routine):** schema version `proof-fact/v1`;
facts expire on epoch change and after 30 days (the remote cache's lifecycle); provenance carries
run id, checkout origin key, tier, and the hosted run id when known.

## 2026-09-03 — C1 schema grill, round 2 (one ruling, steward: Benjamin)

**Ruling 7 — the enforcement bar is an event count, not a calendar.** Shadow mode graduates to
enforcement for the attempt-to-attempt pair only after at least 200 attempts across at least 10
distinct branches record zero disagreements (a lane the ledger would have reused that failed when
actually rerun), and every must-fail fixture passes. Rejected: a 50-attempt, 5-branch sample (one
undeclared-input miss is indistinguishable from noise); per-lane graduation bars (most precise,
but the ledger report would have to track graduation per lane before any lane has a record).

## 2026-09-03 — P0 ratification and priority grill, round 3 (three rulings, steward: Benjamin)

Inputs: `research/economics.md`, `research/baseline.md`.

**Ruling 8 — the P0 baseline is ratified as drafted.** Window 2026-08-04 to 2026-09-03; M1 is
red-to-green per branch with the 24-hour comparison censor and the uncut-tail row kept beside it
(P50 43.3 min, P95 3.95 h, n=328); M2 8.4 min P50; M3 and M4 recorded as unmeasurable until A5;
M5 327 unfinished starts. Close-out re-runs the same script row by row. Rejected: dropping the
censor (not comparable with the ontology article's figure); waiting for A5 before freezing (delays
the baseline by a PR cycle for numbers that will be reported as a second row anyway).

**Ruling 9 — A5 journal facts starts now as its own lane, ahead of the hygiene PRs.** Attempt
rows gain the tree fingerprint and tier; the pre-push and merged-preview wrappers journal each
inner lane with duration and input digest; unfinished starts and lease or submitter deaths get
terminal rows. Rejected: sequencing after the hygiene PRs (nothing in B or C is measurable without
it); folding it into the ProofFact schema PR (the schema PR would then block measurement).

**Ruling 10 — script lanes migrate to Turbo tasks largest-minutes first: coverage, then tsgo
tests, then policy, then labs.** Coverage Regression is the largest hosted pool (15.1% of required
lane time) and the largest inner lane of the pre-push wave. Rejected: a cheapest-lane pilot (lower
risk, slower payoff); waiting for A5's local per-lane numbers (the hosted ranking is a sufficient
proxy for order).

**Open frontier after round 3:** the machine-wide ledger as a P3 candidate; the second enforced
pair (pre-push to merged preview) once env profiles are in the key; the head-install preflight's
349 failures (classify before deciding whether it is backpressure or a hygiene class).

## 2026-09-03 — A5 journal-facts review, round 4 (six rulings, ratified by the steward: Benjamin)

Inputs: the six chatgpt-codex-connector threads on PR #964 (A5 journal facts), the four threads on
PR #968, and the C1 vocabulary landed in PR #954. Proposed by the orchestrator during review and
ratified as amended by the operator on 2026-09-03; the A5 implementation on PR #964 follows them.

**Ruling 11 — normal completions keep `attempt-finished`; `attempt-terminated` is abnormal only.**
The attempt journal is a schema with consumers (the economics script, the ontology corpus ETL).
Interrupts, signals, queued-submitter deaths, and lease evictions terminate with a LiteralKit reason;
the economics loader accepts both tags and feeds M5 from the terminated rows. Rejected: renaming
every completion (breaks every consumer and every frozen corpus).

**Ruling 12 — inner-lane reports travel through a durable side channel, never captured stdout.**
The wrapper writes a schema-versioned inner-lane report file under the run's artifact directory and
the journal writer reads it; the 512 KiB stdout capture bound makes stdout parsing lossy on noisy runs.

**Ruling 13 — a dead queued ticket is a terminal event, claimed atomically first.** A reaper
claims the dead ticket (rename or non-forced unlink) and only the process whose claim succeeded
emits `attempt-terminated` with reason queued-submitter-death plus the admission row, so a
submitter killed while waiting never leaves an unfinished start and concurrent contenders cannot
journal the same death twice.

**Ruling 14 — lease eviction is an explicit journal variant, shipped forward-compatibly, and the
CI-ops projection lab folds it as a release.** The journal states the fact instead of leaving replay
to infer it. Because fleet checkouts run mixed revisions and an older writer's locked rewrite
decodes every row with a closed union and drops what it cannot decode, the variant cannot simply be
added under v1: writers must first preserve unknown rows verbatim through every rewrite (a
compatibility transition that lands and rolls out before any eviction row is written), and the
variant ships under a versioned protocol (v2) whose readers accept v1 rows. The lab's schema and
replay accept the variant with a fixture, and the ontology packet's ledger records that the
eviction fact is now carried.

**Ruling 15 — evictions and ticket deaths are claimed atomically before they are emitted.**
Concurrent reapers rename or non-forcibly unlink the lease (or ticket) and only the process whose
claim succeeded emits the event, so a death is journaled once.

**Ruling 16 — attempt facts carry stage and env profile using the C1 vocabulary.** The merged-preview
bypass path emits no admission event, so the attempt row records `ProofStage` and `ProofEnvProfile`
(from the ProofFact module) directly; A5 rows and ProofFacts share one vocabulary rather than a
parallel field.

**Ratification status:** rulings 11–16 ratified by the operator on 2026-09-03 (all six, as amended
after the PR #968 review).

## 2026-09-03 — A5b compaction review, round 5 (two rulings, steward: Benjamin)

Inputs: the third Greptile P1 on PR #978 (unfinished attempts erase terminal facts) and an
independent four-lens review of head 9c37b20d67 run on GPT-5.6 Sol (xhigh) with three adversarial
refuters per finding; six of nine candidates survived.

**Ruling 17 — the retention budget is over terminal attempts only.** The journal keeps the newest
50 unprotected terminal *attempts* (each a start/terminal pair, so up to 100 paired event rows) plus
every unfinished start and the compaction receipt; unfinished starts are never counted toward the
budget and never evicted, and stale-start reconciliation is what bounds the unfinished set.
Amendment (Codex review of this PR, ratified 2026-09-03): a start recorded before process identity
existed (no owner pid and start time; the frozen baseline holds 327 such unmatched starts) cannot be
classified dead by pid-plus-start-time reconciliation, so the first post-rollout reconciliation closes
it with `attempt-terminated` reason `legacy-unowned-start` (a new LiteralKit member) and one journal
receipt per pass; the P0 baseline stays frozen, M5 counts these rows as unfinished inside the
baseline window and as terminated thereafter. Rejected: a separate ceiling on unverifiable unfinished
starts (can drop a start whose owner is merely unverifiable); a single total cap that never evicts
unfinished (terminal facts still vanish whenever the unfinished count nears 50); a 24-hour grace
period for legacy starts (protects an unlikely window at the cost of a second rule).
Amendment 2 (Greptile review of PR #978, ratified 2026-09-03): a start that recorded an owner pid
but no process-start identity is bounded by age, because without a start-time identity age is the
only detector of pid reuse. Three states are distinct: a start with no owner pid recorded at all is
a legacy start (amendment 1, `legacy-unowned-start`); a start whose recorded pid no longer exists as
a process is closed as `owner-dead` at the next reconciliation; a start whose recorded pid still
exists, with no start-time identity to confirm it is the same process, stays open until the start
is older than the longest plausible attempt (24 hours from the start row's `startedAt`, the
`attempt-started` timestamp field);
the first reconciliation after that closes it with `attempt-terminated` reason
`stale-unverifiable-owner` and one receipt per pass. Rejected: keeping such starts open
indefinitely (pid reuse leaves permanent unfinished rows and M5 drifts upward); retrying identity
discovery before the age bound (more code for the same outcome).

**Ruling 18 — economics left-censors from compaction receipts.** The journal-compacted receipt keeps
the evicted attempt ids and a monotonic cutoff: the newest `recordedAt` among every terminal attempt
evicted so far on that journal (the existing accumulated `oldestEvictedRecordedAt` is not sufficient,
because after a second compaction an episode that started between the two evictions may have lost
its leading red attempts). The economics loader marks the branch left-censored at that cutoff and
excludes, or reports separately with a count, any red-to-green episode that starts at or before it.
No archive file and no second writer. Rejected: an append-only economics archive (exact M1 forever,
unbounded second file); accepting the gap with a report caveat (M1 comparability at close-out
unproven).

## 2026-09-08 — C3 package-task migration grill, round 6 (seven rulings, steward: Benjamin)

Inputs: the root `package.json` script census (70 scripts) and `turbo.json`; the two manifest
writers (`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts` and
`packages/tooling/tool/cli/src/commands/Architecture/OperationPlanPackageJson.ts`); the policy step
list in `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`; the doctest lane in
`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`; `research/economics.md` (hosted shares: Lint
Policy 9.73%, Docgen 5.42%, Doctest 2.65%, Knip 2.49%); and the closed
`goals/lint-policy-single-digit` packet (4-way eslint shards shipped; PR scoping deferred).

**Ruling 19 — every hosted script lane except labs becomes a Turbo task, one sublane per task, in
two shapes chosen by input partition.** A sublane whose inputs partition by package becomes a
package task (per-package cache, `--affected` locally). A sublane whose inputs are the whole graph
becomes a Turbo root task (declared in `turbo.json` under the root-package prefix) with explicit
root-relative inputs; root tasks always run unfiltered, because `--affected` marks the root package
only when root files change, so their reuse comes from the hash alone. Check variants are tasks;
`--write` variants stay plain scripts. Rejected: promoting by "unit of meaning" with graph-wide
lanes left as plain scripts (a second class of non-reusable lanes, against ruling 5's one-engine
rule); one lint-policy task (the union glob recreates a whole-tree hash, per the C3 plan note);
wrapping every lane as a package task (about 140 boots for tools whose unit is the graph).

**Ruling 20 — scope and order: all hosted script lanes except labs, largest minutes first, then
precision.** Policy sublanes (deprecated-apis first), then doctest, knip, fallow, jsdoc-ratchet;
labs stays its own C3 item. Hosted lanes keep full scope and gain speed only from remote-cache
reads on unchanged inputs; the local pre-push wave uses `--affected` plus the local cache.
Rejected: policy only (leaves the root doctest config and 5.1% of hosted lane time outside the
engine); hosted `--affected` (turns the hosted proof into a prediction before the parity ledger has
evidence).

**Ruling 21 — four package scripts, split by cost class.** `lint:deprecated-apis` (eslint
deprecated profile, the long pole, own hash), `lint:jsdoc` (eslint docs profile, own hash),
`lint:laws` (every sub-second `--include-prefix` law plus package-test-imports in one task and one
hash), and `doctest`. Separate hashes only where cost or precision differ by an order of magnitude.
Rejected: one script per law (about ten new scripts in 147 manifests for sub-second lanes); one
package-wide policy script (a one-line law edit reruns the eslint pole for every touched package).

**Ruling 22 — doctest is a package task driven by a mode branch in `vitest.shared.ts`.** The
package script sets a declared env flag and runs `vitest run`; the shared config branches on it the
way it already branches on the coverage flags (doctest plugin, in-source tests over the package's
src tree, serial). The root doctest vitest config retires and the hosted doctest lane runs the
Turbo task instead of a file list. Rejected: keeping the root file-scoped lane (no cache, no
filter); a second per-package doctest vitest config (147 files for one flag); both coexisting (two
truths for one proof surface).

**Ruling 23 — codegen placeholders go, and the root name splits.** Turbo skips packages without a
script, so the `echo 'no codegen needed'` placeholders leave the fleet and both scaffolds; packages
define `codegen` only when they generate. Root `codegen` becomes the Turbo task wrapper; the barrel
generator moves to `beep codegen barrel` (root `codegen:barrel`). Rejected: keeping placeholders
for explicitness (ceremony that also feeds the task hash); leaving the collision as a follow-up.

**Ruling 24 — one scripts-block schema, two writers, one gate.** A single canonical scripts-block
schema (a LiteralKit of script names, per-kind variants, the `beep:*` indirection encoded) is
consumed by create-package, the architecture operation plan, and delete-package; `beep lint
package-scripts --check` and `--write` join the lint-policy subcommands and `beep:preflight`; the
fleet is rewritten once with `--write` in the same PR that lands the gate, so the gate is never red
on main. Rejected: converging writers without a gate (drift returns on the next hand edit); fixing
new-package scaffolds only (127 packages keep the old docgen form).

**Ruling 25 — home and execution.** The work is C3 sub-items of this packet (no new packet);
rulings append here and receipts go to `research/OPPORTUNITIES.md`. A Fable orchestrator writes the
lane-to-task table, the schema, and the `turbo.json` contract before any implementation; Codex
lanes implement each PR at medium effort; Grok verifies Turbo 2.10 root-task and `--affected`
semantics against the docs. Rejected: a new goal packet (a second steward surface for one KPI); an
exploration first (doctrine and rankings are already ratified); a single Codex session end to end
(no reviewed design gate).

**Orchestrator defaults recorded without a question (routine):** CLI-backed package tasks call
`beep-cli` directly (the `package-test-typecheck` precedent) while tool-backed ones keep the
`beep:` indirection; check tasks cache with no outputs, and generators that write tracked files
stay `cache: false`; the schema module lives under the repo CLI's internal modules; the per-shard
eslint cache is dropped when the package task lands (one caching engine) and may return with a
receipt; aggregate steps that read per-package results stay CLI steps after the Turbo run.

## 2026-09-09 — C3 design gate ratified, round 7 (steward: Benjamin, by merge of #1018)

Inputs: `research/c3-lane-task-table.md` revision 4 (one adversarial Codex review, two Greptile
P1s and thirteen Codex/Greptile PR threads folded, Greptile 5/5), `research/c3-turbo-facts.md`
with the live-probe amendment, `research/c3-sublane-inputs.md`.

**Ruling 26 — the design gate stands as merged.** Decisions D1–D16 of the table are ratified as
written under the table's own rule (veto by editing the entry; silence ratifies). The recorded
defaults of its open questions apply until edited here: Q1 `coverage` stays package-owned; Q2
`doctest` is stamped only on the workspaces that own `import.meta.vitest` sources; Q3 git, tree,
ref, time and network lanes are non-reusable; Q4 policy runs in ordered invocations with local
fail-fast after the cheap gates; Q6 effect-imports code mode stays a root task until it has
promoted families; Q7 the policy-tool fingerprint covers the repo CLI's computed workspace
dependency closure.

**Ruling 27 — ruling 19's mechanism is amended (Q5).** With `affectedUsingTaskInputs` on, root
tasks join the local `--affected` plan through their own declared inputs (probes P3–P7). "Root
tasks always run unfiltered" now applies to the hosted full-scope run and to the non-reusable
group of D2, which needs its own unfiltered invocation; it is no longer a general mechanism.
Rejected: keeping two invocations for every root task (an unverified premise, now contradicted
by evidence).

**Execution:** PR 1 (C3.1) runs on a Codex lane at medium effort from
`research/c3-1-brief.md`; the orchestrator publishes and answers review; Benjamin merges.

## 2026-09-09 — Lane identity, round 8 (one ruling, steward: Benjamin, quality-lane audit PLAN D4)

Inputs: quality-lane audit 2026-09-09 (`REPORT-local.md` finding D1: one command carried three or
four lane ids — `check:tsgo:rules` / `lint:tsgo-rules` / `cheap-gates:tsgo-rules` / log prefix
`[check:tsgo-rules]` — while the lane-proof ledger, `IssueClassification.knownSubLaneHints`, and the
WaveOrder seed all key on the id), PLAN decision D4, PR "Lane orchestration, turbo graph, and lane
identity" (feat/quality-lanes-pr1).

**Ruling 28 — one lane id per command; tier is metadata; label is the log prefix.** A GitHub-check
lane id names the command it runs and nothing else, uses `:` as its only separator, and equals the
lane's step label, so the `[beep-cli] <label>` log prefix, the lane-proof ledger key, the
remediation-hint needle, and the wave-order seed key are one string. The scheduling tier is a
`tier` field on `GithubCheckLaneSpec` (`cheap-gates` | `pre-push`), never an id prefix: the same
command keeps one id in both tiers, which is what lets ruling 1's reuse match across tiers when
the tree is unchanged. A cheap-gates lane that repeats a lint-policy step carries that step's id.
Enforced by a test over every registered lane (label equals id; no two ids run one command).
This supersedes the C3 lane table's legend sentence (`research/c3-lane-task-table.md`, line 284,
"lane ids consumed by `IssueClassification.ts` and WaveOrder keep their names"): task ids are still
recorded beside lane ids, but the lane ids themselves converge on the command name. Rejected:
keeping tier-prefixed ids and de-duplicating in the ledger by command digest alone (the hints and
the seed would still fork on spelling). Consequence accepted: ProofLedger and GateStaleness entries
keyed on the old spellings are non-reusable for exactly one run after the rename.

## 2026-09-09 — C3.2 fingerprint mechanism, round 9 (one ruling, proposed by the orchestrator, ratified by merge of the C3.2 PR)

Inputs: PR #1029's hosted Lint Policy red on `lint:policy-fingerprint` (a committed content digest
cannot be current on a merge ref once main moves the closure; receipt in
`research/OPPORTUNITIES.md`, 2026-09-09), Stage E4's structure-only fingerprint (declared inputs,
no digest), `research/c3-turbo-facts.md` (a task hash includes its dependency task hashes; a
package task may depend on a `//#` root task), and D15 of `research/c3-lane-task-table.md`.

**Ruling 29 — the policy-tool fingerprint is a root task's hash, never a committed digest.**
`//#lint:policy-fingerprint` (`beep-cli lint policy-fingerprint --check`, cached) declares the
computed checker closure as its Turbo `inputs`: the `src/**` and `package.json` of `@beep/repo-cli`
and its transitive workspace `dependencies`, the root `package.json`, the root tool configs the
checkers read, and `standards/policy-tools.fingerprint.json`. Every CLI-backed policy task lists the
root task in `dependsOn`, so Turbo hashes the closure's real content at run time and the digest
reaches each policy task through the dependency-hash edge. The committed file stays structure-only
(the declared input list) and is the source `--write` materializes into `turbo.json`; `--check`
fails when the file or the materialized list drifts from the computation. `**/package.json` leaves
the closure in favour of the members' manifests. Rejected: a committed content digest (never current
on a merge ref); copying the closure globs into every policy task (N copies of one list); broad
static globs such as `packages/**/src/**` (no reuse at all). Consequence accepted: a `turbo.json`
materialization change misses every task once through the global hash, which happens only when the
CLI's workspace dependency set changes. Amends D15 (table revision 5).

## 2026-09-10 — C3.2 hosted sweep, round 10 (one ruling, steward: Benjamin, "I agree continue" on the PR #1079 options)

Inputs: PR #1079's first hosted Lint Policy run (job 102722219371: `lint:jsdoc` 728 s for 137
package tasks against 73.9 s; `lint:deprecated-apis` 52 of 141 tasks at the 15-minute cap against
523.5 s for 28 shards), the local measurements (12 m 50 s cold, 0.455 s warm, 277 tasks), the
export shape (every workspace export resolves to `src`), and the options posted on the PR.

**Ruling 30 — hosted full-scope eslint sweeps keep their shard programs until per-package typed
programs are cheap.** The package tasks `lint:deprecated-apis` and `lint:jsdoc`, the root residual
`//#lint:jsdoc:root`, and the `//#lint:policy-fingerprint` edge stay registered and serve local
non-full runs through `--affected`, where they pay only for touched packages and replay the rest.
The hosted Lint Policy lane and `--full` run the 28-shard deprecated-apis program and the root
`eslint . --max-warnings=0`, whose per-run cost the shards amortize across packages. The shard
runner and the root invocation retire in C3.2b, after a hosted cold measurement shows per-package
typed programs (reference-keeping check overlays plus `^build` declarations) within the shard
budget. Rejected: raising the step budget to fit a ~40-minute sweep (breaks the Lint Policy budget
for every closure-touching PR); switching the typed program in this PR (its own measurement).
Amends D6 (table revision 6).

## 2026-09-10 — C3.2b measurement, round 11 (one ruling, proposed by the orchestrator, ratified by merge of the C3.2b PR)

Inputs: `research/c3-2b-implementation.md` Stage B (local package comparisons with JSON parity,
the 252-task fleet run, the parser reference census) and the three receipts in
`research/OPPORTUNITIES.md` dated 2026-09-10 for C3.2b Stage B.

**Ruling 31 — per-package typed eslint over the check overlays is rejected; the shard program
stays until a reference-aware program exists.** typescript-eslint's project mode creates its
program without project references, so built declarations never replace upstream sources; the
residual project-service pass required for coverage parity costs the root corpus per package;
13 packages have no test overlay. Row 2b therefore lands only the versioned sweep switch and its
record. A retry needs a different program factory (reference-aware, or one typed server shared
across packages), `dist/**` excluded from lint inputs before any `^build` edge, and a fleet
overlay census; it is not scheduled. Amends row 2b (table revision 7); D6 unchanged.

## 2026-09-11 — C3.3 follow-up through C3.6 in one PR, round 12 (two rulings, proposed by the orchestrator at Benjamin's request "all of these done in 1PR", ratified by merge of that PR)

Inputs: `research/c3-3-implementation.md` Stage B measurements (fleet `lint:laws` +
`//#lint:native-runtime:roots` cold 141/141 in 86 s at concurrency 4 against the five hosted
scoped steps at 109 s; warm 0.4 s), ruling 30's reason for keeping a legacy program (the
per-package program cost more than the sweep), the runner-group admission fact that pull
requests run `heavy.yml@main`, and §7.2 rows 3–6 of `research/c3-lane-task-table.md`.

**Ruling 32 — the laws plan switch is a hard switch, not a sweeps key.** `rootRepoLintPolicySteps`
replaces the four `scopedLawStep`s and the `lint:package-test-imports` step with one
`turbo run lint:laws //#lint:native-runtime:roots` invocation (affected locally, full hosted), and
`scopedLawStep` retires. Ruling 30 kept a legacy program only because the Turbo program cost more
on the hosted runner; the laws program costs less cold and nothing warm, so
`standards/lint-policy.sweeps.jsonc` gains no `laws` key. `lint:effect-imports` stays a scoped step
(A1) until C3.5 registers `//#lint:effect-imports`.

**Ruling 33 — rows 3 (follow-up), 4, 5 and 6 of the PR train land as one PR, staged one Codex
lane per stage on one branch.** Each stage is proven with the lane split of `c3-456-brief.md`
before the next launches; hosted proof is the whole PR. Because a pull request runs
`heavy.yml@main`, the Doctest lane on the PR still passes `--mode`; `ci lane doctest` keeps
accepting the flag as a no-op until the `heavy.yml` edit in the same PR reaches `main`, after
which a janitor PR removes the flag. Post-merge accounting (§7.1.4: first cold run, second run's
per-lane hit ratio) is recorded in a closeout receipt, not claimed in the PR.

## 2026-09-11 — C3.4 runtime, round 13 (one ruling, proposed by the orchestrator, ratified by merge of the one-PR train)

Inputs: `research/c3-456-implementation.md` Stage B (Bun fork workers fail vitest's startup
handshake), Stage B2 (repeatable 30 s timeouts on trivial `@beep/schema` examples under the Bun
thread pool, cold and warm), and the orchestrator's isolated comparison (schema alone: Bun threads
9 timeouts; Node 120 files / 363 assertions in 8.0 s), plus the retired root `doctest` script,
which ran `vitest run --config vitest.docs.ts` on Node.

**Ruling 34 — the `doctest` package task runs on Node.** The generated `beep:doctest` script is
`BEEP_VITEST_DOCTEST=1 bunx vitest run` (no `--bun`), the shared doctest branch carries no pool
override, and `beep:test` keeps the Bun launcher. Amends P10 of the table (revision 8); D7 and
ruling 22 unchanged.

## 2026-09-15 — B5 detached durable proof jobs, round 14 (six rulings, proposed by the orchestrator, ratified by merge of the B5 PR)

Inputs: SPEC B5 and the 2026-09-03 receipts in `research/OPPORTUNITIES.md` ("Three
agent-launched processes died with no journal entry anywhere"; "Noninteractive shells omitted
the systemd user-bus environment"); the existing run-scope adoption in
`internal/repo-run/RunScope.ts` (a scope that adopts the CLI pid stays a child of the agent's
shell and dies with it); two live probes on the workstation (systemd 261): a transient user
service started with `systemd-run --user --collect --service-type=exec` under
`agent-runs.slice` runs its `ExecStopPost` line with `$SERVICE_RESULT`, `$EXIT_CODE` and
`$EXIT_STATUS` both on a non-zero exit (`exit-code / exited / 3`) and after `SIGKILL` of the
main pid (`signal / killed / KILL`), and the unit is garbage-collected afterwards
(`LoadState=not-found`); `-p StandardOutput=append:<file>` captures both streams; a bad
`ExecStart` binary fails `systemd-run` loudly (exit 1) under `Type=exec`.

**Ruling 35 — a detached proof is a transient systemd user *service*, and that service is the
lease's accounting unit.** `--detach` on `yeet verify|publish|closeout|monitor|repair` starts
`beep-proof-<jobId>.service` through `systemd-run --user` with `--slice=agent-runs.slice`,
`--collect`, `--service-type=exec`, `--working-directory=<checkout>`, `TimeoutStopSec=60`,
`StandardOutput`/`StandardError` appended to the job log, and an `ExecStopPost` line that runs
`yeet job finalize <jobId>`; the ExecStart words are the submitter's own `process.execPath`,
`process.argv[1]` and the `yeet` words it was called with minus the submit-only flags, replayed
verbatim (no re-serialization of parsed options). Inside a job (`BEEP_YEET_JOB_UNIT` set) the
admission lease's `runScope` records the service unit as `active` without calling `busctl`, so one
proof owns exactly one cgroup, oomd's slice guard and the telemetry readers apply unchanged, and the
reaper treats a recorded `beep-proof-*.service` on a verified dead lease as stop authority (today a
recorded unit that is not `agent-run-<nonce>.scope` is retained as `recorded-unit-mismatch`).
Rejected: a scope (dies with the submitter's process group); `nohup`/`setsid` (no accounting unit,
no termination authority); an installed template unit (`systemd-run` needs no unit files and the
existing `agent-runs.slice` install path stays the only prerequisite). Admission is unchanged: the
job runs the same `withQualityAdmission` path as an attached run; no lock, lease or scheduler is
added.

**Ruling 36 — one durable record per job, one finalizer.** `.beep/yeet/jobs/<jobId>.json`
(`yeet-proof-job/v1`, `jobId` a UUID, also the unit name and log name) is written before
`systemd-run`, moves `submitted → running` when the job's CLI boots (pid, process-start identity,
attempt id), `running → finished` when that CLI records its verdict, and is stamped with the
systemd result triple by `yeet job finalize`, which is the single writer of the terminal phase: a
record still `submitted` or `running` when the finalizer runs becomes `terminated` with a reason
derived from `$SERVICE_RESULT` (ruling 38); a record already `finished` only gains the stamp.
Finalize is idempotent. A `submitted`/`running` record whose unit is `not-found` and whose runner
pid is dead is reconciled to `terminated / finalizer-missing` by the next `job` read. Retention
keeps the newest 50 terminal records and their logs; pruning runs at submit.

Amendment, review round 1 (2026-09-15): The CLI writes `finished`; finalization alone writes `terminated` and the systemd stamp, including launch-failure and missing-finalizer recovery. Settled means terminated or stamped for wait, prune, and inbox publication. Each transition uses a per-record file mutex for consistency, not an admission lock; unstamped finished records with dead owners and missing units gain an unknown stamp.

**Ruling 37 — the job reports through the inbox as one row, acknowledged by observation.** The
finalizer appends exactly one `proof-job-finished` row per job (id derived from the job id):
severity `P2` when the verdict is green (session-start surfacing only), `P1` when the verdict is
red or the phase is `terminated` (injected at the next tool boundary, never a denial — a red proof's
own `local-shard-failed` P0 rows already deny). Job rows are informational, so the ack ledger
gains an `observed` resolution (`via`: `job-wait`, `job-status`, `inbox-ack`) written by
`yeet job wait` on return, `yeet job status --ack`, and `yeet inbox ack <id> --observed`;
`observed` acks are not gate resolutions and the M4 precision computation excludes them.

**Ruling 38 — every job death is an attempt-journal fact written by the finalizer.** When the
record is not `finished`, the finalizer appends `attempt-terminated` for the runner's attempt id
(when no terminal row exists for it, under the journal lock) with reason: `signal` (existing) for
`signal`/`core-dump`; `oom-killed` for `oom-kill`; `timeout` for `timeout`/`watchdog`;
`job-start-failed` for `protocol`/`exec-condition`/`start-limit-hit`/`resources`; `cancelled`
when `yeet job cancel` recorded the request before the stop; `unrecorded-failure` (existing) for
`exit-code` with no terminal row. `YeetAttemptTerminationReason` gains `oom-killed`, `timeout`,
`job-start-failed` and `cancelled`; the economics loader's reason set grows in step. M5 counts a
job death as journaled only through this row, never through the job record alone.

Amendment, review round 1 (2026-09-15): Journal coverage is every dead runner (`signal`, `oom-killed`, `timeout`, `cancelled`, `unrecorded-failure`); `job-start-failed` precedes a runner attempt and is a job-record reason with an inbox row, not an attempt-journal fact.

**Ruling 39 — the job environment is an allowlist of names; values are never recorded.** The
unit receives, by `--setenv`, exact names `PATH HOME USER LOGNAME SHELL LANG LC_ALL TMPDIR
SSH_AUTH_SOCK XDG_RUNTIME_DIR DBUS_SESSION_BUS_ADDRESS NODE_OPTIONS GIT_SSH_COMMAND
GIT_CONFIG_GLOBAL GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL` and
prefixes `BEEP_` and `TURBO_`, minus any name matching `/TOKEN|SECRET|KEY|PASSWORD|CREDENTIAL/i`
and never `OP_*`; plus `TERM=dumb`, `NO_COLOR=1`, `BEEP_YEET_JOB_ID`, `BEEP_YEET_JOB_UNIT`,
`BEEP_YEET_JOB_LOG`. The record stores the forwarded names only. The 1Password shim on `PATH`
loads its own credential; `gh` and the SSH signer use their own stores.

Amendment, pr-event-awareness grill-with-docs (2026-09-25, proposed by the orchestrator; ratified by merge of that packet's producer PR): the allowlist gains `CLAUDE_CODE_SESSION_ID` and `CODEX_THREAD_ID` so a detached monitor's registry rows carry the spawning session's harness and id (`explorations/pr-event-awareness` D3); the deny pattern and names-only recording are unchanged.

**Ruling 40 — detaching is opt-in and fails loud.** `--detach` refuses with a `YeetCommandError`
when the user manager is unreachable (`detectRunScopeSupport` not `active`) and never falls back
to an attached run; it is a submit-only flag, illegal with `--plan`, and prints the job id, unit,
log path and the `yeet job wait` command (`--json` prints the record). `--job-max-runtime
<duration>` maps to `RuntimeMaxSec=` so the `timeout` reason is reachable in a live test.
Agent guidance (yeet skill, AGENTS.md): a proof expected to outlive the repair loop is submitted
with `--detach` and followed with `yeet job wait`.

**Ruling 41 (B7-1) — B7 is a ttc goal item next to B5; the pr-event-awareness packet stays at
capture.** `yeet monitor --until-ready` lands as ttc item B7 (`PLAN.md` after B6) with its
settle rulings recorded here. `explorations/pr-event-awareness` receives one Trail line and a
`research/SOURCES.md` cross-link saying the polling half is being built as B7; webhooks, push
sources, and lane dispatch stay out of scope. Rejected: advancing the packet first (its spark is
wider than this fix); a standalone PR train (no durable home for the settle rulings).

Amendment, pr-event-awareness grill-with-docs (2026-09-25, proposed by the orchestrator; ratified by merge of that packet's producer PR): the heading clause is stale — the packet advanced capture → research → align → shape on 2026-09-24 (`DECISIONS.md` D1–D27) and its graduated goal owns the `--until-ready` producer extension from here. The scope clause stands as B7's scope: webhooks, push sources and lane dispatch were never built under B7, and the packet's D9 (poll kept; a receiver is a MAP gate) and D14 (no launcher) are consistent with it.

**Ruling 42 (B7-2) — `--until-ready` is a third loop policy with an exit-0 terminal; exit codes
in every mode follow the required-only census.** `--until-ready` shares the `--until-merged`
poll loop, snapshot, and flake budget. It exits 0 on the first poll where merge-ready is `yes`;
exits 1 when a required check is red and matched no flake class (or its rerun is spent), when the
PR closes, when the settle timeout expires, or when the consecutive poll-error budget (5) is
spent. Optional checks never affect the exit code in any mode. Plain `yeet monitor` and `--watch`
move to the required-only census (`--until-event` triggers on required reds only; optional
transitions are still emitted, and the `watch-ended` row carries an `optionalFailing` count).
`--until-merged` announces readiness once per head (event + row) and keeps looping. Terminal
states are one `LiteralKit` (`merged`, `closed`, `ready`, `required-red`, `settle-timeout`,
`poll-error-budget`) and the exit-code table is one schema-backed table (`yeetMonitorExitFor`).
Rejected: changing plain monitor's fail-fast default (breaks `publish --monitor`); readiness as an
event on `--until-merged` only (no exit-0 terminal to block on).

Amendment, pr-event-awareness grill-with-docs (2026-09-25, proposed by the orchestrator; ratified by merge of that packet's producer PR): under `--until-ready` a required red and a base conflict stop being terminal — the loop keeps polling across heads and re-pins the wave per head — and `yeet job wait` gains a second return, a distinct exit code when a new P0/P1 wave lands on the job's PR, so the blocking recipe hands control back and is re-run on the same job after the fix push. Exit 0 stays `ready`; `merged`, `closed`, `settle-timeout` and `poll-error-budget` stay terminal (pr-event-awareness D16). The exit-code table changes accordingly with the producer slice.

**Ruling 43 (B7-3) — the loop composes the read-first closeout itself.** When the required
census settles for a head that has no closeout artifact bound to that head, the loop runs the
same code path as `yeet closeout` with the default bot lineup, no gates, and never a reply,
resolve, or retrigger flag (`runYeetAutomaticCloseout`). The artifact binds `reviewedHeadSha`,
so a push invalidates it and the next settle re-runs it; closeout issues are readiness blockers,
never loop failures. Rejected: an opt-in `--closeout` flag (one more flag every recipe must
remember); dropping the `closeout-run` criterion (loses the durable per-head record other
commands read).

**Ruling 44 (B7-4) — settle = the base ruleset's expected contexts have reported and are
terminal.** The required contexts are read once per head from
`gh api repos/{owner}/{repo}/rules/branches/<base>` (`required_status_checks[].context`,
deduplicated and sorted, with the contributing ruleset ids). Settled means every matchable
expected context has reported a terminal outcome and no required check is pending. An expected
context with no exact reported name but at least one matrix child (`<context> (<variant>)`
reported — `Test Unit` on this repo, whose jobs register as `Test Unit (unit-a|unit-b|repo-cli)`)
is tolerated by name, listed in the gate line, and its children are waited for; an expected
context with neither an exact name nor a child is missing and holds the wait. When the ruleset
read fails the rule degrades to the `--required` rows alone (the pre-B7 registration patience)
after one stderr line. Precedent: bors-ng prerun waits for every configured status; GitHub merge
queue waits for required checks on the merge group with a status-check timeout. Live evidence
2026-09-16 (#1143): the `main` ruleset (10240248) lists 17 contexts, `gh pr checks --required`
lists 16. Rejected: patience only (accepts the late-registration race cli/cli #7401 and #8855
left open); a fixed census count (breaks when the workflow set changes); fuzzy or prefix matching
beyond the matrix-child form (counts unrelated jobs as required).

**Ruling 45 (B7-5) — `--settle-timeout <duration>`, default 30 minutes.** On expiry while
unsettled the loop exits 1 with wait reason `settle-timeout`, names the missing and pending
contexts, and the exit summary carries them. A settled head never times out. Rejected: keep
polling and report (a never-registering path-filtered workflow holds the wait forever); treat
unreported as failed (merge-queue semantics, but it lies about what was observed).

**Ruling 46 (B7-6) — delivery is the attached loop now, the detached job after B5, plus one
P1 informational inbox row per head.** Canonical recipe after B5: `yeet monitor --until-ready
--detach`, then `yeet job wait <id>` from a background tool call. The loop appends one
`pr-merge-ready` row per head (id from PR number + head SHA; a push supersedes the prior head's
row with a `fix-sha` receipt naming the new head), severity P1: injected at the next tool
boundary through the existing hook, never a denial, acknowledged by observation (`observed`) once
B5's ack resolution lands (PR1 acks with the existing attributed forms; `--thread-url <pr>` is the
natural one). A bounded spike in PR2 verifies whether a Claude Code `FileChanged` hook with
`asyncRewake: true` on the inbox file can wake an idle session. Desktop PR-bar auto-fix stays
optional. No webhooks. Rejected: row + hook only (rests on the unverified composition); desktop
PR bar as canonical (no green event, needs the app open); P2 (session-start only) and P0 (a gate
on good news).

Amendment, pr-event-awareness grill-with-docs (2026-09-25, proposed by the orchestrator; ratified by merge of that packet's producer PR): the FileChanged/asyncRewake idle-wake spike was proposed and not exercised (`research/b7-implementation.md:671-672`) and is superseded by pr-event-awareness D10/D15/D20 — a probe-gated, SessionStart-spawned shell tail posts one cross-session message per new wave into its own session. The `pr-merge-ready` row and hook injection stand.

**Ruling 47 (B7-7) — naming.** Flag `--until-ready`; row kind `pr-merge-ready`; settle wait
reasons as one `LiteralKit` (`registration`, `required-pending`, `closeout-pending`,
`settle-timeout`); the gate line always names the current reason; the head timeline stamps
`pushedAt`, `settledAt`, `closeoutAt`, `readyAt` and the final gate line prints the push→ready
wall clock. Rejected: `--until-mergeable` (AGENTS.md already uses "mergeable" for the complete PR
state, and the verdict line is `merge-ready:`).

**Ruling 48 (B7-8) — two PRs.** PR1 (no B5 dependency): settle rule, automatic closeout,
`--until-ready`, exit-code fixes in all modes, `pr-merge-ready` row and hook label, skill and
AGENTS.md recipe, PLAN/rulings/receipts, measurement. PR2 (after B5 merges): the detach recipe in
the skill, `pr-merge-ready` observed-ack wiring with `yeet job wait`, the FileChanged/asyncRewake
spike result, and the scratchpad watcher's retirement receipt. Whoever lands second renumbers
rulings via a divergence merge, never a force-push.

Amendment, pr-event-awareness grill-with-docs (2026-09-25, proposed by the orchestrator; ratified by merge of that packet's producer PR): PR2's "FileChanged/asyncRewake spike result" deliverable is retired with the ruling 46 amendment; PR2's other deliverables shipped as #1161.

**Ruling 49 (B7-5 amended) — the settle timeout bounds registration, not execution.** Ruling 45
expired the budget "while unsettled", which included required checks that had registered and were
queued or running. PR #1149's own babysit hit that at 30 minutes with `Heavy / Lint Policy` and
`Heavy / Test Integration` registered but still queued behind six other heavy runs, and exited 1
for a wait that was GitHub's, not a settle failure. The budget now counts only while no check has
registered for the head or at least one expected context is missing (no exact name, no matrix
child); a registered required check is waited for until its own job timeout, and the gate line
names the elapsed time without the budget in that state. `deriveSettleVerdict` stays pure; the
`settle-timeout` terminal, its exit code, and the missing-context naming are unchanged. Rejected:
raising the default to cover the observed heavy queue (the queue depth is not a property of the
head); counting queued checks against a second, longer budget (GitHub already owns that bound).

## 2026-09-16 — B8 heavy-check admission, round 16 (eight rulings, proposed by the orchestrator, ratified by merge of the B8 PRs; numbered after B7's 41–49)

**Ruling 50 (B8-1) — two tiers with three-valued admission.** Tier 1 (lint shards, unit
shards, cheap gates) runs on every push. Tier 2 (the `Heavy / *` matrix) runs only under an
admission verdict computed once per run by `bun run beep ci admission` from a typed event view:
`run` (the matrix runs), `skip-satisfied` (the reusable workflow is called with
`admitted: false`, every lane reports `skipped`, the ruleset is satisfied), `hold` (the caller
job is skipped, the contexts stay "Expected", the PR is merge-blocked until admitted). The
verdict, its sources and the docs-only flag are data (`HeavyAdmission`), never a scatter of
`if:` strings.

*Amendment (2026-09-16, probe #1164):* `skip-satisfied` is not a job-level skip. A matrix job
skipped by `if:` is never expanded; GitHub reports a single `Heavy / matrix.name: skipped`
context and the required per-lane contexts stay "Expected", so the docs-only PR was `BLOCKED`.
The mechanism is instead: the verify job always runs, `runs-on` switches to `ubuntu-24.04` when
`admitted` is false, and `lane-gate` skips every lane step, so each `Heavy / <lane>` context
expands and passes without work. `hold` is unchanged (the caller job is skipped on purpose so
no context exists). Every "lanes report skipped" phrase in the packet, skill, runbook and the
settle detail now reads "lanes pass without work".

**Ruling 51 (B8-2) — the label `ready-for-heavy` is the only pull-request admission source.**
`HeavyAdmissionSource = label | merge-group | main-push`. `draft == false` never admits (it is
the status quo), `ready_for_review` is not a source (unobservable from `gh pr view`, so the
monitor and CI would disagree), and no comment command exists. `check.yml` adds only `labeled`
to the default `pull_request` types. A code PR without the label holds; the agent applies the
label once tier 1 is green, and `--until-ready` prints the exact `gh pr edit` command.

**Ruling 52 (B8-3) — docs-only is the `goals_only` precedent widened, decided before the
call.** A diff is docs-only when every merge-base path matches the `ci-change-profile.sh`
packet-prose pattern, `docs/**`, `explorations/**`, `research/**`, `.changeset/*.md`, or
`*.md` anywhere; executables, fixtures and data under `goals/**` remain code-bearing. Docs-only
without the label yields `skip-satisfied`; the label always wins. The classification is one
exported RegExp used by the `ci admission` step and by the monitor, so both see the same
verdict for the same head.

**Ruling 53 (B8-4) — two PRs, the input first.** PR A adds the `workflow_call` input
`admitted` (default `true`) and `if: inputs.admitted` on the `verify` matrix job in
`heavy.yml`, nothing else; it is proven only after it reaches `main` because the heavy runner
group admits main-ref workflows only. PR B (after PR A merges) adds the `Heavy Admission` job,
the `needs`/`if`/`with` wiring, the settle amendment, docs and the label. The docs-only
acceptance probe is the first docs-only PR after PR B (the B9 capture); if skipped matrix legs
do not carry the `Heavy / <lane>` names, the fallback is a `runs-on` switch to `ubuntu-24.04`
with the step gate honouring `!inputs.admitted`, never a required-check change.

**Ruling 54 (B8-5) — `heavy-not-admitted` is a named, non-terminal wait.** `YeetSettleReason`
gains `heavy-not-admitted`; `YeetSettleInput` gains `families` (`YeetGatedContextFamily`:
prefix, admitting label, members folded from the ruleset's expected contexts) and an optional
`admission`. Under `hold`, gated contexts leave `missing`/`pending` for a `gated` census bucket;
the reason order is `registration`, `required-pending` (non-gated work open),
`heavy-not-admitted` (only gated work open). A head is held only when the verdict is `hold`,
gated contexts are open, at least one check has registered, **and nothing non-gated is missing
or pending** (review rounds 1–2): held ⇔ the reason would be `heavy-not-admitted`. With no
`Heavy / *` context in the ruleset, after a failed ruleset read, with nothing registered, or
with an unregistered required context, an unlabelled PR still times out as B7 does, so the label
never masks an unrelated never-registering context. `settle-timeout` is unreachable while
held and the loop resets its settle clock when the verdict changes. `run` restores B7 exactly;
`skip-satisfied` settles on the reported `skip` outcomes. The gate line names the gated
contexts and the admitting command. Exit codes are unchanged.

**Ruling 55 (B8-6) — the monitor computes admission from the same function as CI.** The
loop builds `HeavyAdmissionEvent` from `gh pr view` labels and draft plus a once-per-head
merge-base `git diff --name-only`, re-evaluates it every poll (labels change without a push),
and streams `settle-changed` on a verdict flip. `YeetStatusRemote` gains `labels`.

**Ruling 56 (B8-7) — merge queue is B9, captured not scheduled.** GitHub merge queue
(`merge_group`, `checks_requested`, a `merge_queue` ruleset rule) is the mechanism that moves
Benjamin's authority from "merge" to "enqueue"; it needs the `merge_group` trigger on every
required workflow, a flake budget (an ejected PR rebuilds the queue behind it), a merge-group
tail in `--until-ready`, and an `/explore` grill first. B8 only reserves the `merge-group`
admission source and never substitutes a global `concurrency` group (one pending slot, no FIFO).

**Ruling 57 (B8-8) — capacity is the operator's lever.** Throughput is heavy duration times
queue depth under any admission design; pool sizing (`runners_maximum_count`, spot vs
on-demand, `docs/runbooks/ci-runner-reliability.md`) is recorded as an operator decision and is
not changed by B8.

Amendment, live acceptance (2026-09-16), rulings 54 and 55: a head whose base moved under it
(`mergeable: CONFLICTING` / `mergeStateStatus: DIRTY`) reports `settle: base-conflict; merge
origin/main and push` — unsettled, never terminal, never spending the budget — because GitHub
empties the check rollup of a conflicting PR and the registration budget would otherwise turn
that into `settle-timeout` (observed twice on #1155 when B7 merged). Both loops also remember
every context seen registered for a head and keep an absent one `pending` rather than
regressing it to `missing` on a single empty poll. Exit codes unchanged.

## 2026-09-16 — C3 Labs lane digest, round 17 (one ruling, proposed by the orchestrator, ratified by merge of the C3 Labs PR; numbered after B8's 50–57)

Context: the PLAN Labs note (2026-09-03, PR #989) recorded the blocker "three task-hash sets rather
than one declared action". C3.6 (PR #1102) has since folded any set of bare task names from a
lane's own run summaries into one `TurboLaneDigest`, and hands a wrapper lane's digest to its
parent through `BEEP_TURBO_LANE_LEDGER`. A dry run of the labs invocation (`turbo run check lint
test --filter=./apps/labs/**`) plans 91 tasks: the 15 lab tasks (five labs times `check`, `lint`
and `test`) and 76 upstream `build` and `transit` tasks. No upstream package contributes a
`check`, `lint` or `test` row. The local battery dispatched `ci lane labs` with no flags while
check.yml runs `ci lane labs --summarize`, so no local labs run wrote a summary or declared a
digest.

**Ruling 58 (C3-Labs) — the labs lane keeps its one bundled Turbo invocation, and its input digest
is the fold of every `check`, `lint` and `test` task hash its own summary ran, which the labs
filter makes exactly the lab tasks today.** The fold keys on what ran, not on package identity: a
foreign task the filter pulled in would gate the lane, so its hash belongs in the key rather than
being dropped (a test plants one). Upstream build and transit work enters through Turbo's
dependency hashing, never as digest rows. Local
dispatch replays the hosted `--summarize`, and every descriptor that accepts `--summarize` replays
it locally (a test over all descriptors pins this). The check.yml pull-request path gate, the
push-runs-everything rule and the permanently non-required context are unchanged. A run with zero
labs selects no rows, declares no digest, stays green and reports as non-reusable. Labs stays
outside the pre-push wave, so the digest has no reuse consumer until C4 shadow mode or a
separately recorded hosted-reuse decision. Rejected: three labs lanes (three hosted setups for a
non-required lane whose single context lab-apps-lifecycle row 10 ratified); an empty-set digest
for zero labs (a reusable proof of nothing).

Live acceptance (2026-09-16), ruling 58: `bun run beep ci local --lanes labs` dispatched
`bun run beep ci lane labs --summarize`, ran 53 Turbo tasks green in 35 s, and recorded lane run
`labs` with input digest `de139ae3…`. Recomputing SHA-256 over the sorted `taskId=hash` lines of
the 15 `check`/`lint`/`test` rows in that run's summary reproduces the same digest; the 38
upstream rows are absent from it.

## 2026-09-16 — C4a legacy proof stores, round 18 (two rulings, proposed by the orchestrator, ratified by merge of the C4a PR; numbered after C3 Labs' 58)

Context: PLAN C4a names two legacy proof stores that must never become ProofFact sources. A read
of main at `f6b40bb8e0` found them in different states. Store 1, the `YeetLaneProofState` rows in
`YeetRunState.laneProofs`, is written to each run's `state.json` by `writeVerifiedState` at three
Handler call sites and has no reader: `loadVerifiedState` decodes the state, and nothing reads the
`laneProofs` field. Store 2, the `LaneProofRecord` rows in `.beep/yeet/lane-proofs.json`, is a live
exact-match reuse path. `Quality/Tasks.ts` prepares a session, checks `hasReusableLaneProof` and
persists records, and the Yeet planner sets `BEEP_YEET_LANE_PROOF_MODE=active` for every Yeet run.
`ProofLedger` has no production consumer yet, and neither `ProofLedger.ts` nor `ProofFact.ts`
imports either store. SPEC's C1 paragraph still called store 1 "the migration source", which the
PLAN C4a wording ("never migrate them") had already overruled.

**Ruling 59 (C4a-1) — store 1 retires now, with no migration.** `YeetLaneProofState`, the
`laneProofs` field and its per-step builder are deleted, and `writeVerifiedState` keeps writing
only the run-level proof state its readers use. State files written before this change still
decode, because Effect Schema ignores excess keys by default; a test loads a legacy file carrying a
`laneProofs` row and asserts the decoded state has no such property. The receipt lives in
`research/OPPORTUNITIES.md`. Rejected: waiting for C4 (a store with no reader has no reader to keep
working) and migrating the rows into the ledger (they carry no per-lane input digest, env profile,
epoch or provenance).

**Ruling 60 (C4a-2) — store 2 keeps serving exact-match reuse until C4 enforcement replaces it,
and it is never a fact source.** `LaneProofReuse` and `lane-proofs.json` stay live, because
removing them now would regress the pre-push wave with nothing to take their place. C4 enforcement
removes them in the same PR that turns ledger reuse on, with a retirement receipt; the PLAN C4 item
carries that obligation. A test keeps `ProofLedger.ts` and `ProofFact.ts` free of imports from
`ProofState.ts` and `LaneProofReuse.ts`, so C4's shadow wiring can only read the ledger. SPEC's C1
paragraph now says the legacy stores are retired, not migrated. Rejected: deleting store 2 before
C4 (it drops a working reuse path) and a shadow comparison against store 2 (its whole-tree identity
is not the per-lane key that C4 must prove).


## 2026-09-21 — C4 shadow mode, round 19 (four rulings, proposed by the orchestrator, ratified by merge of the C4 shadow PR; numbered after C4a's 59–60)

Context: PLAN C4 is "shadow mode with a disagreement report", then enforcement once ruling 7's bar
is met. A read of main at `3b8a17d850` found the ledger (C2) with no production consumer, the
reuse key typed with the top-level `CiLaneId` vocabulary, and the shadow row carrying only an
attempt id. The inner-lane reports the pre-push and merged-preview wrappers write (A5) carry
wave-qualified lane ids (`quality:coverage`, `cheap-gates:tsgo-rules`, `repo-sanity:sherif`),
the Turbo input digest when the lane declared one, the command line, duration and outcome; the
attempt-started row carries attempt and run ids, branch, head, tier, stage and env profile. That
is every field the reuse key and the enforcement bar need, all in hand in one place: the verdict
writer.

**Ruling 61 (C4-1) — the reuse key's lane id is the wave-qualified GitHub-check lane id.**
`ProofInputDigest.laneId` widens from `CiLaneId` to a non-empty string, because the lanes that
actually run inside the local waves are `quality:*`, `cheap-gates:*`, `repo-sanity:*` and
`fallow:*` ids, one per command (ruling 28), and the top-level `CiLaneId` set names neither the
wave nor the sub-lanes. `laneClass` is `cli-runnable` for every locally journaled lane by
construction. Rejected: mapping inner ids back onto `CiLaneId` (loses the wave and cannot name
`cheap-gates:effect-imports`) and adding the wave as a separate key field (the id already carries
it; two fields to keep honest).

**Ruling 62 (C4-2) — shadow rows carry the sample facts the enforcement bar counts.**
`ProofLedgerShadowRow` gains `laneId`, `branch`, `stage`, `envProfile` and `durationMs`, so
ruling 7's "at least 200 attempts across at least 10 distinct branches with zero disagreements"
is computable from the ledger alone, per stage and profile, and the would-have-saved time is the
sum of hit durations. No production writer existed before this PR, so the fields are required
with no compatibility shim. Rejected: joining attempt ids to the branch-scoped attempt journals
(a scan over every branch's journal for a per-checkout report).

**Ruling 63 (C4-3) — shadow wiring lives in the verdict writer, is always on, and never fails an
attempt.** After the durable inner-lane reports are read, every lane that ran to `passed` or
`failed` with a command line is shadowed in report order: derive the key (lane id, SHA-256 of the
command line, attempt env profile, the report's input digest or the `undeclared` sentinel with
`inputSource: "undeclared"`, epoch digest collected once per attempt), look the key up, append
the shadow row next to the observed outcome, then append the lane's own fact (passed or failed,
30-day expiry, provenance from the attempt row). Lookup precedes record so a lane never hits the
fact it is writing. Reused and skipped lanes carry no evidence and are not recorded. Both the
pre-push and merged-preview stages record, which is the evidence base for the second pair
(ruling 2); their env profiles differ, so shadow cannot cross them. A ledger fault logs
`proof shadow skipped` and the verdict proceeds. The changed-package tripwire stays unwired in
shadow (`constFalse`); C5 wires it with its must-fail fixture, and until then a tripwire-worthy
lane whose digest missed the change would surface as a disagreement, which is the signal wanted.
Rejected: wiring inside `Quality/Tasks.ts` (it has neither attempt identity nor the epoch, and
ruling 60 keeps the ledger away from the legacy store that lives there); an env-var mode switch
(shadow is observation; there is nothing to turn off); shadowing the pre-push stage only (drops
the second pair's evidence for free).

**Ruling 64 (C4-4) — the disagreement report is `bun run beep yeet proof-report`.** It reads the
checkout ledger and prints shadow rows, distinct attempts and branches, would-reuse hits and the
passed-lane minutes they represent, misses by reason, each disagreement (lane, branch, stage,
attempt, time), fact and expiry counts, malformed rows, and the enforcement verdict against the
ratified bar (`attempts 12/200, branches 2/10, disagreements 0/0`). `--json` prints the same as
`proof-shadow-report/v1`. Enforcement is a later PR gated on this report reading `ready`; that PR
also deletes `LaneProofReuse` and `lane-proofs.json` (ruling 60). Rejected: a section in `yeet
status` (status is per-branch; the sample is per-checkout) and waiting for A3's economics
surface (A3 prints the report at closeout; the bar must be readable every day before that).

## 2026-09-22 — reviewer follow-ups as a merge gate, round 20 (three rulings, proposed by the orchestrator, locked by Benjamin in the 2026-09-22 grill and ratified by merge of this PR; numbered after C4 shadow's 61–64)

Context: babysitting PR #1184 found three threads the author had resolved that CodeRabbit had
commented on afterwards — two confirmations and one "verification inconclusive" that needed an
answer. Nothing surfaced them. `Status.ts` counted only `isResolved === false` threads and read
each thread's opening comment; the closeout collector fetched the full comment chain and used only
the first node; `Reply.ts` settled every resolved thread as `stale` and posted nothing. The
follow-ups were found by dumping each thread's comments by hand. Separately, the monitor's comment
stream had printed those replies live, but the stream is in-memory: a reboot killed it and no later
read-first surface replayed what was missed. The status thread query was also capped at one page of
100 threads behind a `"additional review threads omitted after the first 100"` sentinel, so on a
large PR the counts the gate reads were not counts of the PR.

**Ruling 65 (FU-1) — a review thread's obligation is a four-state union derived from structure, and
a bot's last word is an acknowledgement, not a follow-up.** `ReviewThreadState.ts` is pure and
schema-first: `ThreadUnresolved`, `ThreadResolvedAnswered`, `ThreadResolvedFollowUp` and
`ThreadResolvedAcknowledged` fold into `YeetReviewThreadState` through `S.toTaggedUnion("state")`,
and `deriveYeetReviewThreadState` decides between them from `isResolved`, `resolvedBy`, the PR
author, and the newest comment's author login and `__typename` — never from comment text. Its input
class carries no comment body at all, so no later rule can start reading one. Unknown resolves to
`resolved-answered`: when the PR author or the resolver is absent, or the newest comment is
unknowable because the thread has a further comment page the caller did not fetch, the thread does
not block, matching the "unknown is not a named blocker" doctrine already stated at
`Status.ts threadsAreResolved`. `resolved-acknowledged` (`authorKind === "bot"`) is printed and
counted but never gates. Outstanding is exactly `unresolved || resolved-follow-up`, exported once as
`yeetReviewThreadStateOutstanding` and consumed by status, watch, reply, the handler assert and
closeout, so no surface keeps a private opinion. Rejected: reading comment bodies for "LGTM"-style
heuristics (prose is not a contract); treating the thread opener as the obligation (the opener is
what was already answered); exempting bot-token comments wholesale (a bot that asks a question is
still a question); and a ninth `merge-ready` criterion (a follow-up is the same obligation as an
unresolved thread and belongs in the same criterion).

**Ruling 66 (FU-2) — `threads-resolved` widens to cover follow-ups, every live surface agrees with
it, and the status thread read is paginated.** `merge-ready`'s `threads-resolved` criterion is
`unresolved + follow-up === 0` with the closeout artifact's own issue count unchanged;
`followUpThreadCount` counts only `resolved-follow-up`, and new `acknowledgedThreadCount` /
`acknowledgedThreads` fields carry the advisory kind in the same optional/Option style the existing
thread fields use. `nextCommandForRemote` routes to `bun run beep yeet reply` only when
`threads-resolved` fails, live thread counts are non-zero, and *every other* merge-ready criterion
holds — `failing` names the first blocker in protocol order, and threads lead the checks, so reading
it alone sent the operator to answer reviewers on a branch with a red pipeline. It still routes to
closeout when the failure is carried only by the artifact's issue count. `WatchMode`'s thread query grows the
same fields, `YeetWatchThread` carries the state tag instead of an `isResolved` boolean, and
`YeetThreadTransition.to` gains `follow-up` and `acknowledged` targets — so the gate closing on a
thread that stays resolved is now a visible transition rather than silence.
`assertNoUnresolvedReviewThreads` asserts on the two counts rather than on an id list, because a
count without triage rows used to wave a PR through. Closeout's own thread query grows the same
`latest: comments(last: 1)` selection Status, Reply and WatchMode already carry, and its newest-
comment read prefers that node, falling back to the last node of the first comment page only while
GitHub says that page is the whole chain: a resolved thread with more than a hundred comments used
to classify as answered whatever a reviewer had said since. The status thread query became a cursor
loop and the omission sentinel is deleted: a page claiming a successor with no end cursor now fails
loudly instead of being rounded down to "100". Rejected: leaving the sentinel with a widened gate
(a gate reading a truncated population is worse than no gate) and a separate follow-up criterion in
`merge-ready`.

**Ruling 67 (FU-3) — read-first surfaces replay the durable comment stream, and review bodies are
parsed for structural markers only and never gate.** `replayYeetMonitorComments` is called by
`runStatusMode` (when `--remote` resolved a PR number), by `runCloseoutMode`, and by the first cycle
of `runYeetMonitorUntilMerged` through a seam on its options — never inside `collectYeetStatus`,
which stays observational. The watermark becomes `yeet-monitor-comments/v2` with a third
`reviewBody` cursor; a v1 record still decodes and seeds `reviewBody` from the *earlier* of its two
cursors, because the later one would skip every review body submitted in between. Writes are
monotone under `commentCursorOrder`, so two surfaces holding the same PR open cannot drag a cursor
back over rows the other already printed. A truncated fetch is salvaged rather than failed: the
intact prefix is decoded and the cursor advances only to the rows actually decoded. A failed read
prints `comment replay unavailable: …` and leaves the cursor untouched — a closeout must not exit
non-zero because GitHub blinked while it was printing old comments. Review bodies join the stream as
a third member and are parsed by `ReviewBodySignal.ts` for markers only: CodeRabbit's
`Actionable comments posted: N`, its nitpick/outside-diff `<summary>` counts and its fix-prompt
path/line items; Greptile's confidence and its new findings, read as the *maximum* per severity of its
`P0:n P1:n P2:n` triplet and the `N×Pk` items after `**NEW:**` — never their sum, because the two
notations are two readings of one round, and never the triplet alone, because a body can print a
stale zeroed tally above a listed finding. A Greptile-format body is detected by a named marker —
an author login containing `greptile`, a *line-anchored* heading or bolded line naming Greptile, or
the tokens `Greptile-format`/`Greptile-style` — or by the structural fallback of a confidence
fraction plus a triplet or `**NEW:**` marker, which the real r8 body on PR #1184 needs because it
names no tool at all. The word in running prose is not a marker: a body-wide `greptile` test read an
operator's aside ("greptile scored this 5/5") as a review. Advisories
subtract body findings that already opened an inline thread at the same location, and closeout reads
only the newest body per author so an older round is superseded rather than summed. The
`review-advisories` gate row is always `passed`. Rejected: replaying inside `collectYeetStatus`
(status would stop being observational); a schema-version bump on `PrCloseoutReport` for the three
new counts (`S.withConstructorDefault` + `S.withDecodingDefault` at 0 lets a legacy report decode as
"knew about none of them"); parsing finding prose out of review bodies; and letting any advisory
count block a merge.

## 2026-09-24 — C5 changed-package tripwire, round 21 (rulings 68–70, proposed by the orchestrator in the 2026-09-23 grill draft, implemented under the 2026-09-24 autonomous goal run; Benjamin's merge of this PR is the lock)

Context: PLAN C5 owes the half of ruling 63 that C4 deferred — "the changed-package tripwire stays
unwired in shadow (`constFalse`); C5 wires it with its must-fail fixture". The ledger's seam was
already there (`ProofChangedPackageTripwire = (key: ProofInputDigest) => boolean`, applied before
any fact is read, with the miss reason `changed-package-tripwire` already counted by the report);
what was missing were the two facts the predicate needs. Neither was reachable. Local lanes are
repo-wide ids (`quality:coverage`, `cheap-gates:effect-imports`) that name no package, so the only
record of a lane's package scope anywhere was `TurboLaneDigest.tasks[].taskId` (`@beep/x#check`),
and `resolveLaneInputDigest` folded that to the digest string and dropped the task list before the
lane report was written. On the other side, `readYeetChangedPaths` and
`PackageVerify.workspaceForFile` both existed but were composed nowhere the verdict writer could
reach. These three rulings put both facts in hand at the seam ruling 63 placed the shadow pass.

**Ruling 68 (C5-1) — a lane's package scope is observation data on the lane run, not part of the
reuse key.** `QualityTaskLaneRun` gains `inputPackages: ReadonlyArray<string>` (sorted, deduped
package names derived from the Turbo lane ledger's task ids; empty when the lane had no Turbo
ledger, i.e. the same lanes whose `inputSource` is `undeclared`). `quality-task-lane-run/v1` keeps
its version: the key is optional with an empty default, so older reports still decode. The reuse
key (`ProofInputDigest`, `proof-fact/v1`) is unchanged: the packages are derived from the same
task hashes the digest already folds, so putting them in the key adds no identity and would force a
fact-schema bump for a field the tripwire reads once per lookup. Rejected: a `packages` field on
`ProofInputDigest` (schema bump, redundant identity); deriving scope from the lane id (repo-wide
ids name no package); a root-task rule (see ruling 70).

**Ruling 69 (C5-2) — the change is the branch's diff against its base plus the dirty tree, mapped
to workspaces.** The shadow pass receives the attempt's changed package set computed once per
attempt in the verdict writer: `git diff --name-only <base>...HEAD` unioned with the working-tree
snapshot the attempt verified — every staged, unstaged and untracked path, read once from the same
checkout snapshot as the committed diff, so a path the attempt ran against cannot fall out of the
set between collection and mapping — each path mapped to the deepest workspace containing it
(`workspaceForFile`, hoisted from `PackageVerify` into a shared helper); paths under no workspace
(root config, `goals/`, `docs/`) contribute nothing, because root config is already the epoch
(ruling 4) and docs are not package source. PR scope rather than the attempt-to-attempt delta on
purpose: the tripwire is the guard for a digest that missed an undeclared input, and the wider set
is the conservative one while the first pair is still in shadow; narrowing to the delta is a
later, separately fixtured change once the first pair is enforced. Rejected: attempt-delta scope
now (fewer forced misses, but the ratified sample would then measure a narrower guard than the one
enforcement ships with); mapping by `package.json` name lookup per path at lookup time (per-key
filesystem reads inside the ledger; ruling 63 keeps graph policy out of storage).

**Ruling 70 (C5-3) — the tripwire fires when the lane's package scope intersects the changed set;
root-task lanes and undeclared lanes are outside it.** `changedPackageTripwire(key)` closes over
`{ laneId → inputPackages }` from the attempt's own reports and the ruling-69 changed set, and
returns true when the intersection is non-empty. A lane whose only Turbo tasks are root tasks
(`//#lint:policy`) has an empty package scope and is decided by its digest alone (its hash already
spans every input Turbo declares for the root task); an undeclared lane is already refused as
`undeclared-inputs` before the tripwire runs. The tripwire stays in the verdict writer's shadow
pass (ruling 63's placement) and never fails an attempt. The must-fail fixture: attempt 1 records a
passed fact for a lane scoped to `@beep/x`; attempt 2 with the same digest and `@beep/x` in the
changed set must record `changed-package-tripwire` and would-reuse 0; a control attempt with
`@beep/y` changed must hit. Rejected: firing on any changed package for every lane (repo-wide lanes
would never reuse across any package change, which is ruling 1's "any edit anywhere invalidates
every lane" defect by another door); a lane-id allowlist of "package lanes" (a second table to keep
honest against the lane specs).

## 2026-09-25 — pr-event-awareness amendments, round 22 (no new rulings; five amendments recorded inline under rulings 39, 41, 42, 46 and 48, proposed by the orchestrator in the 2026-09-25 pr-event-awareness grill-with-docs round, ratified by merge of that packet's producer PR)

Context: `explorations/pr-event-awareness` (`DECISIONS.md` D16–D27) extends `yeet monitor
--until-ready` into the durable PR-event producer that B7 left as one P1 row: reds and conflicts
stop being terminal under `--until-ready`, `yeet job wait` returns on a wave, two allowlist names
are forwarded, and the idle-wake spike is superseded. The rulings it touches are amended in place
above rather than renumbered; the exit-code table change lands with that packet's producer slice.
