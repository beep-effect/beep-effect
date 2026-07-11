# Repo Quality Throughput

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

Supersedes: [`goals/repo-quality-acceleration`](../repo-quality-acceleration)

## Mission

Make the repo's End-to-End Green lane materially faster without weakening the
authoritative proof. End-to-End Green means the path from a developer edit to a
mergeable pull request: local repair, blocker checks, commit/push, GitHub
Actions feedback, review comments, and final merge readiness.

This packet is now implementation-only. Batch 1, Batch 2, and Batch 3 research
are complete and archived as evidence. A new agent should not relaunch those
research batches or satisfy this goal by adding more analysis.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/repo-quality-throughput/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` is the normative implementation
contract. `tasks/tasks.jsonc` is the active work queue.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact implementation launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active implementation sequence.
4. [`tasks/tasks.jsonc`](./tasks/tasks.jsonc) - selected, done, and rejected tasks.
5. [`research/repo-exports-sharding-design.md`](./research/repo-exports-sharding-design.md) -
   first implementation design target.
6. [`research/`](./research) and [`history/`](./history) - historical evidence only.

## Active Work

No selected implementation tasks remain. Source-change proof, publish, PR
monitoring, and review closeout are complete on PR #215; any later packet-only
evidence commit is verified by live PR checks instead of re-recording another
proof row.

Completed guardrails and implementation tasks:

- `rqt-010`: external tooling candidates are closed through bounded prototype
  gates and waiver evidence; no broad external tool replacement was adopted.
- `rqt-009`: Yeet now has an opt-in PR check monitor and guarded
  `publish --fast --monitor` plan; default verify/publish still use the full
  local proof path.
- `rqt-003`: shared CI setup now emits timing/cache metadata, PR Nix jobs skip
  Bun setup while preserving the repo-cli push fallback, and release no-op
  detection runs before setup.
- `rqt-006`: Turbo root config inputs are task-owned, task-input affected
  filtering is enabled, and `beep quality turbo-config-proof` records scoped
  affected/dry-run proof.
- `rqt-005`: docgen now writes package proof manifests and `docgen:local`
  reuses current package proofs before aggregating selected docs.
- `rqt-008`: root type-test/integration lanes now filter to real script owners
  for unscoped runs, preserve explicit caller scopes, and include missed
  Postgres/Drizzle participation plus db-admin unit/integration separation.
- `rqt-007`: repo-export catalog now uses tracked package-local shards, a
  compact root index, shard-aware repo-codegraph lookup, and full-scan fallback.
- `rqt-001`: Yeet verify/publish no longer duplicates affected feedback before
  the full proof.
- `rqt-002`: `lint:fix` keeps its fast no-op and changed-file fixing path.
- `rqt-004`: proof parity and check-name guardrails are recorded.

Rejected stale work:

- `rqt-011`: Turbo credential hash pollution is already handled.
- `rqt-012`: initial bounded lint policy grouping already exists.

## Notes

- Keep implementation in `@beep/repo-cli`, `@beep/repo-utils`,
  `@beep/repo-codegraph`, Turbo/workflow config, Lefthook, and package
  manifests.
- Do not reintroduce one-off root scripts for durable quality semantics.
- Use focused local proof and GitHub Actions for repeated full-lane proof so the
  workstation stays usable.
