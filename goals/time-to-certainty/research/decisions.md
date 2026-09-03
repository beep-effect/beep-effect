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
only detector of pid reuse. Pid absent: `owner-dead` now. Pid present: the attempt stays open until
the start is older than the longest plausible attempt (24 hours from the start row's `recordedAt`);
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
