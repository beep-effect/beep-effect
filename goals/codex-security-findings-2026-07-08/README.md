# Codex Security Findings (2026-07-08)

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Capture, triage, remediate, and close every open Codex Cloud security finding for
`beep-effect` in one PR on `security/codex-findings-2026-07-08`. The end state is
a merged PR, no unresolved PR comments or failing CI jobs, and zero open Codex
security findings.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/codex-security-findings-2026-07-08/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`ops/triage.json`](./ops/triage.json) - per-finding run-state ledger.
6. [`findings/INDEX.md`](./findings/INDEX.md) - sanitized finding catalog.

## Current Phase

`P6 yeet-to-mergeable` - all legitimate maintained-code findings are remediated locally; next action is Yeet verify/publish/monitor, then merge and post-merge Codex closure.

## Latest Evidence

`2026-07-08` - branch synced to current `origin/main`; 45 findings captured, 15 invalid/already-fixed findings closed in Codex, and 30 legitimate findings remediated locally pending Yeet PR merge.

## Notes

- Raw report and patch markdown lives under [`raw/`](./raw/) and is ignored by
  git. Commit only sanitized summaries, triage metadata, changed-file lists, and
  verification evidence.
- Findings under `.repos/**` are out of scope because that tree is reference
  material for agents, not maintained code. Close them as `False positive`.
- No accepted-risk path is allowed. Maintained-code findings are either fixed,
  already fixed, or proven false-positive with strict evidence.
- Sub-agents may validate and fix disjoint lanes in batches of six. The main
  agent owns ledger writes, shared helpers, browser closures, Yeet, merge, and
  final zero-open verification.
- The tracked packet stays `active` in the single PR. Post-merge Codex closure
  evidence is local/untracked and reported in the final operator summary.
