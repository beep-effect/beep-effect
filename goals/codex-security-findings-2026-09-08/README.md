# Codex Security Findings (2026-09-08)

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Capture, validate, remediate, and close every open Codex Cloud security finding
for `kriegcloud/beep-effect` in the 12-finding batch captured on 2026-09-08.
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
Eleven findings merged in PR #1026. CSF-012 is implemented for the operator-authorized follow-up PR; proof, publication, and exact-ID closure remain in progress.
<!-- codex-findings-refresh:end -->

Eleven findings and every review comment were addressed in merged
[PR #1026](https://github.com/beep-effect/beep-effect/pull/1026). CSF-012 surfaced
during its final CI run and is implemented for an authorized follow-up PR. The final packet
and reflection land with the fixes. Full local proof and hosted checks remain
merge gates; the exact twelve Codex IDs are closed after the merge is confirmed.
The PR records the final check results, merge commit, and external closure receipt.

The machine-readable lifecycle remains active until the completion gate is
satisfied. The operator requires one remediation PR; post-merge external closure
evidence is retained on that PR rather than requiring another publication.

The operator's September 8 instruction authorizes all work necessary to resolve
the current findings in one PR. Earlier archived-packet scope and approval gates
do not constrain this batch.

## Findings at a glance

1 Medium, 3 Low, 8 Informational findings. Accepted risk is unavailable; each item must be
fixed or closed only with strict proof that the report is already fixed or
materially invalid.

## Notes

- Raw report bodies remain untracked under `raw/`; tracked files are sanitized.
- Do not use Codex's Create PR or patch-apply controls.
- Browser closure is post-merge and must match the captured Codex ID allowlist.

The operator authorized a follow-up PR on September 9 because PR #1026 merged
while the newly surfaced CSF-012 fix was being finalized. That authorization
supersedes the original one-PR limit. Prior findings remain covered by #1026;
CSF-012 must merge before its Codex finding is closed.
