# P4 close brief — the remaining packet work in one PR (2026-09-28)

Operator directive (2026-09-28, `/goal` re-registration): "complete the remaining work in 1 single PR
if possible to save aws & pr queue costs", Opus 5.5 children only. This brief is the contract for
that PR. The merge of the PR is the lock for the rulings below, as it was for rounds 9, 11–14, 16–19,
21, 23 and 24 (`research/decisions.md`). The orchestrator wrote this contract and judges the
evidence; Opus 5.5 lanes implement it.

## Scope

1. **Rulings 71 and 72, implemented.** The shadow sample can accumulate (the ledger's checkout is the
   owning clone) and a disagreement is observable (a red run records its input digest as an
   observation). Both were proposed in `research/c5-must-fail-fixtures-grill.md` §"Proposed ruling
   71/72" and are unchanged in substance; the open concurrent-append question under 71 is settled
   here by measurement and the tolerant reader.
2. **Ruling 80: C4.2 enforcement is carried past close with a recorded flip condition.** Nothing in
   this PR turns proof reuse on. `LaneProofReuse.ts` and `.beep/yeet/lane-proofs.json` stay (ruling
   60 deletes them in the flip PR).
3. **A1 close re-run.** The two script defects recorded on 2026-09-25 in `research/OPPORTUNITIES.md`
   are fixed first (wrapper/inner double count; numbered `-worktrees` roots undiscovered), then the
   close report lands as `research/economics-close.json` + `research/economics-close.md` from
   `research/inputs/close/`, with M1–M5 beside the ratified P0 baseline (`research/baseline.md`).
4. **B9** is recorded as captured (`explorations/github-merge-queue`, PR #1164, ruling 56); its grill
   stays gated on the ship-velocity E8 flip condition and moves with the exploration.
5. **Closeout.** `research/decisions.md` round 25 (rulings 71, 72, 80); PLAN/SPEC/GOAL/README/manifest
   updated; `history/reflections/2026-09-28-claude.md`; lifecycle flipped to `completed-retained` by
   `bun run beep goals set-status time-to-certainty completed-retained`; receipts for every friction hit.

## Laws for every lane

- Effect v4 only; validate every API against the reference checkout (`.repos/effect`, or
  `$HOME/YeeBois/references/effect/effect`); schema first; services via `Context.Service`;
  `effect/HashSet`, `effect/HashMap` (never `Set`/`Map`); generator functions through `Effect.fn` or
  `Effect.fnUntraced`; `LiteralKit` for literal unions; JSDoc with titled `**Example** (Title)` blocks;
  tests import package source through `@beep/*` aliases.
- No new lock, lease or scheduler. Never `git add -A`. Never push and never open a PR: the
  orchestrator commits by name and publishes. The TypeScript CLI never writes
  `research/economics.json`.
- Friction receipts go into `research/OPPORTUNITIES.md` the moment they happen (redact: `~` for the
  home directory, no session or machine ids, minimal error text).
- Attribute every red before repairing it: introduced / inherited / environment-only. Inherited or
  environment-only reds are reported, not fixed here.

## Ruling 71 contract — the proof ledger's checkout is the owning clone

Evidence (unchanged from the draft): `yeet proof-report` read 0 rows in the clones lanes are cut
from; on 2026-09-28 the best reading is 4 attempts on 1 branch (`beep-effect3`), because every lane
keeps a private ledger under its own `.beep/yeet/` and `yeet sweep --retire` deletes it.

Contract:

- `ArtifactPaths.ts`: `proofLedgerPathForCheckout(repoRoot)` resolves the **owning clone** and returns
  `<clone>/.beep/yeet/proof-ledger.ndjson`. Resolution is by the filesystem, mirroring
  `git rev-parse --path-format=absolute --git-common-dir` without spawning git:
  - `<repoRoot>/.git` is a directory → the clone is `repoRoot` (a primary clone; the path is
    unchanged from today, so existing primary-clone ledgers stay valid).
  - `<repoRoot>/.git` is a file `gitdir: <path>` → `gitdir` resolves relative to `repoRoot`; the
    common dir is `<gitdir>/commondir` resolved relative to `gitdir` when that file exists, else
    `gitdir` itself; the clone is `dirname(commonDir)`.
  - No `.git` at all → the clone is `repoRoot` (test roots and non-git directories keep today's
    behaviour).
  Introduce a schema for the resolved location, e.g. `ProofLedgerLocation` (`S.Class`:
  `originRoot` = the checkout that ran, `ledgerRoot` = the clone, `ledgerPath`), and a resolver
  `resolveProofLedgerLocation(repoRoot)`; keep `proofLedgerPathForCheckout` as the path projection.
- `ProofLedger.ts`: `loadProofLedger` / `appendRows` use `ledgerRoot` as the containment root for
  `readContainedFileStringNoFollow` / `appendContainedFileString` (today they pass `repoRoot`, which
  would refuse a path outside the worktree). Facts keep `provenance.originKey = repoRoot` (the
  worktree that ran).
- `ProofShadow.ts`: `loadProofShadowReport` reports the resolved `ledgerPath` (it already prints it).
- Concurrent appends (the draft's open question): keep one append per attempt (ruling 63). Measured
  in `beep-effect3` on 2026-09-28: the largest attempt append is 55,068 bytes (64 rows). `O_APPEND`
  places each `write(2)` atomically at end-of-file; an interleaving would only tear rows if a single
  append were split across syscalls, and the tolerant reader then counts each torn line as
  `malformedRows`, which `proof-report` prints. No lock is added (packet law). Record the measurement
  in the ruling text and in a comment on `appendRows`.
- Tests (`packages/tooling/tool/cli/test/proof-ledger.test.ts`, `proof-shadow.test.ts`, plus
  `artifact-paths` coverage if a test file exists): a primary-clone root (`.git` directory) resolves
  to itself; a linked-worktree root (`.git` file with `gitdir:` pointing at
  `<clone>/.git/worktrees/<name>` and a `commondir` file of `../..`) resolves to the clone; a bare
  tmp root resolves to itself; a fact recorded from a lane is read by a sibling lane's ledger
  (shared sample); `proof-report` from a lane names the clone ledger. Use `it.layer` blocks and the
  effect-vitest rules that `lint:effect-vitest` enforces (no `provideScopedLayer`, `assertSome` over
  `toEqual(O.some(..))`).
- Docs: `.claude/skills/yeet/SKILL.md` and `docs/` wherever `proof-report` or the ledger path is
  described (grep `proof-ledger`, `proof-report`); the module comment on `ProofLedger.ts`.
- Migration: none (rulings 59–60 precedent). Lane ledgers already on disk are not folded.

## Ruling 72 contract — a red run records its input digest, as observation

Evidence (unchanged): `isDisagreement = isHit(decision) && observed !== "passed"` needs a failed lane
with a digest; `turboLaneDigestFromSummary` and `readTurboLaneDigest` fold `None` when any selected
task failed (`taskPassed`), and `resolveLaneInputDigestSource` short-circuits on
`O.isSome(outcome.failure)` to the declared digest (always `None` in production), so every
disagreement counter is structurally zero and ruling 7's `disagreements: 0` bar is vacuous.

Contract:

- `TurboLaneDigest.ts`: `turboLaneDigestFromSummary` and `readTurboLaneDigest` fold the digest
  whenever at least one selected task is present, regardless of task outcome. The digest text is
  `taskId=hash` per row (`digestRows`), so it identifies the work, not the result. A red run that
  stopped early folds only the tasks that ran; that key differs from the full-pass key, so it neither
  serves nor contradicts a pass. Update the module JSDoc (line ~128 "a lane never records a reusable
  digest for a red run") to say a red run's digest is recorded as an observation and is never a reuse
  source.
- `Tasks.ts` `resolveLaneInputDigestSource`: short-circuit only on `O.isSome(declared)`; a failed
  outcome resolves the digest and package scope through the same wrapper-ledger / direct-Turbo path
  as a pass. Rewrite the comment block above `unscopedLaneInputs` (lines ~1922–1933) and the
  matching paragraph in `changedPackageTripwireFor`'s JSDoc (`ProofShadow.ts` ~724–735).
- The wrapper child (`bun run beep ci lane <id>`) declares its digest to the lane ledger on red as
  well; check `appendTurboLaneLedger` / `closeTurboLaneLedger` call sites and the `declared`/`closed`
  row union so a red child still writes a `declared` row.
- Reuse safety is unchanged: `decideExactFact` answers an exact-match failed fact with
  `miss(key, "prior-failed")`; a failed fact is never a reuse source. Confirm `LaneProofReuse.ts`
  (legacy store 2) does not key on `inputDigest` and does not record failed lanes.
- Must-fail fixture for the lock (required): a passed fact recorded for key K, then a failed run that
  resolves the same K through the production path (a Turbo run summary whose selected task has
  `execution.exitCode !== 0` and the same `hash`, or a wrapper lane ledger `declared` row from a red
  child), records exactly one disagreement in `recordProofShadowForAttempt` and in
  `buildProofShadowReport`. Keep the existing arithmetic fixtures; add the production-path one.
- Side effect to state in the ruling: the changed-package tripwire now sees a scope on failed lanes.

## Ruling 80 — C4.2 enforcement carried with a flip condition

Text for `decisions.md`: attempt-to-attempt reuse within pre-push stays off. The flip PR lands when,
in the owning clone, `bun run beep yeet proof-report` reads `enforcement … ready` under ruling 7's bar
(200 attempts, 10 branches, 0 disagreements) with ruling 72 live for the whole counted sample (rows
recorded before this PR's merge do not count toward the bar, because their disagreements were
unobservable), `malformed rows: 0` on the sample, and every C5 fixture green; that PR deletes
`LaneProofReuse.ts` and `lane-proofs.json` with a retirement receipt (ruling 60). Hosted reuse stays a
separate decision behind the parity ledger. Implement the "rows recorded before" clause in
`buildProofShadowReport` only if it is one field (a `since` bound on the bar sample); otherwise state
it as an operator-read condition and do not add machinery.

## A1 close contract (`research/scripts/economics.py`)

Fix first (both are recorded defects, receipt 2026-09-25):

1. `lane_metrics` and every episode's `laneDurationMs` split wrapper lanes from inner lanes: a lane is
   inner when it carries `parentLaneId`; for verdicts written before that field, a lane is a wrapper
   when its id starts with `full:`, `feedback:`, `prepare:`, `publish:`, `monitor:`, `closeout:`,
   `advisory:` or `commit:` (ruling 74's prefix rule). Wrapper rows keep the baseline's row shape and
   semantics; inner rows are a separate population with their own denominator. The first-failure
   walk is unchanged (its wrapper stop is what the baseline measured).
2. `discover_live_roots` also discovers `<projects>/beep-effect*-worktrees/*` lanes (ruling 73), and
   `PROJECTS_ROOT` is derived so the script works from a lane: when `REPO_ROOT.parent.name` ends
   with `-worktrees`, the projects root is its parent; add `--projects-root <dir>` as the explicit
   override.

Then the close run:

- Add a `--run close` mode (name it as you see fit, one flag): inputs under
  `research/inputs/close/` (`live-journals.json.gz`, `hosted-runs.json.gz`, `RECEIPTS.json`), outputs
  `research/economics-close.json` and `research/economics-close.md`. The default mode is the
  ratified baseline and is unchanged. `--capture-live` in close mode reuses the corpus at
  `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run2-fleet`
  (present in the checkout) exactly as the baseline capture did.
- The committed-blob validation (`validate_embedded_inputs`) runs on the close files once they are
  committed; on the first close run use the documented `--allow-input-drift` path only if the
  validation cannot pass before commit, and say so in the receipt. The orchestrator commits the
  inputs, then re-runs the close report so the committed output is ratifiable.
- `economics-close.md` gains a section "Close versus P0 baseline" with the ruling-8 rows (M1 P50/P95
  episode; M2 start offset and completion P50/P95; M3 runs per attempt with max for Test Integration
  and Docgen; M4 as far as post-A5 journals make it computable, else "unmeasurable" with the reason;
  M5 starts without finish and journaled terminations) reading the baseline from
  `research/economics.json`. Every number comes from the script; nothing is typed in by hand.
- Baseline pin (ruling 77): editing the script moves the `reproduction-script` receipt inside
  `research/economics.json`. Re-render the baseline with `python3 …/economics.py --from-inputs`,
  diff `economics.json` and `economics.md` against `origin/main` and confirm only the script receipt
  moved (values, rows, populations unchanged); then update `GATE_ORDER_SOURCE.sha256` in
  `packages/tooling/tool/cli/src/commands/Yeet/internal/WaveOrder.ts`, run
  `bunx vitest run packages/tooling/tool/cli/test/gate-order-handoff.test.ts -u` once (writes
  `research/gate-order-handoff.json`) and once without `-u`, and review the handoff diff (only the
  source reference may change). If any value moved, stop and report: that is a reseed and needs a
  ruling.
- Unit tests: `cd research/scripts && python3 -m unittest test_economics` (17 tests; one fails on
  `origin/main` today — attribute it before touching anything; add tests for the split and the
  discovery). The script must stay Python 3 stdlib only.

## Closeout contract

- `research/decisions.md`: append round 25 "2026-09-28 — P4 close, round 25 (three rulings, proposed
  by the orchestrator; the merge of this PR is the lock)", rulings 71, 72, 80 in the house style
  (bold heading, evidence, rule, rationale, rejected).
- `PLAN.md`: B9 → `[x]` captured (exploration pointer, ruling 56, grill gated on E8, carried by the
  exploration); C4 → `[x]` shadow landed 2026-09-21, rulings 71/72 landed in this PR, enforcement
  carried under ruling 80; C4.2 → `[x]` carried with the flip condition (not enforced); A1 re-run →
  `[x]` with the close numbers; closeout → `[x]` with this PR. Every date absolute.
- `SPEC.md`: dated parentheticals on C4 (rulings 71/72, ruling 80 flip condition) and under
  "Completion gate" one dated note that states which lines are met and which are carried, with the
  operator directive of 2026-09-28 as the authority; do not rewrite gate sentences.
- `GOAL.md`: the Status paragraph becomes the close status (P4 complete, rulings 1–80, what is
  carried); keep the file at or under 4,000 characters (`wc -m`).
- `ops/manifest.json`: `initiative.updated` 2026-09-28, `statusNote` rewritten for close, phases P2
  and P4 `complete`, `completionGate.statement` gains one dated sentence naming the carried line
  (C4.2 flip) and the operator authorization; then run
  `bun run beep goals set-status time-to-certainty completed-retained` (writes manifest status,
  README `Lifecycle:` line and `goals/INDEX.md`). Run `bun run beep goals doctor` after.
- `history/reflections/2026-09-28-claude.md` from `goals/_template/history/reflections/_TEMPLATE.md`
  (`ReflectionFrontmatter`, `bun run beep lint reflection-artifacts`), narrative from the packet's
  receipts and this PR.
- `research/OPPORTUNITIES.md`: receipts hit during this PR.
- Commit message subject cites the packet slug `time-to-certainty`, body lines under 100 characters.

## Verification before publish

```sh
bunx turbo run check --filter=@beep/repo-cli
bunx vitest run packages/tooling/tool/cli/test/proof-ledger.test.ts packages/tooling/tool/cli/test/proof-shadow.test.ts packages/tooling/tool/cli/test/turbo-lane-digest.test.ts packages/tooling/tool/cli/test/quality-tasks.test.ts packages/tooling/tool/cli/test/gate-order-handoff.test.ts
cd goals/time-to-certainty/research/scripts && python3 -m unittest test_economics
bun run beep goals doctor
bun run beep lint reflection-artifacts
test "$(wc -m < goals/time-to-certainty/GOAL.md)" -le 4000
git diff --check -- goals/time-to-certainty
```

Hosted runners prove the rest; the orchestrator publishes with
`bun run beep yeet publish --start-pr-early --monitor --pr --detach` and applies `ready-for-heavy`
once tier 1 is green.
