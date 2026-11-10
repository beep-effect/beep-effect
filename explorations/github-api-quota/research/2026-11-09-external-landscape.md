## External Landscape (2026-11-09)

All pages below were fetched on 2026-11-09. I made no calls to `api.github.com` or through `gh`. Each item gives what to take, the license, and the disposition. Port only from permissive code (MIT, Apache-2.0, ISC), and keep attribution. Copyleft code is clean-room only.

### 1. Kubernetes Prow `ghproxy` / `ghcache`: the closest prior art for "many bots, one quota"

- **Repo and license.** Repo: https://github.com/kubernetes-sigs/prow (the code is under `cmd/ghproxy` and `pkg/ghcache`). License: **Apache-2.0** (https://raw.githubusercontent.com/kubernetes-sigs/prow/main/LICENSE). The docs have moved to https://docs.prow.k8s.io/docs/ghproxy/.
- **What it is.** "ghProxy is a reverse proxy HTTP cache optimized for use with the GitHub API." Every Prow component points `--github-endpoint` at `http://ghproxy`, with a second `--github-endpoint=https://api.github.com` as the upstream fallback. Prow's client "doesn't count requests that can be fulfilled with a cached response against the throttling limit" (https://docs.prow.k8s.io/docs/ghproxy/).
- **Revalidate on every hit.** "Every cache hit is revalidated with a conditional HTTP request to GitHub regardless of cache entry freshness (TTL)", because "conditional requests for unchanged resources don't cost any API tokens" (https://docs.prow.k8s.io/docs/ghproxy/ghcache/). In code (https://raw.githubusercontent.com/kubernetes-sigs/prow/main/pkg/ghcache/ghcache.go, `upstreamTransport.RoundTrip`):
  - Responses below 400 are rewritten to `Cache-Control: no-cache`, so they are stored but always revalidated.
  - Responses with status ≥ 400 get `no-store` ("They can't be revalidated to save API tokens"). So does every request whose path starts with `/graphql` (v4).
  - GitHub's own docs add a caveat: a 304 is free only when the request is "made while correctly authorized with an `Authorization` header" (https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).
- **Two different keys: the cache partition and the token budget.**
  - The **cache partition** is always `sha256(Authorization)` (`getCachePartition` in https://raw.githubusercontent.com/kubernetes-sigs/prow/main/pkg/ghcache/partitioner.go). The budget header does not change it.
  - The **token budget**, used for throttling queues and metrics, comes from the `X-PROW-GHCACHE-TOKEN-BUDGET-IDENTIFIER` header if present. Otherwise it is the sha256 of the `Authorization` header.
  - `X-PROW-TOKEN-EXPIRES-AT` (RFC3339) is written into partition metadata, so `Prune` can delete partitions whose tokens have expired.
  - A `legacyDisablePartitioningByAuthHeader` switch turns partitioning off for the disk cache. The Redis backend does not partition at all; its source comment says "requests to the same path from different tokens will invalidate each other".
  - Why per-token partitions matter: per bored-engineer's README (§2), GitHub's ETag includes the `Authorization` value, so ETags from one token do not revalidate for another. That is an undocumented observation, not something Prow states.
- **Request coalescing.** This covers concurrent identical GETs only. The key is `req.URL.String() + " " + Accept`; the source comment explains "The same URL can return JSON, a diff or a patch, depending on Accept". One upstream call runs and the waiters receive a copy of its response. If that call fails, every waiter gets the same error. Non-GET requests pass through as `ModeSkip` (https://raw.githubusercontent.com/kubernetes-sigs/prow/main/pkg/ghcache/coalesce.go). Coalescing runs inside each cache partition, so it only merges requests made with the same token.
- **Cache modes as a cost signal.** `X-Cache-Mode` takes the values `MISS`, `CHANGED`, `REVALIDATED`, `COALESCED`, `NO-STORE` and `SKIP` (Go constants `ModeMiss`, `ModeChanged`, `ModeRevalidated`, `ModeCoalesced`, `ModeNoStore`, `ModeSkip`). There is also an internal `ModeError`, which the source says is never returned in the header. `CacheModeIsFree` is true for Coalesced, Revalidated and Error. Each served response therefore says whether it spent a token.
- **Throttling** (https://docs.prow.k8s.io/docs/ghproxy/throttling-algorithm/). It was added to avoid secondary-limit 403s in large installations.
  - Requests are queued per token budget (per org for Apps, per sha256 token hash for a bot user) and split into v3 and v4.
  - GET and non-GET requests share one queue per budget, but GETs get their own spacing (`throttlingTimeForGET` in `tokensRegistry`, ghcache.go). The docs say the split is a timing setting, not a separate queue.
  - Flags: `--throttling-time-ms`, `--throttling-time-v4-ms`, `--get-throttling-time-ms`, `--throttling-max-delay-duration-seconds` (default 30), `--throttling-max-delay-duration-v4-seconds` (default 30) and `--request-timeout` (default 30 s). Throttling is off unless both `throttling-time-ms` and `get-throttling-time-ms` are non-zero.
  - The example config uses 300 ms (GET), 900 ms (non-GET) and 850 ms (v4) spacing, with max delays of 45 s and 110 s.
  - The max-delay cap is deliberate: the algorithm "prefers hitting secondary rate limits instead of forming a massive queue of throttled messages".
  - A weighted semaphore (`semaphore.NewWeighted(maxConcurrency)`) caps concurrent outbound requests (ghcache.go; the docs page does not describe it).
- **Metrics.** The docs list `github_request_duration` and `github_request_wait_duration_seconds`. The code adds `concurrent_outbound_requests`, `pending_outbound_requests` and `ghcache_cache_partitions{token_hash}`.
- **Tide** "uses the GraphQL API (v4) to search for mergeable pull requests" rather than polling each PR, and "should be configured with ghproxy to manage rate limits" (https://docs.prow.k8s.io/docs/components/core/tide/).
- **What to take.** Port the design with attribution (Apache-2.0), reimplemented in Effect:
  - one local reader that all clients share
  - revalidate on every hit, `no-store` for errors and GraphQL
  - a cache partition per sha256(token), kept separate from the budget id
  - in-flight coalescing keyed on URL+Accept
  - a "was this free?" mode on every response, feeding the budget ledger
  - per-budget spacing with a hard max-delay
- **Disposition:** port-with-attribution.

### 2. Octokit plugins and the ETag recipe

- **`@octokit/plugin-throttling`.** License **MIT** (https://github.com/octokit/plugin-throttling.js).
  - `onRateLimit(retryAfter, options, octokit, retryCount)` and `onSecondaryRateLimit` are both required. Returning `true` retries after `retryAfter` seconds.
  - Source (https://raw.githubusercontent.com/octokit/plugin-throttling.js/main/src/index.ts) acts only on REST **403 or 429**, or on any `/graphql` error other than 401.
  - A **secondary limit is detected by the message regex** `/\bsecondary rate\b/i`. It waits for `retry-after`, else `fallbackSecondaryRateRetryAfter` = 60 s.
  - A **primary limit** is `x-ratelimit-remaining === "0"` **or** a GraphQL body error with `type === "RATE_LIMITED"`. It waits until `x-ratelimit-reset` + 1 s.
    - For GraphQL, `src/wrap-request.ts` turns a 200 response whose body has a `RATE_LIMITED` error into a thrown error. This covers the 200-with-error primary case the platform review flagged.
    - A GraphQL **secondary** limit returned as 200 is not converted, so the secondary regex never sees it.
  - Bottleneck groups:
    - global: maxConcurrent 10
    - write: maxConcurrent 1, minTime 1000 ms. This matches GitHub's "wait at least one second" between mutations. `wrap-request.ts` sends **every GraphQL request** through this write group as well, read or mutation alike.
    - search: maxConcurrent 1, minTime 2000 ms
    - notifications: maxConcurrent 1, minTime 3000 ms
    - auth: maxConcurrent 1
  - **Cross-process sharing.** With `Bottleneck.RedisConnection`/`IORedisConnection` and an `id`, "All octokit instances with the same ID using the same Redis server will share the throttling" (README).
- **`@octokit/plugin-retry`.** License **MIT** (https://github.com/octokit/plugin-retry.js).
  - It retries 4xx/5xx "except `400`, `401`, `403`, `404`, `410`, `422`, and `451`", 3 times by default.
  - **429 is not on the list.** The source (`src/error-request.ts`) retries any status ≥ 400 that is not on that list, with a `(retryCount+1)²`-second backoff that ignores `retry-after`. Without throttling ordered ahead of it, retry will re-fire a rate-limited 429.
- **What `@octokit/request` does with a 304.** It **throws `RequestError("Not modified", 304)`**, with the body already read. It never sets fetch's `cache` option (https://raw.githubusercontent.com/octokit/request.js/main/src/fetch-wrapper.ts). The installed version in this repo, 10.0.16, has the same 304 branch.
  - Conditional requests do work, provided the `If-None-Match` value keeps its **double quotes**. A contributor (gr2m, labelled "Contributor" on the page) says so and confirmed it on 2024-09-18; the issue was closed as completed (https://www.github.com/octokit/octokit.js/issues/2563).
  - The repo's `makeOctokit` uses bare `@octokit/core` with only `plugin-paginate-rest`: no throttling or retry plugin, and retry happens on the Effect side (`Resilience.ts` `RetryPolicy`). It already passes an injectable `fetch` through `request.fetch` (`packages/drivers/github/src/internal/octokit.ts:240-248`).
  - So the cleanest ETag layer is a **fetch wrapper** that turns a 304 into a synthetic 200 from cache, before octokit can throw. A hook that catches `RequestError` 304 is the alternative.
- **Third-party ETag caches.**
  - `@security-alliance/octokit-plugin-cache` (MIT per the registry, 101 downloads last month, keywords include `conditional-request`; https://packages.ecosyste.ms/registries/npmjs.org/packages/@security-alliance%2Foctokit-plugin-cache). Its source is unread. Reference only.
  - `bored-engineer/github-conditional-http-transport` (MIT, Go; https://github.com/bored-engineer/github-conditional-http-transport):
    - It documents the key pitfall: GitHub's ETag is a SHA-256 of the body prefixed with the `Accept`, `Authorization` and `Cookie` values, so the **hourly rotation of App installation tokens invalidates a naive cache**.
    - It works around this by keying storage on URL and recomputing the expected ETag client-side. The README warns that the algorithm "_is not documented_ by GitHub and could change without any notice".
    - Its storage backends are bbolt, memory, pebble, redis and s3 (top-level directories).
    - Take the warning, not the trick.
- **What to take.**
  - Throttling's detection rules (403/429, the secondary-limit message regex, RATE_LIMITED in a GraphQL body) and its group spacing, clean-reimplemented as an Effect `Schedule`/semaphore policy.
  - Also handle a GraphQL secondary limit returned as 200, which the plugin misses.
  - The ETag layer at the fetch seam, preserving the quoted ETag.
  - Cache partitions keyed by token **lineage** rather than raw token, so App-token rotation does not wipe the partition. Because the ETag still changes with the token, re-keying still costs one full 200 per resource per token rotation.
- **Disposition:** port-with-attribution (MIT) for the detection logic. Reference-only for the security-alliance plugin and for the reverse-engineered ETag.

### 3. gh CLI caching

- `gh api --cache <duration>`: "Cache the response, e.g. "3600s", "60m", "1h"" (https://cli.github.com/manual/gh_api). It is wired as `EnableCache: opts.CacheTTL > 0` in `pkg/cmd/api/api.go` (https://raw.githubusercontent.com/cli/cli/trunk/pkg/cmd/api/api.go) and handed to go-gh's `api.NewHTTPClient` (`cli/cli` `api/http_client.go`).
- The implementation is go-gh's cache (MIT; https://raw.githubusercontent.com/cli/go-gh/trunk/pkg/api/cache.go):
  - The **cache is local to one machine and serves a fresh entry with no network call**.
  - **There is no ETag, no `If-None-Match` and no `Cache-Control` handling.** Expiry is the file mtime against the TTL.
  - The key is sha256 of method + URL + `Accept` + `Authorization` + body.
  - GET/HEAD are cacheable, and so is **POST to `/graphql`** (or `/api/graphql`).
  - Every status below 500 is stored **except 403**. A cached 404 or 422 is therefore served until the TTL runs out.
  - A per-request TTL can be set with `X-GH-CACHE-TTL`, and a directory with `X-GH-CACHE-DIR`.
  - The default TTL is 24 h when caching is on. The default directory is "the same directory that gh uses for caching" (`config.CacheDir()`; https://raw.githubusercontent.com/cli/go-gh/trunk/pkg/api/client_options.go). The resolved path is unverified.
- `gh pr view` and `gh pr checks` expose no cache flag (unverified; not observed on the manual pages).
- **What to take.** `gh api --cache` is a cheap TTL dedupe for read-mostly lookups on one host, such as repo metadata or ruleset ids. It does **not** help with live PR state, because it serves stale data without revalidating, and it is not shared across the fleet.
- **Disposition:** reference-only (we invoke gh, we do not port it).

### 4. Getting webhooks to a local machine, instead of polling

- **GitHub's guidance.**
  - "Webhooks require less effort and less resources than polling an API" and "Webhooks scale better than API calls" (https://docs.github.com/en/webhooks/about-webhooks).
  - "You should subscribe to webhook events instead of polling the API for data", and, "to avoid exceeding secondary rate limits, … make requests serially instead of concurrently" (https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).
- **Redelivery.**
  - "GitHub does not automatically redeliver failed deliveries", and "You can redeliver webhook deliveries that occurred in the past 3 days" (https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/redelivering-webhooks).
  - The documented recovery is a scheduled script: list deliveries since the last run, then redeliver those whose status is not `OK` (https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries).
  - That script costs REST calls for the delivery listing plus one per failure, not one per poll [inferred].
- **`gh webhook forward`** (`cli/gh-webhook`, MIT per the repo's `LICENSE.md`; https://github.com/cli/gh-webhook):
  - It creates a hook and relays events over a websocket dialled with the gh token. Flags: `--events` (required), `--repo`/`--org`, `--url`, `--secret`.
  - On an abnormal close (1006) it reconnects after 5 s, and stops after 3 attempts (`runFwd` in https://raw.githubusercontent.com/cli/gh-webhook/main/webhook/forward.go).
  - The docs say it "is only designed for use during testing and development", is "not supported for use in production environments", and "Only one person can use webhook forwarding at a time for each repository and organization" (otherwise setup fails with `Hook already exists`) (https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/using-the-github-cli-to-forward-webhooks-for-testing).
  - So **at most one fleet host can hold it**, which rules it out as the fleet route.
- **smee.io** (service: probot/smee.io, MIT; client: probot/smee-client, ISC):
  - It relays over Server-Sent Events and is "intended for use in development, not for production". "Channels are not authenticated, so if someone has your channel ID they can see the payloads being sent" (https://github.com/probot/smee.io).
  - It can be self-hosted (`docker run -p 3000:3000 ghcr.io/probot/smee.io`, with `REDIS_URL` for multiple instances).
  - The public instance is unacceptable for a public repo's PR traffic. A self-hosted instance plus the webhook secret is viable [inferred].
- **Tailscale Funnel** (https://tailscale.com/kb/1223/funnel):
  - "Funnel can only listen on ports 443, 8443, and 10000", "only works over TLS-encrypted connections", and only on names in `tailnet-name.ts.net`.
  - It is "currently in beta", "available for all plans", and "subject to non-configurable bandwidth limits".
  - This lets one always-on host (for example the hub) receive GitHub App or repo webhooks directly, with no third-party relay [inferred].
- **GitHub App webhooks.** The events an App can subscribe to "are determined by the type of permissions" it has, and the secret should be "a random string of text with high entropy" (https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps).
- **Recommended shape** [inferred]:
  1. One receiver on one host, using Funnel or a self-hosted smee.
  2. Verify `X-Hub-Signature-256` and dedupe on `X-GitHub-Delivery`.
  3. Write events to the shared snapshot or Yeet inbox.
  4. A per-hour catch-up job reconciles over deliveries ≤ 3 days old.
  5. Polling stays as a slow fallback, not the primary path.
- **Disposition:** reference-only (we compose services, we port no code).

### 5. Other bots that solved "many bots, one quota"

- **Mergify** (https://articles.mergify.com/handling-300k-github-events-per-day):
  - "Every event is dispatched in its own organization stream, and a particular stream is consumed by only one worker." This serializes API calls per org, and the worker "can retrieve multiple events at the same time to batch them".
  - The post reports "We globally reduced the number of GitHub API calls by 4, and even by 20 for large organizations" (read as factors), and says the load was handled "without reaching any rate limit or abuse anymore".
  - The engine's current license is unverified.
  - Take: one consumer per budget, with event batching.
  - Disposition: reference-only.
- **Bors-NG** (Apache-2.0; https://github.com/bors-ng/bors-ng):
  - Its setup subscribes the App webhook to events including Status and Check run, which implies it is webhook-driven. The README does not say so outright.
  - It was **archived 2024-04-04**. The README says: "If you want to implement a workflow like this, use GitHub's built-in merge queue."
  - Take: the merge-gate's armed-PR loop does the same job as GitHub's native merge queue [inferred]. Evaluate the merge queue before building more merge-gate polling.
  - Disposition: reference-only.
- **Renovate** (**AGPL-3.0-only**, per its `license` file and `package.json`; https://github.com/renovatebot/renovate):
  - "The `ETag` from the cached result is used in new requests. If the upstream server returns a `304 Not Modified` response, the cached data is revalidated and used." `httpCacheTtlDays` defaults to 90.
  - `cacheHardTtlMinutes` (default 10080, experimental) acts as a stale-if-error window: "If an upstream request fails, Renovate can still use stale data from the cache as long as its hard TTL has not expired" (https://docs.renovatebot.com/self-hosted-configuration/).
  - First-page-ETag reuse of whole paginated lists: **unverified, and not what current upstream does**. In `lib/util/http/github.ts` on `main`, a paginated request drops `cacheProvider` after the first page, so only page 1 goes through the ETag cache and later pages are re-fetched.
  - `repositoryCacheType` set to an S3 URI enables an S3-backed **repository** cache (extracted dependencies). It is not used as the HTTP or lookup cache.
  - Take: ETag revalidation with stale-if-error.
  - Disposition: **clean-room** (copyleft).

### Synthesis for the redesign candidates

| Candidate | Strongest prior art | Verdict |
|---|---|---|
| ETag layer in `makeOctokit` | ghcache revalidate-always; octokit 304 throws; quoted ETag | Do it at the `fetch` seam, partitioned per token (lineage-keyed, with one full 200 per resource per rotation), with GraphQL and errors no-store |
| One poller per PR + shared snapshot | ghcache coalescing; Mergify one consumer per org; Tide search | Strongly supported; "one reader per fact" is the industry pattern |
| REST budget ledger | ghcache free/paid cache modes; plugin-throttling Redis `id` sharing; ghproxy per-budget queues + max-delay | Record cost per response from cache mode plus `x-ratelimit-*`, treating remaining counts as approximate (per the platform review) |
| One GraphQL query per poll | Tide GraphQL search; ghcache no-store for v4 | No 304 path for GraphQL, so this saves calls but never makes them free. Measure `rateLimit{cost}`, and handle 200-bodied primary and secondary limit errors |
| Webhooks into the Yeet inbox | GitHub guidance; Mergify; Bors | One receiver (Funnel or self-hosted smee) + 3-day redelivery reconciler; `gh webhook forward` is a single-holder dev tool, not a fleet route |
| Merge-gate | Bors deprecated in favour of the native merge queue | Evaluate the GitHub merge queue before tuning merge-gate polling |

**Verifier notes**

- **ghcache partitioning (corrected).** The original merged two keys. The cache partition is always `sha256(Authorization)` (`partitioner.go`), and the `X-PROW-GHCACHE-TOKEN-BUDGET-IDENTIFIER` header only picks the throttling and metrics budget. I added that the Redis backend does not partition, and that coalescing works per partition.
- **"GitHub's ETag depends on Authorization" (re-attributed).** Prow does not state this. It comes from bored-engineer's README, which calls it undocumented and reverse-engineered.
- **ghcache `no-store` scope (made exact).** The code applies it to status ≥ 400 and to any request whose path starts with `/graphql`. I added GitHub's caveat that a 304 is free only on a correctly authorized request.
- **Cache modes (corrected).** I listed the real header values, and noted that `ModeError` is internal and never sent in the header.
- **Throttling (corrected).** Queues are not split by GET and non-GET. There is one queue per budget per API version, and GETs only get different spacing. I added the example config's max delays (45 s and 110 s) and the rule that throttling is off unless both base flags are set. The semaphore and the extra metrics come from the code, not the docs.
- **plugin-throttling (two additions).**
  - The 200-with-`RATE_LIMITED` coverage is confirmed in `wrap-request.ts`, but a GraphQL secondary limit returned as 200 is not caught.
  - All GraphQL requests, reads included, go through the 1 s write group.
  - The search group is maxConcurrent 1 with minTime 2000 ms.
- **plugin-retry 429.** No longer an inference: `src/error-request.ts` retries any status ≥ 400 that is not on `doNotRetry`, with a squared backoff that ignores `retry-after`.
- **octokit issue #2563 (corrected).** The confirmation comes from a "Contributor" (gr2m), not a maintainer. I also confirmed that the repo's installed `@octokit/request` 10.0.16 throws on 304.
- **Repo code citation.** `octokit.ts:240-248` is confirmed: bare `@octokit/core` with only `plugin-paginate-rest`, and `request.fetch` injection.
- **bored-engineer (corrected).** The storage backends are bbolt, memory, pebble, redis and s3, not just bbolt, redis and s3. The "hourly rotation" wording is quoted, and the license is confirmed MIT (2025).
- **security-alliance plugin.** The registry data is confirmed: MIT, 101 downloads last month.
- **go-gh.** I added `X-GH-CACHE-DIR`, the `/api/graphql` path, the 24 h default TTL and the wiring through `cli/cli` `api/http_client.go`. The `gh pr view`/`gh pr checks` claim is now marked (unverified).
- **gh-webhook.** The MIT license is confirmed from the repo's `LICENSE.md`; there is no `LICENSE` file. I added the 5 s reconnect delay, and the docs quote now says one forwarder "for each repository and organization".
- **Mergify.** The "4x/20x" reading is mine: the article says "by 4 … by 20" without a unit.
- **Bors.** Being webhook-driven is implied by its event setup, not stated in the README. The archive date and merge-queue notice are confirmed.
- **Renovate (corrected).** The first-page-ETag paginated-list reuse is marked unverified and contradicted by current upstream, which caches only page 1. I removed "take: first-page revalidation". `cacheHardTtlMinutes` is quoted with its default of 10080, and the S3 backend is narrowed to the repository cache only. The AGPL-3.0-only license is confirmed.
- **Other labels.** Inferred conclusions are now labelled [inferred]: the redelivery-cost claim, smee viability, the Funnel use, and the Bors-to-merge-queue mapping.
- **Confirmed without change.** ghproxy description and fallback; ghcache revalidate-always quotes; Tide GraphQL search and the ghproxy advice; the GitHub best-practices quotes; App webhook permissions and secret guidance; Tailscale Funnel facts; the smee dev-only, unauthenticated and self-host facts; smee-client ISC; the Apache-2.0 and MIT licenses.