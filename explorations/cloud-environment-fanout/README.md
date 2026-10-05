# Cloud Environment Fanout

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `research`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Four Claude and four ChatGPT subscriptions each carry cloud credits that expire
in early November 2026, and vendor cloud environments cannot be shared across
accounts. Make beep-effect bootstrap cleanly inside Claude cloud sessions,
Codex cloud, and Cursor Cloud Agents from one repo-owned script, so nine
environments cost nine one-line pastes instead of nine hand-built installs.

## Next Open Question

Does `bun install` succeed behind the Claude security proxy with the
bootstrap's retry loop alone? The first smoke session on a Claude account
answers it; the runbook names the fallback if not.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - vendor facts + capability inventory (stage 1).
4. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.
5. [`DECISIONS.md`](./DECISIONS.md) - decisions settled so far.
6. [`../../docs/runbooks/cloud-environments.md`](../../docs/runbooks/cloud-environments.md) - the per-vendor setup runbook this packet produced.

## Trail

- 2026-10-05: packet opened. Research done against vendor docs and local CLIs; `scripts/cloud/bootstrap.sh`, the thin `.cursor/install.sh`, the guarded SessionStart hook, and the runbook landed in the same lane. Stopped at: operator runs the per-account UI setups (Claude first), then the first smoke sessions settle the open questions before align.
