# Codex Security Findings (2026-07-14)

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Capture, triage, remediate, and close every open Codex Cloud security finding for
`beep-effect` (the 9-finding batch of 2026-07-14) in one PR on
`security/codex-findings-2026-07-14`. The end state is a merged PR, no unresolved
PR comments or failing CI jobs, and zero open Codex security findings applicable
to this packet.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/codex-security-findings-2026-07-14/GOAL.md
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

`P5 remediate complete` - all 9 findings fixed across lanes RL-001..RL-004 with
regression tests; entering P6 yeet-to-mergeable.

## Findings at a glance

5 Medium, 3 Low, 1 Informational — all `remediate`, none `.repos`. This is the
exact batch the `2026-07-08` packet closeout observed as `1-9 of 9` open and
deliberately left for a dedicated packet.

## Division of labor

- **Fable 5 (main)** drives: packet ledgers, `bun.lock` dedupe, browser closure
  (via codex Chrome), Yeet, merge, final verification.
- **Codex GPT-5.6 Sol (medium)** does the token-heavy work: per-lane validation
  and remediation on disjoint paths, returning changed files + verification.

## Notes

- Raw report markdown lives under [`raw/`](./raw/) and is ignored by git. Commit
  only sanitized summaries, triage metadata, changed-file lists, and verification.
- No accepted-risk path is allowed. Every finding is fixed.
- Removing the grafana MCP from repo config (CSF-002) drops the grafana MCP tools
  from fresh sessions — re-add grafana to user-level config to keep them.
- The tracked packet stays `active` until the driver performs the reserved
  completed-retained flip after post-merge Codex closure.
