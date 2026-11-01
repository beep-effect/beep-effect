# Hold Ledger Spec

## Objective

Record every dependency-shaped temporary decision in the repo as a
probe-backed **hold**: a `HoldProposition` inside the `@beep/epistemics` claim
envelope. Keep the holds in an append-only, schema-checked ledger in the repo,
and derive the configs that enforce them from that ledger. Re-check holds
mechanically, in `beep holds probe` and before `deps:update` bumps, and allow
renewal only with fresh evidence. Graduated from
[`explorations/expiring-repo-facts`](../../explorations/expiring-repo-facts/README.md);
its [`BRIEF.md`](../../explorations/expiring-repo-facts/BRIEF.md) and
[`DECISIONS.md`](../../explorations/expiring-repo-facts/DECISIONS.md) are the
design record.

## Non-Goals

- Test skips, `@ts-expect-error`, `biome-ignore` and fallow suppressions. Test
  skips are a gated wave 2 in the exploration `MAP.md`; covering the rest
  would grow the inventory, against S31.
- A GitHub-issue or database ledger of record. Issues are only a regenerable
  projection.
- The wake service, daemon or dispatcher. Those belong to
  [`goals/wake-service`](../wake-service/README.md).
- Automatic merges outside the normal yeet gate.
- Any new paid service, endpoint or quota purchase.

## Source Hierarchy

1. The operator request captured in
   `explorations/expiring-repo-facts/CAPTURE.md`.
2. `AGENTS.md`, `CLAUDE.md`, and the schema-first and effect-first skills.
3. `standards/ARCHITECTURE.md` and
   `standards/architecture/07-non-slice-families.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. The exploration packet, `research/`, `ops/` and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/` — a new `Holds` command group with
  `admit`, `probe`, `why` and `lint` (with `--write`), plus the
  `HoldProposition` schema.
- The ledger files: an append-only claims file plus single-writer ledger,
  following `research/README.md`. Choose the location and record it in the
  Decision Log.
- `syncpack.config.ts` — the held group's `dependencies` derived from the
  ledger.
- Root `package.json` — the `deps:update` script runs due probes first.
- `osv-scanner.toml` and the root `overrides` and `patchedDependencies`:
  record anchors now; rendering them from the ledger is allowed.
- `goals/repository-simplification-residue/history/receipts/hold-register.md`
  — superseded by the ledger, with a pointer.
- A skill or runbook explaining how agents admit, probe and renew holds.

## Constraints

- **Schema.** `HoldProposition` is schema-first: a LiteralKit kind, a
  `Scripted | Judgement` tagged-union falsifier, and an
  `Unpin | Rewrite | EscalateToGoal` tagged-union exit action. It is
  instantiated with `makeClaimEnvelope`.
- **Envelope fields.** `validTime` is the lease. A renewal is a new claim
  version that `supersedes` the previous one, so the renewal count is derived.
  `supportedBy` holds dated probe runs with commit SHAs.
- **Probe trust.**
  - Every Scripted probe runs a control at the known-bad version, which must
    reproduce the recorded failure signature. If it doesn't, the verdict is
    `ProbeBroken`: it escalates and never unpins.
  - The probe pins its runtime (for example `vitest --bun`).
  - A flip needs two consecutive passing candidate runs.
- **Catalogs.** Probes resolve Bun `catalog:` references themselves.
- **Lockstep families.** `@lexical/**`, and pairs like tsgo with tsrs, are
  single holds with group subjects and group probes.
- **Lifetime.** The default maximum is 180 days from creation, after which the
  exit action is `EscalateToGoal` whatever the probe says. Due-soon opens at
  two-thirds of the lease, with jitter.
- **Judgement holds.** A Judgement hold renews only with a diff-bound verdict
  from the `qa.judge` pin.
- **Completeness.** `beep holds lint` fails on a hold-shaped config entry with
  no live record, and on a record whose anchors are gone. `--write`
  tombstones an orphaned record. A re-introduced hold cites its tombstone.
- **Scratch installs.** These go under `~/.cache/beep/`, never `/tmp`, and
  never install into the main checkout.
- **Public repo.** Probe output in the ledger contains no secrets, home paths
  or client data.

## Acceptance Criteria

- [x] The `HoldProposition` schema exists with the fields and tagged unions
      above, plus unit tests for the verdict rules (a passing control gives
      `ProbeBroken`; one passing run is not a flip; two are).
- [x] The statelyai hold record runs end to end through
      `beep holds probe statelyai-model-testing-404`. It reproduces the
      `@statelyai/model-testing` 404 at 0.15.0 with `bun install` and reports
      a verdict for npm latest. (Changed from the jsdom hold on 2026-10-31; see
      the Decision Log.)
- [x] syncpack's held list is derived from the ledger, and `syncpack lint`
      passes with an identical ignore set before and after.
- [x] Every row in the manual hold register and every dependency-shaped site
      (held group, exact pins including `statelyai`, overrides, patches, OSV
      exceptions) has a live record with an exit condition. The register file
      points to the ledger.
- [x] `beep holds lint` runs in the cheap gate and fails on an unrecorded
      hold-shaped entry and on an orphaned record.
- [ ] `bun run deps:update` runs due probes first, and unpins and tombstones a
      flipped hold in the same commit. A fixture test covers a flipped hold
      and a held one.
- [ ] `beep holds why <pkg>` prints live and tombstoned records with their
      evidence.
- [ ] Agent guidance (a skill or runbook) documents admit, probe, renew and
      escalate.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/hold-ledger/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/hold-ledger/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/hold-ledger` | Passes |
| Package handoff | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Holds lint | `bun run beep holds lint # this goal creates the command` | Passes on the PR head |
| statelyai probe receipt | `bun run beep holds probe statelyai-model-testing-404 # this goal creates the command` output, attached in `history/` | Control reproduces the signature |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-31 | `HoldAnchor` is a tagged union of typed config sites (`CatalogEntry`, `ManifestDependency`, `SyncpackHeld`, `SyncpackVersionGroup`, `RootOverride`, `PatchedDependency`, `OsvPackageOverride`). The single slice-1 statelyai row was rewritten in place to the typed form, keeping its id so its two probe runs stay bound. | Free-text `{file, key}` anchors could not be linted, and the slice-1 key (`workspaces.catalog.statelyai`) was already wrong: the catalog is top-level. No consumer read the ledger between the two slices. | Restore the `{file, key}` struct and the slice-1 line from git. |
| 2026-10-31 | A live hold is a ledger row that no later row names in `supersedes`, that is not `Retracted` and whose knowledge interval is open. A tombstone is a superseding row with `review: Retracted`. | Slice 1 filtered on `knowledge.expiredAt`, which an append-only file never sets on the row a renewal replaces, so a renewal would have left two current versions. | Revert `liveHoldVersions` to the `expiredAt` filter. |
| 2026-10-31 | Required sites are root overrides, patched dependencies and OSV package overrides; catalog entries, manifest dependencies and syncpack version-group labels are anchor-only. Exact catalog pins are not enumerated. | The catalog pins every version exactly as policy, so an exact pin is hold-shaped only when it is also held from `deps:update`; those holds carry a `SyncpackHeld` anchor. | Add a site kind to `HoldSites.snapshot` and its lint rule. |
| 2026-10-31 | syncpack reads `hold-ledger/syncpack-held.generated.json` (written by `beep holds lint --write`, excluded from Biome like the fallow boundaries file) and omits the held group when the list is empty. | An empty `dependencies` array makes syncpack match every dependency; the control run with `[]` held back the whole catalog. | Inline the list in `syncpack.config.ts` again and drop the projection. |
| 2026-10-31 | The infra TypeScript 6 version group is a hold of kind `version-group`. | The hold register already tracked it as a held pin with an exit (Pulumi supports the TypeScript 7 API). | Drop the kind and the record. |
| 2026-10-31 | The first slice moves from the jsdom hold to the statelyai hold. The jsdom hold is reported as `probe-broken` and goes to its own unpin PR. | Manual probes ([receipt](history/receipts/2026-10-31-first-manual-probes.md)): jsdom's control (30.1.0) no longer reproduces, and repo jsdom suites pass on 30.1.3 under `--bun`. statelyai's control (0.15.0) fails `bun install` deterministically with the recorded 404, and latest (0.19.0) installs. A slice needs a control that reproduces. | Restore the jsdom slice if a later run reproduces its signature again. |
| 2026-10-31 | The ledger lives in a top-level `hold-ledger/` directory: `claims.jsonl` holds append-only `HoldClaimVersion` rows and `runs.jsonl` holds `ProbeRun` rows. | `harness-ledger/` is the precedent for a tracked top-level ledger. A goal packet is temporary; `research/ledger/` belongs to the nightly routine as its single writer. | Move the two files and update the `Holds` paths. |
| 2026-10-31 | A probe run has three outcomes: `Reproduced` (the signature appeared), `Passed` (exit 0, no signature) and `Inconclusive` (anything else). A passing control gives `probe-broken`. A flip needs the two newest runs to both be `candidate-passed`. | An inconclusive run must never count as a pass, the same rule as skulk's "a failed check is never a change". | Change `judgeProbeRun` and `confirmHoldVerdict` and their tests. |
| 2026-10-31 | `@beep/repo-cli` depends on `@beep/epistemics` for the claim envelope. | Tooling may depend on foundation; the envelope is reused, not copied. | Drop the dependency and inline a hold-only version schema. |
| 2026-10-31 | The unit is a hold on `makeClaimEnvelope`; the ledger lives in the repo; wave 1 is dependency-shaped holds; renewal needs evidence plus a 180-day maximum; probes need a control and two passes; the `Holds` command group lives in the repo CLI; `deps:update` re-checks holds; the first slice is jsdom. | Settled in the exploration align and shape rounds, [`DECISIONS.md`](../../explorations/expiring-repo-facts/DECISIONS.md). | Reopen the exploration at `align`. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
