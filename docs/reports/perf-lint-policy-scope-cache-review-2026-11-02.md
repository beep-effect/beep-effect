# Cache baseline review: changed-scope Lint Policy seals (2026-11-02)

Branch `claude/perf-lint-policy-scope-6c226f` (quality audit K1 and M16), on top of
`main` at 5200ca9f35. The re-record covers the one subject
`bun run beep quality cache-policy` reported as drifted by this change: the root `//`.
Four `configuration-drift` findings name generated seals, plus the
`configuration-source-drift` review row on `turbo.json`.

## What changed

- **Seal inputs only.** `bun run beep lint policy-fingerprint --write` added three
  repo-cli modules to the import closure of the policy commands that load
  `commands/Quality`:
  - `packages/tooling/tool/cli/src/commands/Quality/internal/LintPolicyScope.ts`
    (changed-scope escalation classes and the Turbo target probe parser),
  - `packages/tooling/tool/cli/src/commands/Quality/internal/DocsOxlintPlugin.ts`
    (the per-run documentation plugin bundle),
  - `packages/tooling/tool/cli/src/commands/Lint/PolicyFingerprint.schemas.ts`
    (already sealed elsewhere; now reached through `LintPolicyScope.ts`).

  The drifted subjects are the seals `//#lint:policy-fingerprint:goals-doctor`,
  `:knowledge`, `:lint-deprecated-apis` and `:quality`. Each gained input paths; none
  lost one.
- No command, output pattern, cache flag, environment key or dependency edge of any
  root task changed, and no task was added or removed. No workspace package manifest
  changed.

## Unchanged

`scope`, `profile` and `epoch` are copied from the current baseline. This review records
the legacy posture of the root subject only. It grants no qualification, widens no
qualification scope, and adds no exception row.

## Reversal

Remove the two new modules and their imports, run
`bun run beep lint policy-fingerprint --write` to drop the paths from the seals, then
re-record the root subject.
