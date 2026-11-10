# GitHub Budget Ledger — Sources & Provenance

- **Source exploration:** `explorations/github-api-quota` — primary ledger:
  [`explorations/github-api-quota/research/SOURCES.md`](../../../explorations/github-api-quota/research/SOURCES.md).
  Rows below are the subset this goal uses; the exploration ledger stays authoritative.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `ghcache-partition` | Cache partition = sha256(Authorization), separate from the budget id | kubernetes-sigs/prow | `pkg/ghcache/partitioner.go` (`getCachePartition`) | ledger (identity label vs token) | port-with-attribution |
| `throttling-detect` | Primary / secondary limit detection, GraphQL `RATE_LIMITED` as 200 | octokit/plugin-throttling.js | `src/index.ts`, `src/wrap-request.ts` | budget handling | port-with-attribution |
| `t3-quota-reserve` | Header-learned reserve: background reads stop at 10% remaining | pingdotgg/t3code @ ff7aa5ace3 | `packages/source-control-github/src/server/GitHubQuota.ts:10,61-95` | ledger, reserve | port-with-attribution |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [kubernetes-sigs/prow](https://github.com/kubernetes-sigs/prow) | Apache-2.0 | port-with-attribution | Per-response "did this cost a token" recording; budget id separate from cache partition |
| [octokit/plugin-throttling.js](https://github.com/octokit/plugin-throttling.js) | MIT | port-with-attribution | Rate-limit detection rules (incl. GraphQL limit errors as HTTP 200) |
| [pingdotgg/t3code](https://github.com/pingdotgg/t3code) | MIT | port-with-attribution | Header-learned quota reserve (10% floor that our 15% reserve sits above) |

## 3. External research sources

GitHub documentation (CC-BY-4.0):
- [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [Rate limits and query limits for the GraphQL API](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)
- [Best practices for using the REST API](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)

## 4. In-repo capability references

| Brick | Path | Verdict |
|---|---|---|
| Rate-limit cell | `packages/drivers/github/src/internal/octokit.ts:282-285`, `packages/drivers/github/src/Resilience.ts` (`RateLimitSnapshot`) | extend: add resource and identity, then persist |
| Monitor rate-limit pause (#3032) | `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorRateLimit.ts` (`readYeetGithubRateLimit`) | reuse: the `/rate_limit` sampler input |
| GraphQL budget guard | `packages/tooling/tool/cli/src/internal/github/GraphqlBudget.ts` | extend: read the ledger first |
| `gh` spawn helpers | `packages/tooling/tool/cli/src/internal/github/GhCommand.ts` (`ghOutput`), `packages/tooling/tool/cli/src/internal/repo-run` (`runRepoCommandCapture`) | extend: attribution wrapper |
| GitHub identity / transport seam | `packages/tooling/tool/cli/src/internal/github/GithubIdentity.ts` (`GithubTransportFetch`) | reuse: identity label source |
| Persisted snapshot pattern | `packages/tooling/tool/cli/src/commands/Palantiri/Palantiri.service.ts` (`writePrivateFile`, `retainLastGood`) | reuse |
| Palantiri parcels | `packages/tooling/library/palantiri/src` (`Parcel.models.ts`, `Freshness.ts`, `AccountHeadroom.ts` as the model) | extend: `github-headroom` parcel |

## 5. Cross-links & provenance

- Source exploration: [`explorations/github-api-quota`](../../../explorations/github-api-quota/README.md) —
  [`BRIEF.md`](../../../explorations/github-api-quota/BRIEF.md),
  [`MAP.md`](../../../explorations/github-api-quota/MAP.md),
  [`DECISIONS.md`](../../../explorations/github-api-quota/DECISIONS.md),
  [`RESEARCH.md`](../../../explorations/github-api-quota/RESEARCH.md) (Measurements: the 430 vs 720-1,440 GraphQL/h
  conflict this goal resolves).
- Sibling goals: [`github-state-worker`](../../github-state-worker/README.md) (requires `github/budget-ledger`),
  [`yeet-monitor-app-identity`](../../yeet-monitor-app-identity/README.md) (judged against this goal's baseline).
- Shipped precursor: PR #3032 (`MonitorRateLimit.ts`, sleep-through-reset).
