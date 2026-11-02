# Cloud Environment Fanout

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `research`
Status: `parked`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Four Claude and four ChatGPT subscriptions each carry cloud credits that expire
in early November 2026, and vendor cloud environments cannot be shared across
accounts. Make beep-effect bootstrap cleanly inside Claude cloud sessions,
Codex cloud, and Cursor Cloud Agents from one repo-owned script, so nine
environments cost nine one-line pastes instead of nine hand-built installs.

## Next Open Question

None open here. The packet is **parked**, superseded by
[`goals/cloud-agent-readiness`](../../goals/cloud-agent-readiness/README.md),
which is the current execution authority for cloud environments. The three
2026-10-05 questions are resolved or deferred in
[`DECISIONS.md`](./DECISIONS.md). Remaining obligations live in that goal
packet, not in this exploration queue. Re-entry conditions are in
`DECISIONS.md`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - vendor facts + capability inventory (stage 1).
4. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.
5. [`DECISIONS.md`](./DECISIONS.md) - decisions settled so far.
6. [`../../docs/runbooks/cloud-environments.md`](../../docs/runbooks/cloud-environments.md) - the per-vendor setup runbook this packet produced.

## Trail

- 2026-10-05: packet opened. Research done against vendor docs and local CLIs; `scripts/cloud/bootstrap.sh`, the thin `.cursor/install.sh`, the guarded SessionStart hook, and the runbook landed in the same lane. Stopped at: operator runs the per-account UI setups (Claude first), then the first smoke sessions settle the open questions before align.
- 2026-11-02: parked, superseded by `goals/cloud-agent-readiness`; not graduated (there is no `BRIEF.md` or `MAP.md`). Evidence: #2486 (Claude account-1 smoke), #2487 (fleet setup receipt), #2492 (cloud notifier guard), #2498 (projection skip), #2504 (bootstrap denied-host exit), #2510 (MCP scoping and hook evidence, including the cold-resume SessionStart timeouts). The four Claude environments are set up and their smokes passed (account 1's receipt is #2486; the orchestrator reported the others on 2026-11-02, and their per-account receipts stay in the private handoff). Codex setup checks run, but publishing a reusable environment failed twice without diagnostics, so Codex is not runnable. Cursor has an active snapshot and bootstrap only; its agent proof is still open. Not claimed: nine qualified environments, or a complete goal.
