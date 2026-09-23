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
