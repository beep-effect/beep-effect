# Quality Speedup Spec

## Objective

Reduce the wall-clock time between "agent starts work" and "PR is mergeable" in
beep-effect, through three ordered workstreams:

- **A — Remove tstyche (landable change).** Delete the tstyche type-test surface
  (all `*.tst.ts` files, `dtslint/` dirs, configs, CLI code paths, the
  `dtslint-tsgo` quality/CI lane, deps, docs) and measure the saving honestly.
- **B — Quality-time inventory (evidence-first, read-only).** A measured, ranked
  bottleneck report over where quality time actually goes, across this clone,
  the local clone fleet, and hosted CI.
- **C — Instantiation cost and OOM risk (evidence-first, read-only).** A
  repo-wide TypeScript instantiation/memory census using the
  `goals/box-typecheck-cost` method, the mechanisms driving the top offenders,
  and a staged remediation plan — no remediation lands in this packet.

## Non-Goals

- Landing any remediation derived from B or C (that is follow-up work gated on
  review of the reports).
- Replacing Turbo, Biome, Vitest, or the TypeScript toolchain (hard constraint:
  no such proposal without a measured prototype and documented fallback).
- Re-deriving what prior packets already measured
  (`goals/repo-quality-throughput`, `explorations/agent-pipeline-velocity`,
  `goals/coding-agent-effectiveness-evidence-loop`, `goals/box-typecheck-cost`).
- Selling concurrency redistribution as work reduction.

## Source Hierarchy

1. The originating mission prompt (2026-08-03, "Speed Up yeet & other quality
   checks").
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md`, `standards/architecture/00-philosophy.md`.
4. This `SPEC.md`.
5. `PLAN.md`, `GOAL.md`.
6. Supporting `research/`, `ops/`, and `history/` files.

## Target Surfaces

- Workstream A: every tstyche surface inventoried in
  `research/tstyche-inventory.md` (root/`dtslint` configs, `*.tst.ts` files,
  `@beep/repo-cli` CreatePackage/TsconfigSync/Quality/Ci code paths and tests,
  `.github/workflows`, `turbo.json`, `knip.jsonc`, `renovate.json`,
  `_typos.toml`, package manifests, lockfile, docs/skills).
- Workstreams B/C: docs only — `goals/quality-speedup/research/**`.

## Constraints

- **Instrument before treating.** Every measurement instrument is verified
  before its numbers are trusted; no remediation is proposed on an unverified
  metric. Estimates are labeled as estimates.
- Every claim cites a file path, command output, or committed artifact.
- Clone-agnostic: repo-relative paths only in tracked files; fleet-scan output
  is anonymized (`cloneNN` ids, no absolute paths) before commit.
- Census rules carried from `goals/box-typecheck-cost` (binding): `files` does
  not clear inherited `include` (use `"include": []` for per-file probes);
  report marginal cost against the current import floor for per-file numbers;
  do not remove `SchemaUtils.withCodecStatics` / `$I.annoteSchema` (measured
  dead ends); never lead with a file split; record the tsgo/TS version with
  every row.
- Any new report format that later lands in the CLI is an Effect Schema with
  decode tests (schema → service → implementation); this packet itself lands
  docs only, plus the Workstream A deletion.
- Preserve unrelated working-tree changes; one mutating actor per worktree.
- Ship through yeet (`repair` → `verify` → `publish --message`); `main` is
  PR-only; include a changeset (empty if version-neutral). Merged commit
  messages must cite the packet slug `quality-speedup` for the completion gate.

## Acceptance Criteria

- [ ] `research/tstyche-inventory.md` exists: full surface inventory, per-file
      coverage-loss assessment for all `*.tst.ts` files, flagged unique
      assertions (user-reviewed before deletion), and measured before/after
      lane + `yeet verify` wall times (stated plainly if < 1 min saving).
- [ ] Workstream A lands as its own PR: `rg -n "tstyche|\.tst\." -g
      '!**/node_modules/**' -g '!.repos/**'` returns only immutable history
      (`goals/**`, `explorations/**`) afterwards; `beep create-package` and
      `beep tsconfig-sync` no longer reference tstyche; `tsconfig-sync --check`
      returns 0 on a clean tree; the `dtslint-tsgo` lane is deleted, not
      no-op'd.
- [ ] `research/quality-time-inventory.md` exists: instrument audit first
      (confirming/refuting the four named gaps), per-lane p50/p95 table with
      run counts / failure rates / cache-hit rates / critical-path flags,
      bottlenecks ranked by impacted-wall-time × frequency, the three cost
      classes separated (real work / rerun-duplicated / waiting), and a
      remediation candidate list with measured upside, owning packet, and a
      falsification test each. "Not measurable" answers name the smallest
      instrument fix.
- [ ] `research/instantiation-census.md` exists: per-package census (files,
      types, symbols, instantiations, check time, peak RSS, tsgo version),
      floor probes, worst-file marginals for top offenders, named mechanisms
      tied to files, staged lever plan (prune surface → generator annotations
      → split) with per-package marginal budgets, OOM-risk section (lanes near
      the ceiling, TS2589 quarantine relation, one-bump-from-failure risks),
      and a verdict on a typeperf-style ratcheted instantiation gate.
- [ ] B and C land as docs-only PR(s); the packet stops and reports before any
      remediation derived from them.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/quality-speedup/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/quality-speedup/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/quality-speedup` | Passes |
| Yeet proof | `bun run beep yeet repair` then `verify` | Green |
| Lint policy | `bun run beep lint policy` | Green |
| Tsconfig sync (post-A) | `bun run beep tsconfig-sync --check` | Exit 0 |
| Tstyche gone (post-A) | `rg -n "tstyche\|\.tst\." -g '!**/node_modules/**' -g '!.repos/**'` | Only immutable history hits |

## Stop Conditions

- A `*.tst.ts` file asserts something no runtime/type check covers and the user
  has not signed off on the loss.
- Removing tstyche requires edits outside the inventoried surfaces (the
  inventory was wrong; re-derive it).
- A workstream turns out to be owned by an active packet.
- A measurement instrument cannot be verified, so its numbers cannot be
  trusted.
- Any change would touch public API, schemas, migrations, auth, infra,
  security behavior, dependencies, lockfiles, or generated files beyond what
  Workstream A explicitly requires.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
