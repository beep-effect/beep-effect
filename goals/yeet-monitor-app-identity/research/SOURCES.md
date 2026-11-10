# Yeet Monitor App Identity — Sources & Provenance

- **Source exploration:** `explorations/github-api-quota` — primary ledger:
  `explorations/github-api-quota/research/SOURCES.md`
  ([link](../../../explorations/github-api-quota/research/SOURCES.md)).

## 1. Mined source corpus

None: this goal mines no upstream source. The exploration's mined corpus is in its primary ledger.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [pingdotgg/t3code](https://github.com/pingdotgg/t3code) | MIT | reference-only | T3 always authenticates as the user, so it keeps spending the user bucket after this goal; its 10% background floor is why the 15% reserve holds on both identities |

This goal ports no upstream code.

## 3. External research sources

GitHub documentation (CC-BY-4.0), copied from the exploration ledger §3:
- [Rate limits for GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/rate-limits-for-github-apps) (App installation bucket)
- [Generating an installation access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app) (hourly rotation, scoped permissions)
- [Permissions required for GitHub Apps](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps) (least-privilege read set)
- [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) (`GITHUB_TOKEN` 1,000/h per repository)

## 4. In-repo capability references

| Brick | Path | Verdict |
|---|---|---|
| Runner-loss rerun workflow | `.github/workflows/rerun-runner-loss.yml` | extend: makes the monitor read-only |
| Runner-loss classifier | `packages/tooling/tool/cli/src/commands/Ci/RunnerLossRerun.ts`, `CiRerunRunnerLoss.ts` | extend: full environment-only domain |
| Monitor flake signatures | `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts` (`YeetMonitorFlakeClass`, ~213-275; `rerunJob`, ~1188) | extend: classification stays, write path removed |
| Job shape classes | `packages/tooling/tool/cli/src/internal/github/JobShape.ts` | reuse |
| App token minting | `packages/drivers/github/src/GitHubApp.ts` (cached installation tokens, `assertPermissions`) | reuse |
| App mint command | `packages/tooling/tool/cli/src/commands/Github/` (`github app mint`) | reuse: credential decode |
| Daemon template (`LoadCredential=` token) | `packages/tooling/tool/cli/src/commands/AIMetrics/internal/ObservationWorker.ts`, `ObservationDeployment.ts` | extend, via the `github-state-worker` worker |
| systemd install | `packages/tooling/library/repo-cli-kit/src/systemd/SystemdUnit.ts` | reuse |
| Monitor rate-limit pause (#3032) | `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorRateLimit.ts` | reuse via `github-budget-ledger`, which owns the per-identity `/rate_limit` sampler; this goal only adds the App identity to the ledger's configuration |

## 5. Cross-links & provenance

- Source exploration: [`explorations/github-api-quota`](../../../explorations/github-api-quota/README.md)
  — [BRIEF](../../../explorations/github-api-quota/BRIEF.md) step 3,
  [MAP](../../../explorations/github-api-quota/MAP.md) goal 3,
  [DECISIONS](../../../explorations/github-api-quota/DECISIONS.md) "identity",
  [RESEARCH](../../../explorations/github-api-quota/RESEARCH.md) Constraints (App bucket,
  the 2026-10-31 ruling's reasons).
- Sibling goals: [`github-budget-ledger`](../../github-budget-ledger/README.md) (provides
  `github/budget-ledger`, the before/after evidence) and
  [`github-state-worker`](../../github-state-worker/README.md) (provides `github/pr-snapshot`,
  the worker whose identity this goal switches).
- Gated follow-on: `github-fleet-sharing` in the exploration MAP fires on ledger evidence
  after this goal.
- Runbook: [`docs/runbooks/ci-runner-reliability.md`](../../../docs/runbooks/ci-runner-reliability.md);
  App notes: [`docs/ops/beep-reviewer-app.md`](../../../docs/ops/beep-reviewer-app.md).
