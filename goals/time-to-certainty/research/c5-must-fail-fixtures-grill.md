# C5 must-fail fixtures — grill draft (2026-09-23, proposed by the orchestrator)

Scope: PLAN C5 "must-fail fixtures: changed package, epoch change, cross-profile reuse" and the
half of ruling 63 it owes: "the changed-package tripwire stays unwired in shadow (`constFalse`);
C5 wires it with its must-fail fixture". Rulings 1, 2, 4, 6, 7 and 61–64 bind this note.

## What already holds without a new ruling

Two of the three fixtures need no design: the ledger already refuses both cases at lookup
(`decideRelatedFact` → `epoch-changed`, `profile-mismatch`) and the attempt-level pass inherits
that. This PR adds them as attempt-level must-fail fixtures in `proof-shadow.test.ts`, run through
`recordProofShadowForAttempt` against a temp checkout, so the guarantee is proven at the seam the
enforcement PR will flip, not only at the storage unit:

| Fixture | Setup | Must observe |
| --- | --- | --- |
| epoch change (ruling 4) | attempt 1 records a passed fact; attempt 2 hits; `bun.lock` changes; attempt 3 | shadow rows `no-fact`, `hit`, `epoch-changed`; would-reuse 0 on attempt 3 |
| cross-profile (rulings 1, 2) | merged-preview attempt under `pr-posture` records a passed fact; pre-push attempt under `local` looks up the same key | shadow rows `no-fact`, `profile-mismatch`; would-reuse 0 |

Both are green in the lane at this draft's commit.

## What needs a ruling: the changed-package tripwire (ruling 6)

Ruling 6: any lane for a package whose source the change touches is never served from the ledger,
even when the digests say it could be. The ledger's seam is already there
(`ProofChangedPackageTripwire = (key: ProofInputDigest) => boolean`, applied before any fact is
read, miss reason `changed-package-tripwire`), and the report already counts misses by reason.
What is missing is the two facts the predicate needs, and neither is in the key today:

1. **Which packages a lane verified.** Local lanes are repo-wide ids (`quality:coverage`,
   `cheap-gates:effect-imports`), never per-package. The only record of a lane's package scope is
   the Turbo lane ledger it ran under: `TurboLaneDigest.tasks[].taskId` (`@beep/x#check`). Today
   `resolveLaneInputDigest` folds that to the digest string and the task list is dropped before the
   lane report is written, so the shadow pass never sees it.
2. **Which packages the change touches.** The attempt's changed paths mapped onto workspaces.
   `readYeetChangedPaths` (`git diff --name-only base...HEAD`) and `PackageVerify.workspaceForFile`
   exist but are not composed anywhere the verdict writer can reach.

### Proposed rulings (numbered after 67)

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

## Landing plan (same PR once rulings 68–70 are locked)

1. `Quality.schemas.ts`: `inputPackages` on `QualityTaskLaneRun` (schema first, default empty).
2. `Tasks.ts`: carry `TurboLaneDigest.tasks` through `resolveLaneInputDigest` into the lane run
   (package part of each task id, sorted, deduped; root tasks contribute nothing).
3. Shared helper for path → workspace (hoist `workspaceForFile`); a `changedPackagesForAttempt`
   effect in the Yeet verdict path composing `readYeetChangedPaths` with it.
4. `ProofShadow.ts`: `recordProofShadowForAttempt` takes the changed package set and builds the
   tripwire from the reports; `Handler.ts` passes it.
5. Fixtures: the ruling-70 must-fail fixture plus its control in `proof-shadow.test.ts`; a
   `Tasks.ts` fixture that a lane run carries the package scope of its Turbo tasks.
6. PLAN: tick C5; `proof-report` needs no change (misses by reason already include the tripwire).

C4.2 enforcement stays a later PR gated on `proof-report` reading `ready` with every C5 fixture green
(rulings 7, 64).

## Landing status (2026-09-24)

Rulings 68–70 landed as proposed; the ratification is Benjamin's merge of this PR.

- Ruling 68: `QualityTaskLaneRun.inputPackages` in `Quality.schemas.ts` (empty default for both
  the constructor and a missing key, so a `quality-task-lane-run/v1` report written before the
  field decodes as an empty scope); `turboLaneDigestPackages` in `TurboLaneDigest.ts` reads the
  scope off a digest's own task ids; `resolveLaneInputDigest` in `Tasks.ts` now resolves
  `{ inputDigest, inputPackages }` and every lane-run builder carries it.
- Ruling 69: `workspaceForFile` and a new `changedPackageNamesForPaths` are exported from
  `PackageVerify.ts` and used by both `quality package-verify`'s auto-detect and the Yeet verdict
  writer; `changedPackagesForAttempt` in `ProofShadow.ts` unions `readYeetChangedPathsStrict` with
  one `git status --porcelain=v1 -z --untracked-files=all` snapshot and folds the result into the
  `ProofChangedPackages` tagged union (`known` / `unavailable`). `Settle.ts` gained
  `readYeetChangedPathsStrict` and `readYeetChangedPaths` is now its tolerant wrapper, so the
  tripwire can tell "no paths changed" from "the diff could not be read" while the docs-only
  settle rule keeps its `hold` failure direction unchanged.
- Ruling 70: `changedPackageTripwireFor` builds the predicate from the attempt's own reports;
  `recordProofShadowForAttempt` takes the changed set and passes the tripwire to
  `ProofLedger.make` (`loadProofShadowReport` keeps `constFalse`). `ProofShadowAttemptSummary`
  gained `tripped` and the verdict line ends `; tripwire N`; `Handler.writeRunVerdict` reads the
  changed set once and logs it.
- Fixtures: `proof-shadow.test.ts` carries the ruling-70 must-fail fixture with its control, the
  root-task-only lane, the undeclared-lane ordering, the `unavailable` fail-closed case, the
  `proof-report` miss-by-reason assertion, and the changed-set reader's porcelain, union,
  git-failure and workspace-failure cases; `turbo-lane-digest.test.ts` carries the package-scope
  fixture for both digest paths; `quality-tasks.test.ts` carries the legacy decode.

## Proposed ruling 71 (open — needs Benjamin's lock, NOT implemented): the proof ledger's checkout is the clone, not the worktree

Evidence: `yeet proof-report` reads 0 rows in `beep-effect3` and `beep-effect21` (the clones lanes
are cut from); the best reading anywhere is 9 attempts on 1 branch in a primary clone; every lane
ledger dies with `yeet sweep --retire` (the residue archive keeps git residue, not `.beep/`). Under
the ratified bar (200 attempts, 10 branches) the sample can never accumulate while the ledger path
is `<repoRoot>/.beep/yeet/proof-ledger.ndjson`.

Proposal: `proofLedgerPathForCheckout` resolves `git rev-parse --git-common-dir`'s parent (the
clone) so sibling lanes of one clone share one ledger; facts keep `originKey` = the worktree that
ran them. Open question for the lock: concurrent appends from two lanes — ruling 63's "one append
per attempt" relies on O_APPEND atomicity for a multi-line write, so either measure the largest
attempt append against `PIPE_BUF` or add a per-append rename publish through
`publishJournalTextAtomically`. Machine-wide (across clones) stays the deferred P3 candidate.

## Proposed ruling 72 (open — needs Benjamin's lock, NOT implemented): a red run still records its input digest, as observation, so disagreements are observable

Evidence: a shadow disagreement is `isHit(row.decision) && !isPassed(row.observed)` — the ledger would
have reused a fact and the lane failed when it actually ran. A red lane cannot reach that state.
`turboLaneDigestFromSummary` folds a digest only when every selected task passed or replayed from cache
(`taskPassed` in `TurboLaneDigest.ts`; C3 states it as "a lane never records a reusable digest for a red
run"), and `resolveLaneInputDigestSource` short-circuits on `O.isSome(outcome.failure)` to the declared
digest, which every production lane tuple sets to `O.none()` — `runGithubCheckLane` in `Tasks.ts` and
`ciLocalLaneInputsForTesting` in `CiLane.ts`, whose own doc reads "Ordered lane inputs with absent
executor digests". So a failed lane's key is always `undeclared`, `decideAgainstFacts` refuses it as
`undeclared-inputs` before any fact is read, and `isDisagreement` is unreachable.

The consequence is not cosmetic. Every disagreement counter — the attempt summary's `disagreements`,
`ProofShadowReport.disagreements` and `barDisagreements`, `ProofLedger.disagreements` — is structurally
zero, so ruling 7's `disagreements: 0` criterion in `ProofShadowEnforcementBar.ratified` is satisfied by
construction. The one empirical safety criterion gating C4.2 enforcement cannot fail. The fixtures that
appear to prove detection works (`proof-shadow.test.ts`, the first-attempt case and the
would-reuse-hit-then-failed case) build a failed lane carrying a digest, which production never
produces; they prove the counter arithmetic, not that the guard is live.

Proposal: fold task hashes into the lane digest regardless of task outcome — the Turbo hash is derived
from a task's inputs, not from whether it passed, so it identifies the same work either way — and
resolve the digest and its package scope on the failure branch too instead of short-circuiting past the
lane ledger. The recorded fact keeps `outcome: "failed"`, which is never a reuse source: `decideExactFact`
answers an exact-match failed fact with `miss(key, "prior-failed")` today and would continue to. A
passed fact followed by a red run on the same key then registers as a hit-versus-failed row, and the
changed-package tripwire gains a scope on failed lanes as a side effect.

Must-fail fixture for the lock: a passed fact recorded for key K, then a failed run that resolves the
same K through the ordinary production path, must record exactly one disagreement — replacing the
test-only construction that hands a failed lane a digest by hand.

Rejected: leaving the bar vacuous and enforcing C4.2 on it anyway (a criterion that cannot fail is not
evidence, and ruling 7 asked for evidence); counting `undeclared-inputs` misses as disagreements
(absence of a reusable key is not a contradiction between two runs); recording failed runs as reusable
facts (that would make a red run serve a later lane, which rulings 1 and 4 exist to prevent).

## Open question for ruling 69 (not implemented): root-level lane inputs outside the epoch

Ruling 69 drops every changed path that falls under no workspace, and the justification written into the
code was that "root config is already the epoch". That is narrower than it sounds. The proof epoch is
exactly six inputs (`collectProofEpoch` in `ProofDigest.ts`): `bun.lock`, `.bun-version`, `.nvmrc`,
`turbo.json`, `tsconfig.base.json`, and `packages/tooling/policy-pack/lint-rules/package.json`. Real lane
inputs that live in no workspace and in no epoch component therefore trip nothing at all: the ratchet
baselines and inventories under `standards/*.jsonc`, `biome.json` (and `biome.identity.jsonc`), the
workflow definitions under `.github/workflows/`, and `scripts/`. A change to any of them can alter what a
lane checks while every lane's digest and the epoch both stay put, so a reused proof would be a proof of
the old rules.

Two candidate answers for the lock, neither implemented here:

1. Widen the epoch to cover the standards baselines, the Biome configuration and the workflow files. It
   keeps the tripwire's per-lane scope honest and reuses the mechanism ruling 4 already built, at the cost
   of invalidating every fact on any baseline write — which the ratchets do routinely.
2. Treat any unmapped path that is not under `docs/` or `goals/` as tripping every lane with a non-empty
   scope. It needs no epoch change and fails closed, but it is coarse: one `standards/` write would refuse
   the whole attempt's reuse, which is close to the "any edit anywhere invalidates every lane" defect
   ruling 1 rejected.

Until one is locked, the code says what is true: unmapped paths are outside the tripwire by ruling 69,
six root inputs are covered by the epoch, and the rest is a known gap.
