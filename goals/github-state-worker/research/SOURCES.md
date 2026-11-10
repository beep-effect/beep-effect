# GitHub State Worker — Sources & Provenance

- **Source exploration:** `explorations/github-api-quota` — primary ledger:
  [`explorations/github-api-quota/research/SOURCES.md`](../../../explorations/github-api-quota/research/SOURCES.md).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `ghcache-revalidate` | Revalidate every hit; no-store for errors and `/graphql` | kubernetes-sigs/prow | `pkg/ghcache/ghcache.go` (`upstreamTransport.RoundTrip`) | ETag layer | port-with-attribution |
| `ghcache-partition` | Cache partition = sha256(Authorization), separate from the budget id | kubernetes-sigs/prow | `pkg/ghcache/partitioner.go` (`getCachePartition`) | ETag layer | port-with-attribution |
| `ghcache-coalesce` | Coalesce concurrent identical GETs, keyed by URL + Accept | kubernetes-sigs/prow | `pkg/ghcache/coalesce.go` | one reader per fact | port-with-attribution |
| `throttling-detect` | Primary / secondary limit detection, GraphQL `RATE_LIMITED` as 200 | octokit/plugin-throttling.js | `src/index.ts`, `src/wrap-request.ts` | budget handling | port-with-attribution |
| `t3-watch-fingerprint` | Fingerprint-gated watch reads, grouped per (project, PR) | pingdotgg/t3code @ ff7aa5ace3 | `apps/server/src/orchestration-v2/PullRequestWatchReactor.ts:140-171,609` | one reader per fact | port-with-attribution |
| `t3-conditional-checks` | ETag revalidator for check reads | pingdotgg/t3code @ ff7aa5ace3 | `packages/source-control-github/src/server/gitHubConditionalChecks.ts:53-190` | ETag layer | port-with-attribution |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [kubernetes-sigs/prow](https://github.com/kubernetes-sigs/prow) | Apache-2.0 | port-with-attribution | ghcache: revalidation, per-token partitioning, coalescing, cache modes, request spacing |
| [octokit/plugin-throttling.js](https://github.com/octokit/plugin-throttling.js) | MIT | port-with-attribution | Rate-limit detection rules, including GraphQL limits returned as 200 |
| [pingdotgg/t3code](https://github.com/pingdotgg/t3code) | MIT | port-with-attribution | Fingerprint-gated reads, aliased 25-PR GraphQL batches, conditional check reads |
| [bored-engineer/github-conditional-http-transport](https://github.com/bored-engineer/github-conditional-http-transport) | MIT | reference-only | Observation that ETags depend on Authorization (undocumented) |
| [renovatebot/renovate](https://github.com/renovatebot/renovate) | AGPL-3.0-only | clean-room | ETag revalidation with stale-if-error (pattern only, no code) |

## 3. External research sources

See the exploration ledger §3. The ones this goal leans on:
- [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) and
  [Best practices for using the REST API](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
  (conditional requests; an authorized 304 is free on the primary limit).
- [Rate limits and query limits for the GraphQL API](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)
  (`rateLimit { cost }`, secondary limits).
- [Prow ghproxy docs](https://docs.prow.k8s.io/docs/ghproxy/) and its [throttling algorithm](https://docs.prow.k8s.io/docs/ghproxy/throttling-algorithm/).
- [octokit.js issue #2563](https://www.github.com/octokit/octokit.js/issues/2563) (304 throws in `@octokit/request`).

## 4. In-repo capability references

| Brick | Path | Verdict |
|---|---|---|
| Status snapshot writer (already written every poll) | `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1729`, `MonitorLoop.ts:2131` | extend: host scope, key by PR, atomic, head SHA + generation |
| GitHub transport fetch seam | `packages/tooling/tool/cli/src/internal/github/GithubIdentity.ts` (`GithubTransportFetch`), `packages/drivers/github/src/internal/octokit.ts:240-249,369` (`TransportOptions.fetch`) | extend: the ETag layer goes here (wrapper is NET-NEW) |
| Typed GraphQL documents | `packages/drivers/github/src/GraphQL.ts` | extend: fingerprint and detail documents are NET-NEW |
| Rate-limit cell | `packages/drivers/github/src/internal/octokit.ts:282-285`, `packages/drivers/github/src/Resilience.ts` | reuse (goal 1 extends it) |
| GraphQL budget guard | `packages/tooling/tool/cli/src/internal/github/GraphqlBudget.ts` | extend: gate cycles on the reserve signal |
| Monitor rate-limit pause (#3032) | `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorRateLimit.ts` | reuse |
| PR session registry | `packages/tooling/tool/cli/src/commands/Yeet/internal/PrSessionRegistry.ts` | reuse: tracked PR set |
| Daemon template | `packages/tooling/tool/cli/src/commands/AIMetrics/internal/ObservationWorker.ts`, `ObservationDeployment.ts` | extend: GitHub-state worker |
| systemd install | `packages/tooling/library/repo-cli-kit/src/systemd/SystemdUnit.ts` | reuse |
| Owned-generation file lock | `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts:1278-1302` | extend: non-blocking long-lease variant if the flock needs one |
| Persisted snapshot pattern | `packages/tooling/tool/cli/src/commands/Palantiri/Palantiri.service.ts` (`writePrivateFile`, `retainLastGood`), `packages/tooling/library/palantiri/src` (`Freshness.ts`) | reuse (file-per-PR store option) |
| Owner-checkpoint CAS + outbox | `packages/tooling/tool/cli/src/commands/Yeet/internal/OwnerCheckpoint.store.ts` | reuse the pattern (SQLite store option) |
| Snapshot readers | `ReadyGate.ts`, `MergeGate.ts`, `WatchMode.ts`, `GateTable.ts` in `packages/tooling/tool/cli/src/commands/Yeet/internal` | extend |
| Effect persistence | `.repos/effect` `packages/effect/src/persistence/` (`KeyValueStore.layerFileSystem`, `Persistence`) | reuse: ETag entry store |

Licenses: the repo root is Apache-2.0 (`LICENSE`); `@beep/repo-cli` declares Apache-2.0; `@beep/github` declares
MIT (`packages/drivers/github/package.json`). The ghcache port lands in `@beep/github`, so the ported file carries
the Apache-2.0 notice and attribution; P0 records whether that file stays a design port (no copied code) or the
package needs an Apache-2.0 NOTICE entry.

## 5. Cross-links & provenance

- Source exploration: [`README.md`](../../../explorations/github-api-quota/README.md),
  [`BRIEF.md`](../../../explorations/github-api-quota/BRIEF.md),
  [`MAP.md`](../../../explorations/github-api-quota/MAP.md),
  [`DECISIONS.md`](../../../explorations/github-api-quota/DECISIONS.md),
  [`RESEARCH.md`](../../../explorations/github-api-quota/RESEARCH.md).
- Requires: [`goals/github-budget-ledger`](../../github-budget-ledger/README.md) (`github/budget-ledger`).
- Required by: [`goals/yeet-monitor-app-identity`](../../yeet-monitor-app-identity/README.md) (`github/pr-snapshot`).
- Sibling exploration: [`explorations/github-merge-queue`](../../../explorations/github-merge-queue/README.md).
- Shipped precursor: PR #3032.
