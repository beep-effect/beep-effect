# Codex Security Findings (2026-06)

## Status

Lifecycle: `reference` (superseded 2026-06-17)

Source: [`ops/manifest.json`](./ops/manifest.json)

> **Superseded by [`goals/codex-security-findings-2026-06-17`](../codex-security-findings-2026-06-17/README.md)**
> (scan `f4128216…`, 71 findings, branch `security/6-17-2026`). This packet
> stalled at 12/52 captures and never reached triage; it is retained as
> reference for its proven structure and policies. Its 12 partial captures are
> preserved here as history.

Supersedes the deleted `goals/codex-security-findings/` packet only in spirit —
that packet covered a different scan (`3ccb…`, 64 findings, merged via PRs
#164/#169). This packet was a new batch: scan `5138…`, 52 findings.

## Mission

Triage, remediate-by-default, and close all 52 Codex Cloud security findings from
scan `5138685acf488191ad6a5ee51a84452d` (3 High / 15 Medium / 18 Low / 16
Informational) in a single, mergeable PR on `@slop/june-8-2026`.

## Launch

Start from `GOAL.md` in execution-capable sessions. It is only a compact
launcher; `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`ops/triage.json`](./ops/triage.json) - per-finding run-state ledger.
6. [`findings/INDEX.md`](./findings/INDEX.md) - finding catalog index.

## Current Phase

`P1 extract` - 12 of 52 findings are committed as redacted public ledgers.
CSF-001 through CSF-003 also have captured patch files. Next action: continue
capturing the remaining 40 findings from the authenticated Codex tab.

## Latest Evidence

`2026-06-11` - manifest, triage, and index reconcile with the 12 committed
captures and 3 committed patch files.

## Notes

- One human approval gate after triage (disposition matrix). Do not start
  closures or remediation before approval.
- Raw captures stay untracked in a machine-local scratch directory outside the repo; commit
  only sanitized markdown + patches.
- Unremediated findings stay redacted in public tracking regardless of severity;
  publish detailed report and patch material only with the corresponding fix and
  verification.
- The packet is tracking metadata, not package source or generated public API
  input; repo-export and graph artifacts showed no `goals/` leakage in the
  2026-06-11 verification pass.
- The PR on `@slop/june-8-2026` will also carry that branch's pre-existing
  effect-v4/yeet commits; the security work is additive on top.
