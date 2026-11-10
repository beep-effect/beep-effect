# GitHub API Quota — Sources & Provenance

- **Cluster and origin:** two quota-study workflows and one research workflow on 2026-11-09. Each pass was followed
  by refuting verifiers: platform claims were checked against docs.github.com, and code claims against file:line.
  Live measurements came from the same session.
- **Provenance:** [`RESEARCH.md`](../RESEARCH.md) summarises the work. The verified write-ups are the
  `2026-11-09-*.md` files in this directory.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `ghcache-revalidate` | Revalidate every hit; no-store for errors and `/graphql` | kubernetes-sigs/prow | `pkg/ghcache/ghcache.go` (`upstreamTransport.RoundTrip`) | ETag layer | port-with-attribution |
| `ghcache-partition` | Cache partition = sha256(Authorization), separate from the budget id | kubernetes-sigs/prow | `pkg/ghcache/partitioner.go` (`getCachePartition`) | ETag layer, ledger | port-with-attribution |
| `ghcache-coalesce` | Coalesce concurrent identical GETs, keyed by URL + Accept | kubernetes-sigs/prow | `pkg/ghcache/coalesce.go` | one reader per fact | port-with-attribution |
| `throttling-detect` | Primary / secondary limit detection, GraphQL `RATE_LIMITED` as 200 | octokit/plugin-throttling.js | `src/index.ts`, `src/wrap-request.ts` | budget handling | port-with-attribution |
| `t3-quota-reserve` | Header-learned reserve: background reads stop at 10% remaining | pingdotgg/t3code @ ff7aa5ace3 | `packages/source-control-github/src/server/GitHubQuota.ts:10,61-95` | ledger | port-with-attribution |
| `t3-watch-fingerprint` | Fingerprint-gated watch reads, grouped per (project, PR) | pingdotgg/t3code @ ff7aa5ace3 | `apps/server/src/orchestration-v2/PullRequestWatchReactor.ts:140-171,609` | one reader per fact | port-with-attribution |
| `t3-conditional-checks` | ETag revalidator for check reads | pingdotgg/t3code @ ff7aa5ace3 | `packages/source-control-github/src/server/gitHubConditionalChecks.ts:53-190` | ETag layer | port-with-attribution |
| `go-gh-cache` | gh's local TTL cache (no ETag) | cli/go-gh | `pkg/api/cache.go` | gh behaviour | reference-only |

**How these inform this packet:**
- **ghcache** is the shape for the ETag layer and the ledger: revalidate always, partition per token, coalesce
  in-flight requests, and record on every response whether it cost a token.
- **T3** is the shape for a quota-aware poller: fingerprint first, read detail only on change, and keep a reserve.
- **go-gh** shows why `gh api --cache` cannot serve live PR state: it has a TTL but never revalidates.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [kubernetes-sigs/prow](https://github.com/kubernetes-sigs/prow) | Apache-2.0 | port-with-attribution | ghproxy/ghcache design: revalidation, partitioning, coalescing, cache modes, per-budget throttling |
| [octokit/plugin-throttling.js](https://github.com/octokit/plugin-throttling.js) | MIT | port-with-attribution | Rate-limit detection rules |
| [octokit/plugin-retry.js](https://github.com/octokit/plugin-retry.js) | MIT | reference-only | Retry behaviour (ignores `retry-after`) |
| [pingdotgg/t3code](https://github.com/pingdotgg/t3code) | MIT | port-with-attribution | Quota reserve, fingerprint-gated watch, conditional checks |
| [cli/go-gh](https://github.com/cli/go-gh), [cli/cli](https://github.com/cli/cli) | MIT | reference-only | gh caching semantics |
| [cli/gh-webhook](https://github.com/cli/gh-webhook) | MIT | reference-only | Webhook forwarding for dev use only |
| [probot/smee.io](https://github.com/probot/smee.io) | MIT | reference-only | Webhook relay option |
| [bored-engineer/github-conditional-http-transport](https://github.com/bored-engineer/github-conditional-http-transport) | MIT | reference-only | Observation that ETags depend on Authorization (undocumented) |
| [bors-ng/bors-ng](https://github.com/bors-ng/bors-ng) | Apache-2.0 (archived 2024-04-04) | reference-only | Deprecated in favour of GitHub's merge queue |
| [renovatebot/renovate](https://github.com/renovatebot/renovate) | AGPL-3.0-only | clean-room | ETag revalidation with stale-if-error (pattern only) |
| Mergify engine | unverified | reference-only | One consumer per org stream, batched events |

## 3. External research sources

GitHub documentation (CC-BY-4.0):
- [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [Rate limits and query limits for the GraphQL API](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)
- [Best practices for using the REST API](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- [Rate limits for GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/rate-limits-for-github-apps)
- [Generating an installation access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)
- [Permissions required for GitHub Apps](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps)
- [Permissions required for fine-grained PATs](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- [Choosing permissions for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)
- [Check runs](https://docs.github.com/en/rest/checks/runs), [Rule suites](https://docs.github.com/en/rest/repos/rule-suites), [Pull request reviews](https://docs.github.com/en/rest/pulls/reviews), [Issue comments](https://docs.github.com/en/rest/issues/comments)
- [Events API](https://docs.github.com/en/rest/activity/events), [GitHub event types](https://docs.github.com/en/rest/using-the-rest-api/github-event-types)
- [Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads), [Best practices for webhooks](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks), [Redelivering webhooks](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/redelivering-webhooks), [Handling failed deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries), [Forwarding webhooks with gh](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/using-the-github-cli-to-forward-webhooks-for-testing)
- [Forming calls with GraphQL](https://docs.github.com/en/graphql/guides/forming-calls-with-graphql), [GraphQL public schema](https://docs.github.com/public/fpt/schema.docs.graphql)

Other:
- [Prow ghproxy docs](https://docs.prow.k8s.io/docs/ghproxy/), [throttling algorithm](https://docs.prow.k8s.io/docs/ghproxy/throttling-algorithm/), [Tide](https://docs.prow.k8s.io/docs/components/core/tide/)
- [gh api manual](https://cli.github.com/manual/gh_api)
- [Tailscale Funnel](https://tailscale.com/kb/1223/funnel)
- [Mergify: handling 300k GitHub events per day](https://articles.mergify.com/handling-300k-github-events-per-day)
- [Renovate self-hosted configuration](https://docs.renovatebot.com/self-hosted-configuration/)
- [octokit.js issue #2563](https://www.github.com/octokit/octokit.js/issues/2563) (ETag and conditional requests throwing on 304)

## 4. In-repo capability references

| Brick | Path | Verdict |
|---|---|---|
| Status snapshot writer (already written every poll) | `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1729`, `MonitorLoop.ts:2131` | extend: move to host scope, key by PR, write atomically |
| Monitor rate-limit pause (#3032) | `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorRateLimit.ts` | reuse: an input to the ledger |
| GitHub transport fetch seam | `packages/tooling/tool/cli/src/internal/github/GithubIdentity.ts` (`GithubTransportFetch`), `packages/drivers/github/src/internal/octokit.ts:240-249,369` | extend: the ETag layer goes here |
| Rate-limit cell | `packages/drivers/github/src/internal/octokit.ts:282-285`, `packages/drivers/github/src/Resilience.ts` | extend: add resource and identity, then persist |
| GraphQL budget guard | `packages/tooling/tool/cli/src/internal/github/GraphqlBudget.ts` | extend |
| Palantiri parcels | `packages/tooling/library/palantiri/src`, `packages/tooling/tool/cli/src/commands/Palantiri/` | extend: `github-headroom` and `pr-status` parcels |
| PR session registry | `packages/tooling/tool/cli/src/commands/Yeet/internal/PrSessionRegistry.ts` | reuse: host- and PR-keyed owner routing |
| Owned-generation file lock | `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts:1278-1302` | extend: needs a non-blocking long-lease variant |
| Daemon template | `packages/tooling/tool/cli/src/commands/AIMetrics/internal/ObservationWorker.ts`, `ObservationDeployment.ts` | extend: GitHub-state worker |
| Owner-checkpoint CAS + outbox | `packages/tooling/tool/cli/src/commands/Yeet/internal/OwnerCheckpoint.store.ts` | reuse the pattern |
| Yeet inbox | `packages/tooling/tool/cli/src/commands/Yeet/internal/Inbox.ts`, `InboxView.ts` | reuse: event sink |
| Runner-loss rerun workflow | `.github/workflows/rerun-runner-loss.yml` | extend: makes the monitor read-only |
| Effect persistence | `.repos/effect` `packages/effect/src/persistence/` (`KeyValueStore`, `Persistence`, `PersistedCache`, `RateLimiter`) | reuse |

Licenses: the repo root is Apache-2.0 (`LICENSE`). `@beep/repo-cli` declares Apache-2.0 and `@beep/palantiri`
declares MIT (`package.json`).

## 5. Cross-links & provenance

- This packet: [`CAPTURE.md`](../CAPTURE.md), [`RESEARCH.md`](../RESEARCH.md), and `DECISIONS.md` once align starts.
- Sibling exploration: [`explorations/github-merge-queue`](../../github-merge-queue/README.md). The native merge
  queue would retire merge-gate polling.
- Shipped precursor: PR #3032 (`perf(yeet): poll monitors every 90 s and sleep through GitHub rate limits`).
- Related issue: #3023 (fleet tokens lacked Administration for ruleset history).
