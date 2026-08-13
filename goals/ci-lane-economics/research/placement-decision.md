# Required-lane placement decision — 2026-08-13

## Decision

**APPROVED FOR P2.** Keep the current placement for 15 required contexts and
move only `Test Integration` from `beep-ec2-heavy` to `ubuntu-24.04`.
De-duplicate `Lint` from `Lint Policy` at the CI lane boundary, and keep
`Coverage Regression` on the fleet while its PR scope and full-run sharding
are implemented. No lane moves onto the fleet.

Signed: **Codex, execution agent, 2026-08-13**

The decision uses the attempt-one cache-warm census in
`cache-warm-lane-census.md`. The source of truth for required contexts is live
ruleset `10240248`; `JSDoc Ratchet` remains visible but is not currently a
required context.

## Placement table

| Required context | Current | Decision | p95 | P2 action |
| --- | --- | --- | ---: | --- |
| Lint | hosted | hosted | 24.3m | Keep the free runner; run only the Turbo package lint graph because required `Lint Policy` already owns the repo-policy battery. |
| Lint Policy | fleet | fleet | 20.6m | Retain. #678 moved the post-change samples to 10.4-10.9m; re-measure instead of buying more capacity. |
| Check | fleet | fleet | 16.0m | Retain; no hosted shadow proves that the memory-heavy graph can safely re-fit. |
| Test Unit | hosted | hosted | 17.6m | Retain. |
| Test Integration | fleet | **hosted** | 6.8m | Re-fit to `ubuntu-24.04`. The frozen corpus has 96.9% Turbo hits, 13.2m of p95 headroom, and the prior hosted p95 was 5.75m. |
| Docgen | fleet | fleet | 13.4m | Retain; `uses_turbo: false`, so there is no cache-backed re-fit case. |
| Codegen Drift | hosted | hosted | 3.3m | Retain. |
| Repo Sanity | hosted | hosted | 4.1m | Retain. |
| Coverage Regression | fleet | fleet | 29.5m | Keep one fleet placement; use directly changed coverage owners on PRs with an explicit full fallback, and stable weighted full-run shards on `main`/nightly. Do not add fleet jobs until shard cost is measured. |
| Knip | hosted | hosted | 3.1m | Retain. |
| Commitlint | hosted | hosted | 1.8m | Retain. |
| Secret Scanning | hosted | hosted | 1.0m | Retain. |
| Security | hosted | hosted | 1.8m | Retain. |
| SAST | hosted | hosted | 2.3m | Retain. |
| Nix Shell | hosted | hosted | 1.9m | Retain. |
| Professional Desktop IPC Stdio | hosted | hosted | 1.5m | Retain. |

## Cost gate

- New fleet jobs per wave: **0**.
- Fleet jobs removed per wave: **1** (`Test Integration`).
- Incremental projected fleet spend: **less than or equal to $0/month**.
- Governing projection: the signed **$100/month** standing projection remains
  the conservative upper bound because this decision only removes fleet work.
- Absolute ceiling: **$200/month** remains a hard stop. No Coverage shard may
  add a VM until its per-wave and monthly projection is recorded here.

The census measures job wall time rather than controller boot/billing time, so
this record does not invent a dollar saving for the removed lane. It claims the
strict fact needed by the gate: fleet demand decreases and cannot raise the
approved projection.

## Safety and falsification

- The workflow's fork-PR approval, read-only PR cache, trusted-push cache-write
  environment, IAM, egress, and teardown paths are unchanged.
- `Test Integration` keeps the same CLI lane, affected graph, remote-cache
  inputs, database setup, and required context name; only `runs-on` changes.
- `bun run lint` keeps its existing full local contract. Only
  `beep ci lane lint` stops duplicating checks already enforced by the separate
  required `Lint Policy` context.
- Revert the hosted re-fit if it exceeds 20m at p95, OOMs, or creates runner
  shutdowns over the P3 observation window.
- Reject the Coverage redesign if a selected package can omit a summary, a
  current true regression turns green, or a full-fallback input selects less
  than the present full package set.
