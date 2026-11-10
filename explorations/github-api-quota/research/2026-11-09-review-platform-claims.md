## GitHub platform claims in the plan, checked against docs.github.com (2026-11-09)

The pages were fetched through the docs body API (`docs.github.com/api/article/body?pathname=…`) and saved as Markdown under `<session scratchpad>`. Two other sources were also used: the published GraphQL schema (`docs.github.com/public/fpt/schema.docs.graphql`) and the gh manual on cli.github.com. I made no calls to `api.github.com`.

Source abbreviations used below:
- RL = https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- GQL = https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api
- BP = https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
- APP-PERMS = https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps
- PAT-PERMS = https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens

### Section 1: buckets and limits

1. **Confirmed.** PATs, gh OAuth tokens and fine-grained PATs share one user bucket of 5,000 REST requests per hour and 5,000 GraphQL points per hour. Sources: RL ("All of these requests count towards your personal rate limit of 5,000") and GQL ("5,000 points per hour per user").
2. **Confirmed.** A GitHub App user-to-server token draws on the user's bucket and is pooled with PATs and with other apps acting for that user. Sources: RL ("combined with any requests that another GitHub App or OAuth app makes on that user's behalf") and GQL. One addition: if the App were owned by a GitHub Enterprise Cloud (GHEC) org, its limit would be 15,000, but its requests still reduce the user's 5,000 PAT budget (RL).
3. **Confirmed.** OAuth app user tokens draw on the user's bucket (RL, "Primary rate limit for OAuth apps").
4. **Confirmed.** An installation token has its own bucket with a minimum of 5,000 REST per hour and 5,000 GraphQL points per hour. On GHEC the figures are 15,000 REST and a flat 10,000 GraphQL. Sources: RL ("Primary rate limit for GitHub App installations") and GQL.
5. **Confirmed, but the plan's tag should change.** Each installation has its own bucket. GQL says "5,000 points per hour **per installation**" outright, so the plan's "[inferred]" for counting beep-fleet-orchestrator and beep-reviewer as two separate buckets should become **[doc]** (GQL).
6. **Confirmed, with an ambiguity.** The scaling rules are +50 per repo above 20 repos, +50 per user for orgs above 20 users, and a cap of 12,500. Sources: RL and GQL. The docs say "another 50 … for each repository", which does not say whether the bonus counts all repos or only those past 20. This makes no difference for a 1-repo install. The org-user bonus does apply to a 1-repo install if the `beep-effect` org has more than 20 members, so the plan should check the member count rather than assume a flat 5,000.
7. **Confirmed, with a correction.** The REST limit for `GITHUB_TOKEN` is 1,000 per hour per repository, or 15,000 for resources in a GHEC account. Its GraphQL limit is 1,000 points per hour per repo (RL, GQL). **Correction for H7 and O6:** the plan proposes running a 1,000–3,000-call census as a `workflow_dispatch` job. That cannot fit in a 1,000-per-hour bucket, and that bucket is also shared with every other workflow in the repo. Moving censuses to Actions is not viable unless the census first drops below about 1,000 calls.
8. **Confirmed, with one omission.** The secondary limits are 100 concurrent requests (shared by REST and GraphQL), 900 points per minute per REST endpoint, 2,000 points per minute for GraphQL, and 80 content-creating requests per minute or 500 per hour (RL, GQL). The plan leaves out a CPU-time limit: no more than 90 s of CPU per 60 s of real time, of which at most 60 s may be GraphQL. Large batched GraphQL queries (S6) are the traffic most likely to hit it. Note also that a GraphQL query without mutations costs 1 secondary point whatever its primary cost.
9. **Confirmed as unsupported, so the plan's "[uncertain]" is correct.** The docs never say whether secondary limits are keyed to a user, a token or an App. RL also says "There is not a way to check the status of your secondary rate limit."
10. **Confirmed as unsupported, so "[uncertain]" is correct.** RL says "No more than 2,000 OAuth access token requests per hour are allowed for GitHub Apps and OAuth apps." It does not say whether installation-token mints (`POST /app/installations/{id}/access_tokens`) count toward this.
11. **Confirmed.** Installation tokens expire after 1 hour, which supports S8's mint-once-per-hour cache. Source: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app
12. **Confirmed.** `GET /rate_limit` does not count against the primary limit but can count against the secondary limit (RL).

### Section 1: permissions

13. **Confirmed.** `GET /repos/{o}/{r}/rulesets/{id}/history` needs Administration: **write** for fine-grained PATs and for both user-to-server and installation tokens (PAT-PERMS, APP-PERMS).
14. **Confirmed.** `GET /repos/{o}/{r}/rulesets/rule-suites` needs Administration: **read** (PAT-PERMS, APP-PERMS). One caution: the org-level `GET /orgs/{org}/rulesets/rule-suites` needs Administration: **write**.
15. **Confirmed.** `GET …/rulesets` and `GET …/rulesets/{id}` need Metadata: read (PAT-PERMS, APP-PERMS).
16. **Partly confirmed, partly unsupported.** Pushing workflow files needs the Workflows permission. APP-PERMS lists the contents PUT/DELETE and git refs POST/PATCH endpoints under "Workflows", and https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app says to request Workflows "to access or edit Actions files in .github/workflows". **Merging** is not covered: `PUT /pulls/{n}/merge` appears only under Contents: write. The claim that merging a workflow-touching PR needs Workflows is therefore an observed behaviour (the 11-03 memory note), not a documented rule. Label it as such.
17. **Confirmed.** Only GitHub Apps can create or update check runs. OAuth apps and users can only read. Source: https://docs.github.com/en/rest/checks/runs ("Write permission … is only available to GitHub Apps").
18. **Confirmed, with an addition.** A classic PAT needs the `repo` scope to read check runs on a private repo (same page). **Addition:** PAT-PERMS has no Checks section and lists no check-runs or check-suites endpoint, so fine-grained PATs are not documented to have REST Checks access at all. Hosts that use fine-grained PATs should not be assumed able to call the REST check-runs endpoints.
19. **Incomplete.** The plan's list of read permissions for the App's pollers misses **Commit statuses: read**, which is needed for commit statuses / StatusContext reads and for the `status` webhook (APP-PERMS; https://docs.github.com/en/webhooks/webhook-events-and-payloads#status). Completion evidence also needs Administration: read for rule-suites.

### Section 2: rate-limit behaviour, conditional requests and polling

20. **Confirmed.** An authorized request that returns 304 does not count against the primary limit (BP, "Use conditional requests"). This is documented for any request carrying a correct `Authorization` header, so the plan's "App-specific exemption [inferred]" should become **[doc]**.
21. **Unsupported, so "[uncertain]" stands.** The docs say nothing about whether a 304 costs secondary points. RL's points table charges "Most REST API GET … 1" with no 304 exception, so plan as if each 304 still uses 1 secondary point and one concurrency slot.
22. **Confirmed, so drop "[inferred]".** A moving `since` watermark defeats ETags. BP says: "Use the same parameters every time you poll … A different page size, page number, or filter produces a different response with a different etag." BP also warns that `sort=updated` reshuffles pages and that small, filtered requests produce more 304s.
23. **Confirmed, so drop "[inferred]".** GraphQL has no 304 path. GraphQL calls are `POST` (https://docs.github.com/en/graphql/guides/forming-calls-with-graphql), and BP says conditional requests for POST "are not supported unless otherwise noted".
24. **Confirmed.** Clients should honour `x-poll-interval`, `retry-after` and `x-ratelimit-reset` (BP; RL "Exceeding the rate limit").
25. **Incomplete, with corrections for S3 and S9.**
    - Primary-limit failures come back as 403 **or 429** (RL), so handle both.
    - A **GraphQL** request over the primary limit returns HTTP **200** with an error in the body, and a GraphQL secondary-limit hit returns 200 or 403 (GQL). A guard that only looks at HTTP status will miss these.
    - On a secondary limit without `retry-after`, wait at least 1 minute and then back off exponentially (RL).
    - RL warns that `x-ratelimit-remaining` varies by region and can go up within a window, and it says to "avoid logic that depends on an exact remaining count". S9's shared ledger should treat values as approximate and leave margin below the floor.
26. **Confirmed.** `GET /pulls/{n}/reviews` takes only `per_page` and `page`, with no `since` (https://docs.github.com/en/rest/pulls/reviews). This supports H3. Review comments and issue comments both accept `since` (https://docs.github.com/en/rest/pulls/comments, https://docs.github.com/en/rest/issues/comments).
27. **Confirmed.** The S4 fields exist in the GraphQL schema: `isRequired(pullRequestId:, pullRequestNumber:)` on CheckRun and StatusContext, `PullRequest.mergeStateStatus: MergeStateStatus!` (no preview notice), and `statusCheckRollup`. Source: https://docs.github.com/public/fpt/schema.docs.graphql
28. **Confirmed, with a correction for S6.** `first`/`last` must be between 1 and 100, and a call may request at most 500,000 nodes (GQL "Node limit"). **Correction:** the "about 2 points" figure only holds for shallow queries. Primary cost is the total of connection requests divided by 100, and nested connections multiply. For example, PRs(first:100) × reviewThreads(first:100) × comments is roughly 10,100 requests, or about 100 points per call. Measure the real cost with `rateLimit { cost }` (GQL) before claiming the 2–5 point figure.
29. **Refuted (H8).** The plan says to use "`time_period=day` around the merge timestamp". `time_period` only takes `hour`, `day`, `week` or `month`, and each means a window counted back from **now** ("day … past 24 hours"). It cannot be anchored to a merge time, so `day` misses any merge older than 24 hours. **Correction:** filter with `ref=refs/heads/main`, plus `actor_name` and `rule_suite_result` where they fit, and choose the smallest period that still covers the merge's age. Source: https://docs.github.com/en/rest/repos/rule-suites

### Section 2: webhooks and the Events API (S7)

30. **Confirmed.** Webhook receivers must reply within 10 s. Redelivery keeps the same `X-GitHub-Delivery` value, which makes it a usable idempotency key. Source: https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks
31. **Confirmed, with a correction.** On redelivery after downtime, the plan reads as though GitHub retries. "GitHub does not automatically redeliver failed deliveries", and redelivery only covers the past **3 days**. The receiver has to run its own catch-up through the deliveries API. Source: https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/redelivering-webhooks
32. **Unsupported as stated, with indirect support.** No page says webhook deliveries cost no API quota. BP and GQL do say to "subscribe to webhook events instead of polling … This will help your integration stay within the API rate limit." Keep it labelled "[inferred], with doc support for the recommendation".
33. **Confirmed, with corrections to the event list.** `review` should be `pull_request_review` and `review_thread` should be `pull_request_review_thread`. The list leaves out **`pull_request_review_comment`**. Repo and org webhooks only receive `check_run` created/completed and `check_suite` completed. An App gets the full set with Checks read (more actions need Checks write). `status` needs Commit statuses read and `workflow_run` needs Actions read. Source: https://docs.github.com/en/webhooks/webhook-events-and-payloads
34. **Refuted (S7's interim poller on `/repos/{o}/{r}/events` with ETag).** ETag 304s on that endpoint are free and it sends `X-Poll-Interval` (usually 60 s). Even so, it is not a usable stand-in, for three reasons:
    - The docs say: "This API is not built to serve real-time use cases … event latency can be anywhere from 30s to 6h."
    - The timeline holds at most 300 events from the last 30 days.
    - It has no event types for check runs, check suites, workflow runs, statuses or review-thread resolution. The types listed are CommitComment, Create, Delete, Discussion, Fork, Gollum, IssueComment, Issues, Member, Public, PullRequest, PullRequestReview, PullRequestReviewComment, Push, Release and Watch.

    It cannot detect CI completion or merge-readiness. Sources: https://docs.github.com/en/rest/activity/events and https://docs.github.com/en/rest/using-the-rest-api/github-event-types

### gh CLI claims (not on docs.github.com)

35. **Unsupported.** The claim that gh makes a RepositoryNetwork GraphQL lookup on every spawn when there is no `gh-resolved` (H2/O1) does not appear in any GitHub doc. The gh manual does document `gh repo set-default` ("sets the default remote repository to use when querying the GitHub API") and `GH_REPO` ("specify the GitHub repository in the [HOST/]OWNER/REPO format for commands that otherwise operate on a local repository"), so the fix itself is valid. The saving depends on the unverified per-spawn cost, so keep it "[inferred]" until a `GH_DEBUG=api` trace confirms it. Sources: https://cli.github.com/manual/gh_repo_set-default, https://cli.github.com/manual/gh_help_environment
36. **Unsupported.** No GitHub doc states that `gh pr checks` and `gh pr view` use GraphQL; that is a gh implementation detail. The same goes for "octokit retries 4 times per call", which is library behaviour and not a platform claim.

### Net changes to the plan

- **Raise to [doc]:** per-installation buckets (#5), the 304 exemption for any authorized request including Apps (#20), `since`/parameter changes defeating ETags (#22), and no 304 for GraphQL (#23).
- **Fix:**
  - H8: `time_period` is a lookback from now (#29).
  - H7/O6: `GITHUB_TOKEN` allows only 1,000/h per repo (#7).
  - S7: drop the Events API poller (#34), redeliver manually within 3 days (#31), and correct the event names (#33).
  - S6: recompute nested query costs (#28).
  - S3/S9: handle 429 and GraphQL rate-limit errors returned as HTTP 200, and do not rely on exact `remaining` counts (#25).
  - Add the CPU-time secondary limit (#8) and Commit statuses: read (#19).
  - Treat "merging needs Workflows" as observed, not documented (#16).
  - Fine-grained PATs have no documented REST Checks access (#18).
- **Keep as uncertain:** how secondary limits are keyed (#9), whether installation-token mints count toward the 2,000/h limit (#10), the secondary-point cost of a 304 (#21), webhook quota cost (#32) and the gh per-spawn lookup (#35).