# Codex Security Findings (2026-09-08)

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Capture, validate, remediate, and close every open Codex Cloud security finding
for `kriegcloud/beep-effect` in the 13-finding cumulative capture spanning September 8-9, 2026.
Ship the fixes through Yeet-driven PRs, close the exact captured findings, and
leave no packet-applicable finding open.

## Launch

```text
/goal follow the instructions in goals/codex-security-findings-2026-09-08/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md)
2. [`SPEC.md`](./SPEC.md)
3. [`PLAN.md`](./PLAN.md)
4. [`ops/manifest.json`](./ops/manifest.json)
5. [`ops/triage.json`](./ops/triage.json)
6. [`findings/INDEX.md`](./findings/INDEX.md)

## Current Phase

<!-- codex-findings-refresh:start -->
All 13 captured findings are validated and assigned. Twelve are merged and closed; CSF-013 is implemented and awaiting final proof and publication.
<!-- codex-findings-refresh:end -->

Twelve findings have merged and been closed: eleven in
[PR #1026](https://github.com/beep-effect/beep-effect/pull/1026), and CSF-012 in
[PR #1032](https://github.com/beep-effect/beep-effect/pull/1032). CSF-013 is
implemented on `codex/security-corpus-process-metadata`. Full local proof,
hosted checks, review, merge, and its exact-ID closure remain required.
The lifecycle stays active until every completion gate is satisfied.

The operator's September 8 instruction authorizes all work necessary to resolve
the current findings in one PR. Earlier archived-packet scope and approval gates
do not constrain this batch.

## Findings at a glance

1 Medium, 4 Low, 8 Informational findings. Accepted risk is unavailable; each item must be
fixed or closed only with strict proof that the report is already fixed or
materially invalid.

## Notes

- Raw report bodies remain untracked under `raw/`; tracked files are sanitized.
- Do not use Codex's Create PR or patch-apply controls.
- Browser closure is post-merge and must match the captured Codex ID allowlist.

The operator authorized a follow-up PR on September 9 because PR #1026 merged
while the newly surfaced CSF-012 fix was being finalized. That authorization
supersedes the original one-PR limit. Prior findings remain covered by #1026;
CSF-012 merged in PR #1032 on September 9 and was closed as Already fixed.
CSF-013 surfaced before that merge and is carried into the remaining follow-up
under the same instruction to resolve every finding. Its closure remains post-merge.
