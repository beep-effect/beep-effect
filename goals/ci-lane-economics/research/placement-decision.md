# Required-lane placement decision — 2026-08-13

## Decision

**REVISED AFTER P2 ADMISSION.** Keep the current placement for all required
contexts. The proposed `Test Integration` move from `beep-ec2-heavy` to
`ubuntu-24.04` was live-falsified by runner shutdowns on both its attempt-one
job and targeted retry, so the documented rollback restores its existing fleet
placement. De-duplicate `Lint` from `Lint Policy` at the CI lane boundary, and
keep `Coverage Regression` on the fleet while its PR scope and full-run
sharding are implemented. No lane moves onto the fleet.

Signed: **Codex, execution agent, 2026-08-13**

Revised after live admission: **Codex, execution agent, 2026-08-13**

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
| Test Integration | fleet | fleet | 6.8m | Retain. The hosted re-fit hypothesis had strong historical cache evidence but failed live admission twice with runner shutdowns; jobs `94525310886` and `94533388363` falsify it. |
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
- Fleet jobs removed per wave: **0**.
- Incremental projected fleet spend: **$0/month** against the pre-packet placement.
- Governing projection: the signed **$100/month** standing projection remains
  the conservative upper bound because this decision adds no fleet work.
- Absolute ceiling: **$200/month** remains a hard stop. No Coverage shard may
  add a VM until its per-wave and monthly projection is recorded here.

The census measures job wall time rather than controller boot/billing time.
The failed hosted admission creates no standing fleet delta: retaining the
pre-packet placement cannot raise the approved projection.

## Safety and falsification

- The workflow's fork-PR approval, read-only PR cache, trusted-push cache-write
  environment, IAM, egress, and teardown paths are unchanged.
- The failed `Test Integration` experiment kept the same CLI lane, affected
  graph, remote-cache inputs, database setup, and required context name; only
  `runs-on` changed. The rollback restores the original runner label.
- `bun run lint` keeps its existing full local contract. Only
  `beep ci lane lint` stops duplicating checks already enforced by the separate
  required `Lint Policy` context.
- The hosted re-fit rollback has fired: two independent GitHub-hosted runners
  shut down during the verification step, terminating in-flight tasks with
  exit 137.
- Reject the Coverage redesign if a selected package can omit a summary, a
  current true regression turns green, or a full-fallback input selects less
  than the present full package set.

## P2 live admission evidence

| Run / job | Placement | Result | Attribution | Treatment |
| --- | --- | --- | --- | --- |
| `31723283969` / `94525310886` | `ubuntu-24.04` | Failed after 10m25s | GitHub-hosted runner received a shutdown signal; the verification step was cancelled and four in-flight Turbo tasks exited 137. This was not the workflow's 40-minute timeout or a test assertion failure. | Track as an infrastructure failure and exclude from duration percentiles. Targeted retry required. |
| `31723283969` attempt 2 / `94533388363` | `ubuntu-24.04` | Failed after 11m21s | A different GitHub-hosted runner received the same SIGTERM during the verification step after 8m05s of Turbo work. Tests emitted before termination passed; two remaining builds exited 137. | Repeated shutdown falsifies the hosted re-fit and fires the rollback. Exclude from duration percentiles. |
