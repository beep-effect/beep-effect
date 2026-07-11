# Fallow Debt Burn-Down

## Status

Lifecycle: `paused`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Turn the current advisory Fallow output into a remediation queue. This packet is
about fixing selected Fallow-identified debt and wiring narrow repo checks after
the relevant debt class is understood, not leaving issues advisory forever and
not making every inherited finding fail.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/fallow-debt-burndown/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` is the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - phase sequence.
4. [`research/current-fallow-snapshot.md`](./research/current-fallow-snapshot.md) - current work queue.
5. [`tasks/tasks.jsonc`](./tasks/tasks.jsonc) - ranked task inventory.
6. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
7. Parent packet: [`goals/fallow-quality-enforcement`](../fallow-quality-enforcement/).
8. Precedent packet: [`goals/fallow-zero-dead-code`](../fallow-zero-dead-code/).

## Work Queue

1. `boundaries`: eliminate direct imports into `@beep/identity`,
   `@beep/schema`, and `@beep/utils` internals before promoting analyzer output.
2. `health`: refactor a first tranche of critical/high hotspots, especially
   repo-cli orchestration and UI theme branching.
3. `security`: triage the 23 candidates against existing security lanes, then
   fix confirmed risky sinks or record covered false positives in a repo-owned
   inventory.
4. `quality wiring`: after a class is burned down or inventoried, wire only
   new/regressed debt checks into repo quality.

## Current Decisions

- `audit` and `dead-code` remain blocking through the parent packet.
- Advisory findings should become concrete remediation work, not hidden
  `fallow-ignore` suppressions.
- Boundary direct-import cleanup can start before architecture-role legality is
  fully promoted.
- Health cleanup targets critical/high findings first; inherited moderate
  complexity stays cleanup-on-touch.
- Security findings are candidates until verified against existing security
  lanes.
- `fix-preview` remains dry-run only.
- Runtime coverage and editor/MCP hooks remain deferred.

## Verification

```sh
test "$(wc -m < goals/fallow-debt-burndown/GOAL.md)" -le 4000
bun goals/fallow-debt-burndown/ops/validate-packet.ts
bun goals/fallow-quality-enforcement/ops/validate-packet.ts
bun run beep quality fallow command-contract-check --assert audit,dead-code,health,boundaries,flags,security,fix-preview --require-envelope --out-dir .beep/fallow
bun run beep quality fallow boundaries --advisory --base origin/main --out .beep/fallow/boundaries.json --quiet
bun run beep quality fallow health --advisory --base origin/main --out .beep/fallow/health.json --quiet
bun run beep quality fallow security --advisory --base origin/main --out .beep/fallow/security.json --quiet
bun run beep quality github-checks plan-contract-check --mode pre-push --feature-matrix goals/fallow-quality-enforcement/research/feature-matrix.jsonc --expect-promoted-fallow-lanes
git diff --check -- goals/fallow-debt-burndown
```
