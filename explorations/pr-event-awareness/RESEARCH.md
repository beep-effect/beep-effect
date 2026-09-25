# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

Read [`CAPTURE.md`](./CAPTURE.md) and [`research/SOURCES.md`](./research/SOURCES.md)
first. This file is the 2026-09-24 pass: four external topics, four in-repo
areas, the harness surface the orchestrator can see from a session, the first
end-to-end measurement of the current path, and the binding-gap verdict the
packet's Next Open Question asked for.

Every external claim below survived an independent verifier pass against its
cited source; claims that failed verification are omitted and listed in the
research handoff, not here. Corrections are folded in rather than footnoted.

## External Landscape (2026-09-24)

### 1. GitHub webhooks as a push source

**Event coverage is finer than the capture assumed, and one event maps 1:1 onto
a transition Yeet currently derives by polling.**

- Review-diff comments arrive as `pull_request_review_comment`
  (created/deleted/edited), needing read access to "Pull requests"
  ([events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request_review_comment)).
- Plain PR conversation comments are **not** a `pull_request*` event: they
  arrive as `issue_comment`, gated on **Issues** read, so a receiver
  subscribed only to `pull_request*` misses them
  ([issue_comment](https://docs.github.com/en/webhooks/webhook-events-and-payloads#issue_comment)).
- Review submissions are `pull_request_review`
  (submitted/edited/dismissed)
  ([pull_request_review](https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request_review)).
- Thread resolution has its own event: `pull_request_review_thread`
  (`resolved`/`unresolved`, payload carries `pull_request` + `thread`) — the
  exact signal `thread-transition` is currently diffed out of a GraphQL poll
  ([pull_request_review_thread](https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request_review_thread)).
- A new push to a PR head is `pull_request` action `synchronize`, defined as
  "A pull request's head branch was updated", including from the base branch
  ([OpenAPI description](https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.yaml)).
- Base-branch movement is visible only through `push` (read **Contents**),
  whose payload carries `ref`, `before`, `after`, `forced`, `created`,
  `deleted` ([push](https://docs.github.com/en/webhooks/webhook-events-and-payloads#push)).
  Branch selection is receiver-side: a hook's whole `config` surface is
  url / content_type / secret / insecure_ssl, and `events` takes event names
  only — there is no ref or branch filter
  ([create a repository webhook](https://docs.github.com/en/rest/repos/webhooks#create-a-repository-webhook)).
  The same page's `push` section also notes events are not created when more
  than 5000 branches are pushed at once.

**CI granularity is asymmetric between App and repository webhooks.**

- `check_run` reaches repository/organization webhooks for `created` and
  `completed` **only**; `rerequested` and `requested_action` are App-only
  ([check_run](https://docs.github.com/en/webhooks/webhook-events-and-payloads#check_run)).
  A repository hook therefore cannot observe a rerun request, so the
  flake-rerun loop still needs REST.
- `check_suite` reaches repository webhooks for `completed` only
  ([check_suite](https://docs.github.com/en/webhooks/webhook-events-and-payloads#check_suite)).
- Per-job transitions come from `workflow_job`
  (queued / in_progress / completed / waiting), per-run from `workflow_run`,
  both on read **Actions**
  ([workflow_job](https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_job)).
- Legacy non-Checks contexts need the separate `status` event
  ([status](https://docs.github.com/en/webhooks/webhook-events-and-payloads#status)).

**Conflicts cannot be pushed. This is the single most load-bearing external
fact in the packet.**

- No webhook event reports mergeability. GitHub's own documented recipe is
  push-then-poll: receive the `pull_request` webhook, call
  `GET /repos/{owner}/{repo}/pulls/{n}` to start the background merge job,
  then poll that endpoint until `mergeable` is non-null
  ([checking mergeability](https://docs.github.com/en/rest/guides/getting-started-with-the-git-database-api#checking-mergeability-of-pull-requests)).
- `mergeable` is lazily computed: "If the value is null, then GitHub has
  started a background job to compute the mergeability. After giving the job
  time to complete, resubmit the request."
  ([get a pull request](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request)).
  The read itself schedules the recomputation, so a conflict is visible only
  on the poll after the job finishes.
- Merge refs go stale unless a client asks: a test merge commit is created
  only when the PR is viewed in the UI or get/create/edit is called via REST,
  so a webhook-only pipeline never sees fresh mergeability
  ([same page](https://docs.github.com/en/rest/guides/getting-started-with-the-git-database-api#checking-mergeability-of-pull-requests)).
- Anthropic states the same limit from the product side: "GitHub does not emit
  a webhook when the base branch advances and creates a merge conflict, so
  auto-fix can't react to conflicts on its own."
  ([auto-fix pull requests](https://code.claude.com/docs/en/claude-code-on-the-web)).
- REST `mergeable_state` is an undocumented free string (`type: string`,
  `example: clean`, no enum)
  ([OpenAPI description](https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.yaml)).
  The enumerated domain exists only in GraphQL: `MergeStateStatus` has **8**
  values — DIRTY, UNKNOWN, BLOCKED, BEHIND, DRAFT (deprecated, "Removal on
  2021-01-01 UTC"), UNSTABLE, HAS_HOOKS, CLEAN — and `MergeableState` is
  MERGEABLE / CONFLICTING / UNKNOWN
  ([GraphQL pulls reference](https://docs.github.com/en/graphql/reference/pulls)).
  A schema-first consumer that codegens off the public schema sees 8, not 7.

**Receiver contract and failure modes.**

- 2XX within 10 seconds or the delivery is recorded as failed; queue and
  process asynchronously
  ([best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks#respond-within-10-seconds)).
- "GitHub does not automatically redeliver failed deliveries." Catch-up is the
  consumer's job, via the UI or a scheduled script over the deliveries API
  ([handling failed deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries)).
- Delivery order is explicitly not guaranteed — the docs carry a section
  titled "Webhooks deliveries are out of order" and direct consumers to
  payload timestamps
  ([troubleshooting](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/troubleshooting-webhooks#webhooks-deliveries-are-out-of-order)).
  A per-head fold must be commutative, not sequential.
- Redelivery reuses the original `X-GitHub-Delivery` GUID, and the delivery
  record carries a `redelivery` boolean
  ([best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks#use-the-x-github-delivery-header)).
  The OpenAPI description is stronger still: a delivery `guid` is "shared with
  all deliveries for all webhooks that subscribe to this event", so a GUID is
  not unique per hook and `(guid, redelivery)` is a weaker dedupe key than it
  looks.
- Delivery history is 3 days deep, which bounds any catch-up window after a
  receiver outage
  ([viewing deliveries](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/viewing-webhook-deliveries)).
- Each delivery record exposes `duration`, `status`/`status_code`,
  `redelivery`, `event`/`action`, and `throttled_at` — so GitHub does throttle
  and the throttle is observable per delivery
  ([deliveries API](https://docs.github.com/en/rest/repos/webhooks#list-deliveries-for-a-repository-webhook)).
- Payloads are capped at 25 MB and an oversize event is simply not delivered —
  a silent hole no retry recovers
  ([payload cap](https://docs.github.com/en/webhooks/webhook-events-and-payloads#payload-cap)).
- A webhook URL cannot be `localhost` or `127.0.0.1`
  ([troubleshooting](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/troubleshooting-webhooks#url-host-localhost-is-not-supported)).
- Validation is `X-Hub-Signature-256`: HMAC-SHA256 hex digest of the raw body
  prefixed `sha256=`, constant-time compared, payload handled as UTF-8, with a
  published test vector
  ([validating deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)).
- Repository webhooks need owner/admin; org webhooks need org owner; a
  GitHub App has exactly one GitHub-created webhook; limit is 20 hooks per
  event type ([types of webhooks](https://docs.github.com/en/webhooks/types-of-webhooks)).
  Fine-grained PAT "Webhooks" write creates a hook and posts a redelivery
  attempt, read lists deliveries; plain `repo` already covers repository hooks
  ([fine-grained PAT permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens#repository-permissions-for-webhooks)).
- No end-to-end latency figure or SLA is published; the only vendor claim is
  qualitative ("near real-time"), plus a troubleshooting note that delivery
  and the delivery log can lag minutes
  ([about webhooks](https://docs.github.com/en/webhooks/about-webhooks#choosing-webhooks-or-the-rest-api)).
  Any seconds-level target has to be measured, which §4 does.

**`gh webhook forward` is a real first-party extension and a poor daemon.**

- Install `gh extension install cli/gh-webhook`; repository and organization
  webhooks only; and GitHub states outright: "Webhook forwarding is only
  designed for use during testing and development. It is not supported for use
  in production environments for handling live webhooks."
  ([forwarding for testing](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/using-the-github-cli-to-forward-webhooks-for-testing)).
- Exactly one forwarder per repository or organization at a time; a second
  attempt errors `Hook already exists` — two sibling checkouts cannot both
  forward (same page).
- Mechanism, read from source: it POSTs a hook with `Name: "cli"`,
  `Active: false`, takes `ws_url` from the response, dials that websocket with
  the gh token, then PATCHes the hook active; each frame's headers are copied
  onto the local POST, so signature verification still works behind it
  ([create_webhook.go](https://github.com/cli/gh-webhook/blob/main/webhook/create_webhook.go),
  [forward.go](https://github.com/cli/gh-webhook/blob/main/webhook/forward.go)).
  This is off-contract: the public REST docs say `name` "only accepts the value
  web", and `ws_url` appears nowhere in the OpenAPI description
  ([create a repository webhook](https://docs.github.com/en/rest/repos/webhooks#create-a-repository-webhook)).
- It has a live reliability defect: the read error is wrapped with
  `fmt.Errorf` while the retry gate uses `websocket.IsCloseError`, which does
  not unwrap, so the 1006 reconnect never fires and the command exits on the
  first server disconnect; a reporter observes GitHub closing the socket about
  every five minutes, and the fix PR is open and unmerged
  ([issue #43](https://github.com/cli/gh-webhook/issues/43)). The retry counter
  is never reset either, so even with the unwrap fixed the forwarder exits
  permanently after three closes. Licence MIT, latest release v0.2.0
  ([cli/gh-webhook](https://github.com/cli/gh-webhook)); the extension contains
  no DELETE, so a forwarding hook is left behind (only patched to inactive).

**Relay and tunnel options, with the disqualifiers stated by their own docs.**

- `smee.io`: MIT server, ISC client, but "channels are **not** authenticated,
  so if someone has your channel ID they can see the payloads being sent" and
  "Smee.io is intended for use in development, not for production."
  ([probot/smee.io](https://github.com/probot/smee.io)).
- Tailscale Funnel: BSD-3-Clause client, beta, all plans, ports 443/8443/10000
  only, TLS-only, requires a `funnel` node attribute in the tailnet policy
  file, automatic HTTPS certs, non-configurable bandwidth limits, and a
  Let's Encrypt rate-limit caveat with waits up to 34 hours
  ([KB 1223](https://tailscale.com/kb/1223/funnel)). A Funnel endpoint is
  publicly reachable, so the receiver must verify the HMAC itself.
- cloudflared is Apache-2.0; a quick tunnel needs no account but is "intended
  for testing and development only", caps at 200 in-flight requests (HTTP 429
  beyond), does not support Server-Sent Events, and carries no SLA. A named
  tunnel is the production form
  ([TryCloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)).
- ngrok free: 3 online endpoints, 1 GB transfer, 20k HTTP/S requests, 4k
  requests/min, interstitial page, no static domain
  ([pricing](https://ngrok.com/pricing)); the agent has no public source
  repository, the Go SDK is MIT.
- Webhook Relay free: 150 webhooks/month, 2 destinations, buckets suspended
  past the cap ([pricing](https://webhookrelay.com/pricing/)) — roughly one
  busy PR day, given that one push in this repo produced about twenty check
  events (`CAPTURE.md:31`).
- GitHub's own documented private-system paths are a reverse proxy (nginx), an
  API gateway, OpenZiti, ngrok, or zrok, with inbound restricted to the `hooks`
  ranges from `GET /meta` and signature validation at the proxy or the app
  ([delivering to private systems](https://docs.github.com/en/webhooks/using-webhooks/delivering-webhooks-to-private-systems)).
  Hookdeck is named for async queueing on the 10-second-ack pages, not there
  ([best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks#respond-within-10-seconds)).

**Local preconditions (2026-09-24).** The repo is `beep-effect/beep-effect`
(an Organization); `kriegcloud/beep-effect` resolves only through GitHub's
rename redirect and `kriegcloud` is a User account. The signed-in token has
repo admin and scopes `admin:org, gist, repo, workflow`, so `repo` already
permits creating a repository hook; organization-scope forwarding would need
`gh auth refresh --scopes admin:org_hook`, and `gh api orgs/beep-effect/hooks`
returns 404 plus a missing-`admin:org_hook` notice today. `gh` is 2.101.0 and
`cli/gh-webhook` is not installed
([list repository webhooks](https://docs.github.com/en/rest/repos/webhooks#list-repository-webhooks)).

### 2. Polling economics

**Conditional requests make the REST half of a poll free, and the docs now say
so with a precondition the capture predates.**

- "Making a conditional request does not count against your primary rate limit
  if a `304` response is returned and the request was made while correctly
  authorized with an `Authorization` header."
  ([best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#use-conditional-requests)).
  The `Authorization` qualifier was added 2025-05-06
  ([commit 10928975](https://github.com/github/docs/commit/10928975)) and the
  whole efficient-polling/caching section landed 2026-07-27
  ([commit 29d8e509](https://github.com/github/docs/commit/29d8e509)) — about
  six weeks **before** this packet's 2026-09-12 capture, so the current
  best-practice text was already available when the capture was written.
- Measured live: eight consecutive conditional GETs of a PR object returned
  304 with `x-ratelimit-used` frozen, while plain GETs incremented +1 each.
- Every REST endpoint a PR watcher needs returns a weak ETag — PR object,
  `commits/{sha}/check-runs`, `commits/{sha}/status`, `issues/{n}/comments`,
  `/notifications`, repo events — and check-runs/status/notifications also
  carry `Cache-Control: private, max-age=60`
  ([best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#use-conditional-requests)).
- GraphQL has **no** 304 path: the endpoint returns no ETag, Last-Modified or
  Cache-Control, and conditional requests for unsafe methods including POST
  "are not supported unless otherwise noted". Every GraphQL poll costs at
  least 1 point (same page).

**Budgets.** REST: 60/hr unauthenticated, 5,000/hr per user, App installation
5,000/hr minimum with +50/hr per repository above 20 and +50/hr per user above
20, capped at 12,500/hr; `GITHUB_TOKEN` 1,000/hr per repository
([REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)).
GraphQL: 5,000 points/hr per user, same installation scaling, cost = requests
needed for every connection divided by 100, minimum 1 point per call
([GraphQL limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)).
For this org a GitHub App buys **bucket isolation, not headroom**: `beep-effect`
is plan `free` with 5 repositories and 1 member, so an installation token lands
on the flat 5,000/hr floor (scaling needs >20 repos or >20 users)
([installation limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#primary-rate-limit-for-github-app-installations)).
Secondary limits are shared: 100 concurrent requests, 900 REST points/min,
2,000 GraphQL points/min, 90 s CPU per 60 s real time, "subject to change
without notice", and "There is not a way to check the status of your secondary
rate limit"
([secondary limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#about-secondary-rate-limits)).

**Instrument from the headers, not the endpoint.** The docs now say the
`x-ratelimit-*` response headers are authoritative and to "treat the response
headers as authoritative if the two disagree"
([checking rate limit status](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#checking-the-status-of-your-rate-limit)).
Measured disagreement, back to back on 2026-09-24: `GET /rate_limit` reported
the GraphQL bucket at used=9 while a GraphQL call in the same minute reported
`X-Ratelimit-Used: 894` and the in-query `rateLimit` object agreed with the
header — an 885-point blind spot
([rate limit endpoint](https://docs.github.com/en/rest/rate-limit/rate-limit)).

**The poll can be 10x cheaper before any protocol change.** One GraphQL
document returns everything the watcher needs — `mergeable`,
`mergeStateStatus`, `reviewDecision`, `isDraft`, `headRefOid`, labels,
`reviewThreads(first:100){isResolved,resolvedBy,comments(last:1)}`, and
`commits(last:1){statusCheckRollup{contexts(first:100){… isRequired(pullRequestNumber:)}}}`
— measured three times at **cost=1, nodeCount=321**, 0.79–0.94 s warm, 39
contexts of which 17 required, threads on one page
([point value of a query](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api#returning-the-point-value-of-a-query)).
`isRequired(pullRequestNumber:)` removes the need for the separate
`--required` read. Node limits are nowhere near: `first`/`last` required and
bounded 1–100, 500,000 nodes per call, and a >10 s request is terminated with
502/504 plus extra points deducted for the next hour
([node limit](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api#node-limit)).

**Neither documented feed API can serve seconds-scale PR awareness.**

- Events: `X-Poll-Interval` documented and live at 60 s, 304s free, but "This
  API is not built to serve real-time use cases. Depending on the time of day,
  event latency can be anywhere from 30s to 6h", with a 300-event / 30-day
  window ([events](https://docs.github.com/en/rest/activity/events)). The
  documented type list has no CheckRun, CheckSuite, Status or
  PullRequestReviewThread type
  ([event types](https://docs.github.com/en/rest/using-the-rest-api/github-event-types)),
  and a live census of this repo's feed returned zero check/status rows.
- Notifications: 60 s `X-Poll-Interval`, free `Last-Modified` polling, a
  documented `reason` taxonomy (review_requested, mention, comment, author,
  subscribed, state_change, ci_activity, …), and thread/subscription endpoints
  ([notifications](https://docs.github.com/en/rest/activity/notifications)).
  Three disqualifiers: the endpoints "only support authentication using a
  personal access token (classic)" — no App or fine-grained token, so bucket
  isolation and notifications are mutually exclusive; a thread object carries
  no head SHA, no check name and no mergeability, so it can only be a wake
  signal; and on this operator's account the newest thread for this repo is
  dated 2026-09-10 while the PR under test accrued review threads on
  2026-09-24, so delivery on this account is unproven.

**Poll cadence prior art in the official CLI.** `gh pr checks --watch`
defaults to 10 s and breaks as soon as `counts.Pending == 0`, so it is not a
PR watcher ([checks.go](https://raw.githubusercontent.com/cli/cli/trunk/pkg/cmd/pr/checks/checks.go));
`gh run watch` defaults to **3 s** ([watch.go](https://raw.githubusercontent.com/cli/cli/trunk/pkg/cmd/run/watch/watch.go)).
Measured per-command HTTP cost of the calls this repo uses: `gh pr view` = 1
GraphQL request; `gh pr checks` = **4** (finder + two schema-introspection
queries + the status query), and `--required` the same 4 — half that command's
budget is feature detection, and the introspection calls recur across
invocations.

**Two hazards the 2026-07-27 docs update added, both directly relevant.**
Pagination must keep a stable sort or it stops returning 304 ("Some parameters,
such as `sort=updated`, reorder the list whenever an item changes… pages that
you already fetched can return new data instead of `304 Not Modified`"), and a
repeatedly-404ing resource must back off hard because "Repeatedly requesting a
missing resource wastes your rate limit and can trigger a secondary rate limit"
([cacheable requests](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#make-requests-that-can-be-cached)).
The docs remain explicit that "You should subscribe to webhook events instead
of polling the API for data", and that a response's `x-poll-interval` is a
floor ([avoid polling](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#avoid-polling)).
`X-Poll-Interval` was observed only on `/notifications` and the events feed —
the PR object, check-runs, status and comments endpoints carry no such header,
so a 5–10 s poll of those is not against a documented floor.

### 3. Comparable agent systems

**Event source taxonomy.** Three patterns, and polling is nobody's primary
source: (a) a GitHub App webhook into vendor infrastructure — Anthropic Code
Review, Anthropic auto-fix, Anthropic Routines, Devin, Cursor Bugbot and
Automations, CodeRabbit, OpenHands Cloud; (b) GitHub Actions as the event
source with the agent as a job — `claude-code-action`, the retired OpenHands
V0 resolver, Cognition's own recommended Devin PR-review workflow; (c) GitHub
Copilot, which is the platform and runs the agent in Actions-powered ephemeral
environments with a hard 59-minute session ceiling
([about coding agent](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent)).

**Anthropic's auto-fix is the closest published analog to this packet's goal,
and it already ships.** "Claude subscribes to GitHub activity on the PR, and
when a check fails or a reviewer leaves a comment, Claude investigates and
pushes a fix if one is clear", with per-event triage into clear fixes (push),
ambiguous requests (ask first) and duplicate/no-action events ("Claude notes it
in the session and moves on"). It is a per-PR toggle, reachable from the CI
status bar, `/autofix-pr`, mobile, or a pasted PR URL. Thread replies post
under the user's own GitHub account, which Anthropic flags as a trigger hazard
for `issue_comment`-driven automation such as Atlantis or Terraform Cloud
([auto-fix](https://code.claude.com/docs/en/claude-code-on-the-web)).

**Managed Code Review sets the latency and serialization expectations.**
Per-repository trigger policy (once after PR creation / after every push /
manual `@claude review`); an overlapping request "is queued until the
in-progress review completes"; reviews complete "in 20 minutes on average" and
the check run appears "within a few minutes"; each review averages $15–25;
runs are best-effort and never retry; and the check run "always completes with
a neutral conclusion so it never blocks merging". Replying to an inline finding
does nothing — "To act on a finding, fix the code and push", and the next
push-triggered review resolves the thread
([code review](https://code.claude.com/docs/en/code-review)).

**Nobody coalesces heterogeneous events per head.** The two documented
coalescing mechanisms are human-side batching and diff identity:

- Cursor Bugbot stores the **git patch-id** of the reviewed diff and skips a
  review when it sees a diff with the same patch id, and by default reviews
  only the changes since the previous Bugbot review; trigger policy is
  configurable between per-update, mention-only and once-per-PR; it reads
  existing PR comments to avoid duplicate suggestions
  ([Bugbot](https://cursor.com/docs/bugbot)). Patch-id is strictly better than
  "head SHA changed": a rebase that preserves the diff is skipped.
- Copilot lets a reviewer batch comments ("Add to batch" → "Manage batch") so
  one session handles many, and "remembers context from previous sessions on
  the same pull request"
  ([use cloud agent on GitHub](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github)).
- CodeRabbit re-reviews per push on commits since the last review
  (`auto_incremental_review`, default true) with an explicit volume brake,
  `auto_pause_after_reviewed_commits` default 5
  ([auto review](https://docs.coderabbit.ai/configuration/auto-review)), plus
  operator commands `review` / `full review` / `pause` / `resume` / `resolve`
  and `ignore` in the PR description
  ([review commands](https://docs.coderabbit.ai/reference/review-commands)).
- Against that, Anthropic Routines states the anti-pattern plainly: "Claude
  Code doesn't reuse sessions across events, so two PR updates produce two
  independent sessions", its GitHub trigger surface is only Pull request and
  Release, and over-cap webhook events "are dropped until the window resets"
  ([routines](https://code.claude.com/docs/en/routines)).
  `claude-code-action` ships no coalescing at all and hands concurrency to
  GitHub Actions
  ([solutions](https://github.com/anthropics/claude-code-action/blob/main/docs/solutions.md)).

**Owner routing: one system does exactly what this packet wants.** Devin routes
a `/devin` comment into the session already working on that PR "instead of
starting a new one", and auto-responds to comments on PRs its sessions are
working on "as long as the session has not been archived" — archiving is the
documented kill switch
([Devin GitHub integration](https://docs.devin.ai/integrations/gh)).
Cognition's own recommended automatic-review pattern is the opposite —
Actions trigger plus `POST /v1/sessions`, one session per trigger, with a
published 5–10 minute latency
([Devin 101](https://cognition.com/blog/devin-101-automatic-pr-reviews-with-the-devin-api)).

**Dispatch authority splits two ways**, and both differ from this packet's
plan: run as the triggering human's identity (Anthropic auto-fix replies;
Routines, where "commits and pull requests carry your GitHub user"), or a bot
identity with a write-access gate on the trigger (Copilot "only responds to
comments from people who have write access"; `claude-code-action` requires
write access and rejects bot actors unless listed in `allowed_bots`
"which keeps bots from triggering Claude in a loop"
([GitHub Actions docs](https://code.claude.com/docs/en/github-actions)); Devin
requires write/admin plus a linked account; Code Review requires
write/maintain/admin).

**Gating and de-dupe patterns worth copying.** `claude-code-action` buffers
inline comments and classifies them with Haiku before posting rather than
posting each as produced (`classify_inline_comments`, default true), and its
generated review workflow skips draft and closed PRs, PRs it judges not to
need review, and PRs that already carry a Claude comment
([usage](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md)).
It also cannot submit a formal review or approve a PR and acts by updating one
comment
([capabilities and limitations](https://github.com/anthropics/claude-code-action/blob/main/docs/capabilities-and-limitations.md)).
MIT, 8,938 stars, active
([claude-code-action](https://github.com/anthropics/claude-code-action)).

**The broadest published PR-event taxonomy still has no conflict trigger.**
Cursor Automations lists PR opened / pushed / merged, push to branch, draft
opened, comment added, PR label changed, **CI completed**, issue comment,
**PR review comment**, **PR review submitted**, **review thread updated**, and
workflow run completed — and no merge-conflict trigger, no documented
debounce, no dedupe
([automations](https://cursor.com/docs/cloud-agent/automations)). Cursor cloud
agents also launch from `@cursor` on a GitHub PR or issue
([cloud agent](https://cursor.com/docs/cloud-agent)).

**Open-source comparables.** OpenHands is MIT and very active (89,097 stars)
([OpenHands](https://github.com/OpenHands/OpenHands)), but its Actions-based
resolver — the label/mention-triggered design this packet would otherwise copy
— was removed from main on 2026-04-23 (commit `cc100c0d`, "Removed the V0
resolver")
([workflow history](https://github.com/OpenHands/OpenHands/commits/main/.github/workflows/openhands-resolver.yml)),
and the standalone repo is archived MIT with a pointer that now 404s
([openhands-resolver](https://github.com/All-Hands-AI/openhands-resolver)).
The historical blog documents a `fix-me`-label GitHub Action with a
"few minutes" per-issue expectation
([blog](https://www.openhands.dev/blog/open-source-coding-agents-in-your-github-fixing-your-issues)).
Today's path is an `openhands` label or an `@openhands`-prefixed message on an
issue, or an `@openhands` mention in PR comments, from a signed-in account with
the repository added, acknowledged by a comment, and only for PRs both to and
from an added repository
([GitHub installation](https://docs.openhands.dev/openhands/usage/cloud/github-installation)).
Its Event-Based Automations expose `pull_request`, `issues`, `issue_comment`,
`push` and `release` with JMESPath filters — no CI-failure, review or conflict
trigger, and no documented debounce
([event automations](https://docs.openhands.dev/openhands/usage/automations/event-automations)).
Sweep is no longer a comparable: the repo is a sunset notice, last push
2025-09-18, under a source-available "Sweep Enterprise Edition" licence
(GitHub reports NOASSERTION) that forbids derivative works outside its Free
Software parts ([sweepai/sweep](https://github.com/sweepai/sweep)).
Ellipsis reviews "as commits arrive" with incremental scope and offers
`POST /v1/reviews` to run a review without posting, and publishes no latency,
draft-handling, debounce or comment-reply behaviour
([code review](https://www.ellipsis.dev/docs/code-review)).

**No surveyed system publishes a seconds-scale response expectation.** Every
published figure is minutes: Code Review 20 minutes average and a check run
"within a few minutes"; Devin 5–10 minutes; the OpenHands resolver "a few
minutes"; Routines scheduled runs staggered by "a few minutes". Codex, Bugbot,
CodeRabbit and Ellipsis publish none. (Copilot's 59-minute figure is a session
ceiling, not a latency.) OpenAI's Codex GitHub surface documents Automatic
reviews on PR open, `@codex review` / `security review` / `fix`, a 👀 ack and
findings posted as a GitHub review, gated on "GitHub push or admin permission"
— and no re-review-on-push rule, no queueing rule and no latency figure
([Codex GitHub](https://learn.chatgpt.com/docs/third-party/github)).

### 4. Idle wake and relay transports

**The capture's premise "hooks fire only at tool boundaries" is false as a
statement about the product, though it remains true of this repo's wiring.**
The hooks reference documents **33** events; three fire without a tool call:
`Notification` with matcher `idle_prompt` ("Claude finished responding about 60
seconds ago and you haven't typed since"); `FileChanged`, which "detects
changes with a filesystem watcher, not by inspecting tool calls, so it runs the
hook no matter what changed the file… or a process outside Claude Code
entirely"; and any command hook with `asyncRewake: true`, where the Limitations
section states the exception outright — "an `asyncRewake` hook that exits with
code 2 wakes Claude immediately even when the session is idle"
([hooks](https://code.claude.com/docs/en/hooks)).

Two of those three cannot put text in front of the model. `FileChanged` has no
decision control and its `systemMessage` "doesn't reach the SDK message
stream"; `Notification` hooks have their `systemMessage` and `continue`
discarded. Only `asyncRewake` carries text — "The hook's stderr, or stdout if
stderr is empty, is shown to Claude as a system reminder" — and its `timeout`
is still enforced, defaulting to 600 s for command hooks. A plain
`async: true` hook explicitly does **not** wake an idle session: "If the
session is idle, the response waits until the next user interaction." Handler
`type` may also be `command`, `http`, `mcp_tool`, `prompt` or `agent`, and an
`mcp_tool` hook's text output is treated like command stdout — a deterministic
poll of a local daemon at hook time with no process spawn (same page).

**Cross-session messaging is the documented idle-wake primitive, and a plain
local script is a sanctioned sender.** "When the receiving session is idle,
Claude Code starts a new turn with the message", delivered "over a per-session
socket on your machine, never through Anthropic servers", available on every
provider for same-machine delivery
([cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging)).
The docs name the script case directly — read the socket section "when you want
a script or hook to post into a session" — and Claude Code exports
`CLAUDE_CODE_MESSAGING_SOCKET` (before any hook runs, including SessionStart)
and `CLAUDE_CODE_MESSAGING_TOKEN`
([env vars](https://code.claude.com/docs/en/env-vars)), closing any connection
that has not sent a complete line within 30 seconds.

Two rules decide whether a relay's message actually lands. The inbound default
**holds**: "The receiving session bypasses permission prompts: Claude Code
holds each message for your approval. It delivers one only when the sending
session identifies itself as also bypassing", and a held message expires at
`dialogExpiry` (default five minutes). The escape hatch is own-child
verification — Claude Code "delivers a message it verifies came from the
session's own child processes, such as a hook or Bash command posting back to
its own session's socket", and on Linux it "can verify by process evidence even
for a child that has already exited". So a relay spawned from a hook of the
same session is delivered; an unrelated daemon needs
`crossSessionInbound: accept`. Limits that shape a coalescing policy: ~1M
characters per message, refusal once the receiver's inbox is full, identical
repeats dropped within a short window, at most 50 queued and 100 held messages
(same page). A long-running `claude -p` worker can be a target if started with
`crossSessionInbound` set to `accept`.

`--resume` / `--continue` / `--fork-session` and the SDK's resume/fork are
**not** delivery into a live session — they start a new process from a
persisted transcript ([CLI reference](https://code.claude.com/docs/en/cli-reference),
[SDK sessions](https://code.claude.com/docs/en/agent-sdk/sessions)); the SDK's
push equivalent is streaming input mode, inside your own process holding the
query open
([streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)).

**Channels remove the tunnel from the inner loop.** "A channel is an MCP server
that pushes events into your running Claude Code session"; the contract is a
three-line MCP addition (`capabilities.experimental['claude/channel'] = {}`,
stdio transport, `notifications/claude/channel` with `content` plus optional
`meta`), rendering to the model as
`<channel source="…" severity="…">body</channel>`
([channels](https://code.claude.com/docs/en/channels),
[channels reference](https://code.claude.com/docs/en/channels-reference)).
The reference's worked example **is a webhook receiver** and binds loopback
only — a single Bun file serving `127.0.0.1:8788` and forwarding each POST body
via `mcp.notification()`, framed as "a webhook from CI, your error tracker, a
deploy pipeline, or other external service arrives where Claude already has
your files open". Delivery semantics match the coalescing requirement —
"Events queue into the session and are processed in order… delivered together
on the next turn and Claude handles them as a group" — but give no receipt:
"Claude Code doesn't acknowledge notifications", and a server not loaded as a
channel has its events "dropped silently". Constraints: research preview, and a
self-built server needs `--dangerously-load-development-channels` rather than
`--channels`; channels require Anthropic authentication through claude.ai or a
Console API key and are unavailable on Bedrock, Google Cloud's Agent Platform
and Microsoft Foundry; and on the v2 MCP runtime,
`MCP_PROTOCOL_NEGOTIATION=auto` with protocol revision `2026-07-28` makes a
channel server undeliverable, so "Claude Code doesn't register it as a channel"
([MCP](https://code.claude.com/docs/en/mcp)). A channel can also relay the
permission prompts that would otherwise stall an unattended fixer.

**In-session polling primitives.** The Monitor tool delivers while the session
waits on the human — "Events arrive on their own schedule and are not replies
from the user, even if one lands while you're waiting for the user to answer a
question" — with `timeout_ms` defaulting to 5 minutes, capped at 30 (10 in
`-p`), re-armable, and unavailable when `DISABLE_TELEMETRY` or
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set. It has a WebSocket source
(one event per text frame; >1 MiB frame ends the watch) and denies URLs
pointing at private, link-local or cloud-metadata addresses
([tools reference](https://code.claude.com/docs/en/tools-reference)). Plugin
monitors are the un-deadlined variant — "a shell command that runs in the
background for the whole session. What it prints reaches Claude as
notifications" — interactive sessions only, never `-p`
([plugin components](https://code.claude.com/docs/en/plugins/components)).
Scheduled tasks fire between turns without user input, but "Recurring tasks
fire up to 30 minutes after the scheduled time", which rules cron out as an
event source and leaves it usable as a re-arm heartbeat; `/loop`'s built-in
maintenance prompt already says to "tend to the current branch's pull request:
review comments, failed CI runs, merge conflicts", and the same page routes to
channels for the event-driven version
([scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks)).

**Vendor GitHub ingress that does not help, and one pattern worth copying.**
A Routines GitHub trigger starts a fresh cloud session per event, so it cannot
wake a local orchestrator; its API trigger is a usable HTTP ingress
(`POST /v1/claude_code/routines/<id>/fire`) whose `text` "arrives wrapped in a
`<routine-fire-payload>` block that labels it as untrusted data and tells
Claude not to follow instructions inside it"
([routines](https://code.claude.com/docs/en/routines)). Every vendor surface
that pushes external text at a model wraps and labels it this way — channel
events, routine payloads, relayed inbox messages marked `trust="relay"`. A PR
review body is attacker-controlled text on a public repo, so a `YeetPrEvent`
capsule should carry the same label. Remote Control is unavailable when
`ANTHROPIC_BASE_URL` points anywhere other than `api.anthropic.com`, which
excludes this workstation's proxy sessions
([remote control](https://code.claude.com/docs/en/remote-control)).

**Codex has the CLI primitive Claude Code lacks.** `codex queue --thread
<uuid|name> --message <TEXT>` queues a message into an existing session over a
shared local app-server daemon, and `codex agents` browses those sessions
(verified locally on codex-cli 0.156.1; the published non-interactive docs at
[learn.chatgpt.com](https://learn.chatgpt.com/docs/non-interactive-mode)
document none of `queue` / `agents` / `app-server` / `remote-control`, so treat
it as an undocumented surface). `codex exec resume [--last] [PROMPT]` accepts
`-m/--model`, and `codex exec` takes `--json`, `-o`, `--output-schema` and
`--ephemeral`.

**Actions as the relay leg has one decisive blind spot.** `issue_comment`,
`check_run`, `pull_request_review` and `pull_request_review_comment` are all
available, `issue_comment` fires for issues and PRs alike (discriminate on
`github.event.issue.pull_request`), and `workflow_run` is the privileged
follow-up ("able to access secrets and write tokens, even if the previous
workflow was not"). But `check_run` "does not trigger workflows if the check
run's check suite was created by GitHub Actions", so our own red lanes cannot
relay themselves; and "With the exception of `workflow_dispatch` and
`repository_dispatch`, other GITHUB_TOKEN-triggered events do not create
workflow runs at all", so Yeet's own bot comments cannot drive a relay either
([events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)).
The documented workaround is an App installation token or a PAT
([trigger a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)).
A relay workflow must also already exist on the default branch for
`issue_comment` and `check_run` to fire.

**Local OS-level wakes.** systemd path units are viable with three sharp
edges: they use inotify; "files whose name starts with a dot… are generally
ignored when monitoring these paths" (a direct hazard for `.beep/`); and
`TriggerLimitIntervalSec=` defaults to 2 s with `TriggerLimitBurst=` 200, after
which "the unit is placed into a failure mode, and will not watch the paths
anymore until restarted". A triggered service that terminates causes the paths
to be rechecked immediately, and the start rate limit propagates back to fail
the path unit — a relay appending to a watched NDJSON file on every poll would
destroy its own watcher without a debounce
([systemd.path](https://www.freedesktop.org/software/systemd/man/systemd.path.html)).
`$TRIGGER_PATH` is "lossy, and should not be relied upon", so the triggered
service must re-read state from disk — which matches the existing
inbox-convergence model rather than an event-payload model
([systemd.exec](https://www.freedesktop.org/software/systemd/man/systemd.exec.html)).
A timer is not seconds-grade by default (`AccuracySec=` defaults to 1min)
([systemd.timer](https://www.freedesktop.org/software/systemd/man/systemd.timer.html)).
inotify loses events silently past `max_queued_events` but always generates
`IN_Q_OVERFLOW`; measured headroom here is 1048576 watches / 4096 instances /
16384 queued events
([inotify](https://man7.org/linux/man-pages/man7/inotify.7.html)).

**MCP server-push is not a wake path.** The spec defines
`resources/subscribe` + `notifications/resources/updated`,
`notifications/resources/list_changed`, and logging's
`notifications/message`
([resources](https://modelcontextprotocol.io/specification/2025-06-18/server/resources),
[logging](https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/logging)),
but Claude Code documents handling only `list_changed`, for dynamic tool
updates, and it does not reach the model. The only documented server-push-to-
model route is the Claude-specific `notifications/claude/channel`, and
"Being in `.mcp.json` isn't enough to push messages: a server also has to be
named in `--channels`"
([MCP](https://code.claude.com/docs/en/mcp)).

**ntfy solves the wrong half.** Apache-2.0 and self-hostable, with hard public
limits (4,096-byte messages, 250 messages/day, 60-request burst refilling at
one per 5 s, 30 open subscriptions, 2 MB attachments, 200 MB/day bandwidth) and
no sign-up, so "the topic is essentially a password"
([publishing](https://docs.ntfy.sh/publish/)). It wakes a phone or desktop, not
a session; nothing in ntfy's contract or any Claude Code surface turns a
received notification into a turn
([ntfy](https://docs.ntfy.sh/)). Its legitimate role is the escalation path
when the session-side wake fails, which is how this repo already uses it.

**Ranking of the candidate wake paths.** Two provably start a turn: a
cross-session message to an idle session, and an `asyncRewake` hook exiting 2.
Channels and Monitor deliver while the session waits on the human, but the docs
stop short of the word idle. `FileChanged`, `Notification`/`idle_prompt`,
systemd path units, inotify and ntfy all run code or alert a human without
producing a turn. Cron fires between turns with up to 30 minutes of jitter.

## In-Repo Capability Inventory (2026-09-24)

All paths repo-relative. Yeet internals live under
`packages/tooling/tool/cli/src/commands/Yeet/internal/` (package
`@beep/repo-cli`) and are abbreviated to the file name in that directory.
Every row below was re-read at the cited line.

### Area A — watch / monitor (event production)

| Brick | path:line | Role | Disposition |
|---|---|---|---|
| `YEET_WATCH_INTERVAL_MILLIS` + `runYeetWatchLoop` | `Porcelain.ts:506`, `:556` | the only definition and injection of the 10 s watch cadence | extend |
| `runYeetWatchStream` | `WatchMode.ts:953-1047`, sleep `:1037-1038` | the one loop that emits NDJSON transitions and converges the inbox | extend |
| `collectYeetWatchSnapshot` | `WatchMode.ts:381-464` | one poll's GitHub reads: `gh pr view` (`:390`), `gh pr checks` ±`--required` (`:232` via `:403`), paginated GraphQL threads (`:212-213`, `:282-300`), local `pr-closeout.json` | reuse |
| `YeetWatchEvent` | `WatchStream.ts:739-748` | 9-member transition union (`settle-changed` at `:503` is new since capture) | reuse |
| `diffYeetWatchSnapshots` | `WatchStream.ts:881-964`, mergeability `:942-945` | pure differ over consecutive snapshots | extend |
| `convergeYeetWatchDispatch` | `WatchMode.ts:595-656`, called `:824`, `:1010` | the watch's entire durable delivery surface: `check-failed`, `review-thread` P1 (`:622`), `base-drift` P2 on `BEHIND` (`:634-655`) | extend |
| `dispatchYeetCheckFailure` + wave record | `Remediation.ts:670-729`, severity `:701`, duplicate return `:714-716`, `dispatch.json` `:419` | per-head coalescing for check reds | extend |
| `watchStreamEnd` | `WatchMode.ts:838-861`, event exit `:856`, unsettled `:860` | `--until-event` exit contract | extend |
| registration patience / comment settle | `WatchMode.ts:665`, `:690` | 10 polls (~100 s) before an empty rollup is believed; 2 ticks (~20 s) so a bot burst is one wake | reuse |
| `mergeLoopPollInterval` | `MonitorLoop.ts:129`, `:1581` | 30 s default for `--until-merged` / `--until-ready`; no call site passes `pollInterval` | extend |
| `pollUntilMerged` | `MonitorLoop.ts:1454-1492` | one merge-loop tick; adds `gh run list` (`Status.ts:990`), `gh run view --job … --log-failed` (`MonitorLoop.ts:840`), a post-closeout re-read (`:1238`) | extend |
| `YeetHeadTimeline` | `MonitorPolicy.ts:336-347`, push→ready `:437` | the B7 stamps: firstObserved / pushed / settled / closeout / ready | extend |
| `readPushedAt` | `MonitorLoop.ts:1052-1069`, call `:1147` | the only GitHub-side timestamp any monitor captures — the commit's committer date, not a push time | extend |
| `yeetBaseConflictFor` + `deriveSettleVerdict` | `Settle.ts:485-486`, `937-979`, terminal test `1128-1129` | conflict detection (`CONFLICTING` ∨ `DIRTY`) yielding `budgetApplies: false` | extend |
| `YeetSettleReason` | `CheckOutcome.ts:86-92`, JSDoc `60-64` | six named waits; base-conflict "clears when the operator merges the base and pushes" | reuse |
| check registration backoff | `MonitorChecks.ts:179-185`, `:64` | 5/10/20/30/30 s (~95 s) before an empty check set is believed | reuse |
| classic monitor plan | `Planner.ts:612`, `:630` | two gh steps: `pr view`, then `gh pr checks --watch --fail-fast` | reuse |
| `runMonitorPhase` race | `Handler.ts:1324-1363`, race `:1359-1362` | gh check watch raced against the comment poller (which parks on `Effect.never`, `MonitorComments.ts:1273`) | reuse |
| comment poll + watermarks | `MonitorComments.ts:40`, endpoints `:1102`/`:1108`/`:1117`, concurrency `:1122` | 10 s, three collections at concurrency 3, durable per-collection cursors | reuse |
| `announceMonitorReadiness` | `MonitorLoop.ts:1361-1401`, append `:1385` | the merge loop's **only** inbox write: one `pr-merge-ready` P1 row per head | reuse |
| `triageMonitorReds` | `MonitorLoop.ts:1416-1452`, required-red `:1443-1451` | attribution before dispatch for checks; the required-red branch writes **no** row | extend |
| monitor route table | `Yeet.command.ts:962-978`, detach short-circuit `:1000` | seven routes; `--until-ready` forbids `--watch`/`--until-merged`/`--until-event` | reuse |
| `CiWorkflowJob` timestamp reader | `Ci/LaneTimings.ts:133`, `:142`, `:456` | already decodes job `created_at`/`started_at`/`completed_at` — in a different command | reuse |

**Corrections to the capture's inventory.** (1) The 10 s interval lives in
`Porcelain.ts:506`, not `WatchMode.ts`. (2) `YeetWatchEvent` has 9 arms, not 8
(`settle-changed`, `WatchStream.ts:503`). (3) The `gh pr checks` pair at
`WatchMode.ts:403` is a bare `Effect.all` and therefore **sequential** in
Effect v4 — the two reads add rather than the slower one gating; the codebase
passes `{ concurrency: N }` explicitly where it wants parallelism
(`MonitorComments.ts:1122`, `MonitorLoop.ts:904`/`:913`). The same applies to
`Status.ts:1281-1284`.

### Area B — inbox and delivery

| Brick | path:line | Role | Disposition |
|---|---|---|---|
| `YeetInboxRow` union | `Inbox.ts:649-656` (tags `211`, `281`, `345`, `406`, `474`, `574`, `603`) | 7 kinds now, not the capture's 5: `pr-merge-ready` (B7) and `proof-job-finished` (B5) are new | extend |
| `yeetInboxPaths` | `Inbox.ts:1081-1092`, row cap `:1094` | every row lands under `<repoRoot>/.beep/inbox/`, capped at 2,048 active rows | reuse |
| `YeetPrMergeReadyRow` + capsule | `Inbox.ts:521-534`, severity `:579` | the B7 good-news row, carrying the whole head timeline | reuse |
| `YeetInboxObservedRowKind` | `Inbox.ts:693` | the two informational kinds `--observed` admits and the wave never owns | reuse |
| `YeetAckResolution` | `Ack.ts:46`, classes `79-251` | six attributed ack forms; no blanket ack | reuse |
| `yeet inbox list/ack/append` | `Yeet.command.ts:1111-1144`, root resolution `InboxPorcelain.ts:65-66` | the operator/agent surface; `append --from-stdin` is the external writer's seam | extend |
| `supersedeYeetDispatchState` | `WatchMode.ts:822`, `:1009`; `Remediation.ts:759-780` | the **only** wave re-pin, and only from the watch stream | reuse |
| `yeet-inbox.sh` dispatcher | `.claude/hooks/yeet-inbox.sh:230-311`, header `:4-5` | SessionStart P0/P1/P2, UserPromptSubmit P0/P1, PreToolUse context-only, Stop/SubagentStop the one hard gate (`:303`) | extend |
| hook registration | `.claude/settings.json:109`, `:194`, `:212`, `:237` | exactly four events, each `"timeout": 2`; `SubagentStop` is coded but unregistered | extend |
| hook liveness rule | `.claude/hooks/yeet-inbox.sh:141-145` | drops rows whose (headSha, prNumber) misses `dispatch.json`; escapes only `pr-merge-ready` by kind | extend |
| `yeetInboxRowLiveness` | `InboxView.ts:154` | the CLI's liveness rule — escapes by **kind**, where the hook escapes by capsule **shape** | extend |
| ack scan | `.claude/hooks/yeet-inbox.sh:87-106` | two jq spawns per receipt; ~3.0 ms each, >99% of hook runtime | extend |
| per-session seen state | `.claude/hooks/yeet-inbox.sh:153-169`, `200-212` | `sessions/<harness>-<crc32>.json` with `seenIds` + `incidentId` | reuse |
| `ReviewThreadState` | `ReviewThreadState.ts:466-471`, `632-633`; watch reuse `WatchMode.ts:425-426` | outstanding = unresolved ∨ resolved-follow-up | reuse |
| `sequence-break-notifier.sh` | `.claude/hooks/sequence-break-notifier.sh:2-7`, `442`, `453-456`, `501`, `687-688`; armed at `hook-pulse.sh:377` | the existing human-escalation ladder (Ghostty OSC 777, notify-send, ntfy), content-free, armed only by a PermissionRequest | reuse |

### Area C — owner lookup, resume, dispatch, detached lanes

| Brick | path:line | Role | Disposition |
|---|---|---|---|
| `PrSessionRegistry` | `PrSessionRegistry.ts:188-195`, `213-214`, `235`, `261-267` | append-only JSONL, one file per repository under the out-of-repo state root, 0700/0600 | reuse |
| `PrSessionRecord` | `Provenance.ts:491-512`, `562-574`, role domain `:215` | the row: full provenance + prNumber/prUrl/headSha/runId/role/recordedAt | reuse |
| row write points | `ProvenanceFooter.ts:467-489`, `529-555`, `375-396`; `PullRequest.ts:390`, `:430`; `Porcelain.ts:120`; `Handler.ts:1358` | exactly four call sites (`pushed`, `created`, `monitored`×2); every failure is a warning, never a publish failure | extend |
| `classifyHarness` | `Provenance.ts:1301-1302` | harness comes **only** from `CODEX_THREAD_ID` then `CLAUDE_CODE_SESSION_ID`; neither ⇒ `unknown` | extend |
| `HarnessResumer` + `selectResumeRecord` | `Resume.ts:117`, `171-178`, `360-367`, `433-438` | newest-first, first `created`/`pushed` row; only `claude --resume` / `codex resume` render as resumable | extend |
| `isClaudeSessionLive` | `Resume.ts:66-69`, `234-266`, `517-524` | matches a recorded session id against `$HOME/.claude/sessions/*.json` and requires `/proc/<pid>`; decodes 4 of the index's 18-21 keys | extend |
| `transcriptFallback` | `Resume.ts:268-358`, gate `:453` | reconstructs rows from transcript `pr-link` records — but only when the registry lookup is **empty** | extend |
| public footer projection | `Provenance.ts:682-691`, cap `:688`, `856-866`, resume fence `:919`, render `966-997` | pr/branch/workspace + ≤4 agents of {harness, entrypoint, hostHarness, model, label, workspace, role}; no sessionId, path, runId or timestamp crosses | reuse |
| `ensureProvenanceFooter` | `ProvenanceFooter.ts:604-661`, refusal `:622` | marker-spliced footer with a bounded concurrent-edit reconcile | reuse |
| remediation wave policy | `Remediation.ts:14-18`, decisions `:156`, key `:281`, reset `386-394` | keyed on (prNumber, headSha); start-session / queue / duplicate; last-writer-wins, not a lock | extend |
| `forwardedProofJobEnvironment` | `ProofJob.ts:146-165`, prefixes `:182`, filter `1221-1231` | 18 exact names plus `BEEP_`/`TURBO_`; **neither** `CLAUDE_CODE_SESSION_ID` nor `CODEX_THREAD_ID` is admitted | extend |
| `submitDetachedProofJob` + systemd args | `Yeet.command.ts:701-730`; `ProofJob.ts:1268-1302`, prefix `:57`, slice `:74` | `--detach` replays argv as `beep-proof-<jobId>.service` under `agent-runs.slice`, log appended in-checkout | reuse |
| finalizer + termination classification | `ProofJobLauncher.ts:248-267`, reconcile `339-372`; `ProofJob.ts:404-411`, `457-470` | `ExecStopPost` stamps systemd's result, classifies signal/oom/timeout/cancelled/finalizer-missing, appends one idempotent row | reuse |
| `ProofJobLauncher.wait` | `ProofJobLauncher.ts:498-527`; interval `ProofJob.ts:1139`; exits `Yeet.command.ts:816-820` | 2 s poll of the on-disk record, `observed` ack, 2/0/1 exits | reuse |
| `ProcessIdentity` | `ProcessIdentity.ts:62`, `82-86`, `347-354`; consumer `ProofJobLauncher.ts:357-361` | the pid-reuse fence that already gates proof-job takeover — unused by PR ownership | reuse |
| `detectRunScopeSupport` | `internal/repo-run/RunScope.ts:153-161` | the systemd availability gate every detached lane inherits | reuse |
| worktree lifecycle | `Worktree.command.ts:912-940`, `:942`; `Retire.ts:99-152`, `229-240` | lane birth and archive-retirement already exist as verbs | reuse |
| research timer renderer | `Research/internal/Timers.ts:82-119`, refresh read-back `160-174` | the in-repo user-unit renderer pattern — `Type=oneshot` + `OnCalendar` only | extend |
| shared systemd schemas | `internal/systemd/SystemdUnit.schemas.ts:41-45`, `:59`, `101-106` | bun candidate order, unit-path safety, directive read-back | reuse |
| long-running unit renderers | `infra/src/OpenClaw.ts:1300`; `packages/tooling/library/ai-metrics/src/forwarder.ts:690-691`, `702-705` | `Type=simple`, `Restart=on-failure`, `RestartSec`, `OnBootSec`/`OnUnitInactiveSec` already exist in-repo for `systemd --user` units | extend |
| A4 dead-owner takeover | `goals/ship-velocity/SPEC.md:18-23` | retired by operator PR #921; no PR-ownership lease, watcher, takeover or mutation fence in live code | retired |

**NOT FOUND in area C.** No renderer anywhere emits `OnUnitActiveSec` (the
closest is `OnUnitInactiveSec` at `forwarder.ts:703`), so a sub-minute user
unit has no in-repo source. No producer exists for `YeetSiblingCollisionRow`
(`Inbox.ts:245-294`) outside tests — the one row kind designed for
cross-checkout delivery has never been written. No CLI subcommand accepts a
target checkout: `yeet inbox` resolves the inbox from the process CWD
(`InboxPorcelain.ts:65-66`), so reaching a sibling means `cd`-ing into it and
piping to `yeet inbox append --from-stdin`. No `--detach` exists on any fixer
or dispatch command (`Yeet.command.ts:436` spreads `detachedFlags` into
verify, publish, monitor and closeout, plus `:903` for repair).

### Area D — webhook infrastructure

| Brick | path:line | Role | Disposition |
|---|---|---|---|
| `CiFleetController` | `infra/src/CiFleetController.ts:1-7`, webhook output `784-789`/`1035`, `delay_webhook_event: 0` `:875`, repo allowlist `:949` | the only thing in the repo that provisions a GitHub-webhook receiver (a pinned terraform module wrapped as a Pulumi resource) | extend |
| `eventbridge` module input | `infra/ci-runners/sdks/ghaRunners/types/input.ts:42-45`; docs + wiring `module.ts:399-405`, `:102` | the config lever that turns the receiver into an EventBridge publisher with a per-event allowlist — **unset** today (`rg -i eventbridge infra/src/CiFleetController.ts` → no hits) | extend |
| pinned webhook Lambda | out of repo: `$HOME/beep-infra-artifacts/gha-runner/v7.10.1/webhook.zip`, pinned at `infra/ci-runners/Pulumi.production.yaml:17` | the deployed bundle **already** ships `eventBridgeWebhook` and `dispatchToRunners` beside the live `directWebhook`, so the fan-out needs a config flip plus redeploy, not new code | reuse |
| live single-event allowlist | same artifact: `checkEventIsSupported(eventType, ['workflow_job'])` | the blocker on "just add events to the existing hook": signature is verified first, then a non-`workflow_job` delivery gets HTTP 202 "Unsupported event type" and is dropped. Pinned vendor code this repo does not author | blocker |
| webhook-secret chain | `infra/ci-runners/Pulumi.production.yaml:11-12`; `CiFleetController.ts:29`, `916-919`; `goals/ci-fleet-endgame/research/secrets.md:11`, `16-18` | 1Password reference → `op read` at deploy → externally-managed SSM SecureString under KMS → Lambda reads SSM. Pulumi holds only the ARN and a fixed parameter name | reuse |
| `controllerWebhook` output | `infra/src/internal/ci-runners-entry.ts:139` | the endpoint is already a named stack output a second consumer could read | extend |
| `CiTurboCache` | `infra/src/CiTurboCache.ts:510-695`; HMAC `infra/lambda/turbo-cache/src/hmac.ts:41-51` | the strongest in-repo precedent for a second receiver: repo-authored HTTP API + Lambda REQUEST authorizer + SSM-resolved secrets + constant-time HMAC | reuse |
| CiRunners reaper | `infra/src/CiRunners.ts:1286-1362`, inline source `1318-1319` | the cheapest relay shape: an EventBridge rule driving a Lambda whose source is a `StringAsset` — no out-of-repo zip pipeline | extend |
| `beep runners` AWS CLI consumer | `Runners.service.ts:224-231`, `721-728` | the only workstation→AWS code path: shells `aws` and schema-decodes stdout | extend |
| turbo-cache workstation contract | `standards/turbo-remote-cache.md:3-26`; `scripts/enable-turbo-remote-reads.sh:54-56` | proof a workstation already calls an AWS API Gateway over HTTPS with an `op://`-referenced token and a fail-closed resolver | reuse |
| `@beep/tailscale` driver | `packages/drivers/tailscale/src/Tailscale.service.ts:312`, `:362`, `:427` | the repo's only tunnel primitive — tailnet ingress only, no Funnel anywhere, and the standing posture is tailnet-only | reuse |
| `@pulumi/command` | `infra/package.json:50` | the in-workspace way to wrap a `gh api` call as IaC (already used for remote SSH steps, `infra/src/AIMetrics.ts:621`) | reuse |
| webhook-router prior art | `goals/ship-velocity/research/c2-yeet-monitor-backpressure.md:371-385` | an existing in-repo design for exactly this: repository webhook or minimal App on the seven PR/review/comment events, an Effect `HttpRouter` verifying `X-Hub-Signature-256` over the raw body, `X-GitHub-Delivery` dedupe, a delivery journal, normalized to the same `YeetWatchEvent`, routed by repository id + PR number + head SHA | reuse |

**NOT FOUND in area D.** No workstation-side consumer of any AWS push
transport: `rg 'ReceiveMessage|@aws-sdk/client-(sqs|sns|eventbridge)'` over
`packages/`, `apps/`, `scripts/` returns zero hits, `packages/drivers/` has no
aws package, `.github/workflows/` has no `configure-aws-credentials` or OIDC
role, and `aws sts get-caller-identity` reports an expired session — every
delivery leg from AWS to this box is net-new. No GitHub Pulumi provider:
`@pulumi/github` appears in neither the root catalog nor `infra/package.json`,
so a second or org-level webhook has no first-class IaC path, and
`gh api orgs/beep-effect/hooks` is 404 without `admin:org_hook`. No SQS/bus
identifier is reachable from stack outputs: the module declares a `queues`
output (`module.ts:39-42`) that `CiFleetController.ts:1037-1040` does not
register. No Tailscale Funnel anywhere in the repo, and the `@beep/tailscale`
driver has **zero functional consumers** — production `tailscale serve` is a
rendered remote shell line at `infra/src/AIMetrics.ts:191`, not a driver call.

### Latency components of the current path

Measured numbers are in §4; this is the decomposition and where each term is
defined in code.

| Term | Where it is set | Value |
|---|---|---|
| `T_visible` — GitHub-side propagation | not captured in-repo; measured only for `workflow_job` via webhook deliveries | median 2.08 s, max 5.52 s (§4) |
| `T_phase` — where the event lands in the sleep | `Porcelain.ts:506` (10 s), `MonitorLoop.ts:129` (30 s), `MonitorComments.ts:40` (10 s), `ProofJob.ts:1139` (2 s) | uniform[0, interval); E = interval/2 |
| `T_poll` — the API chain inside one poll | sequential by construction: `WatchMode.ts:403`, `Status.ts:1281-1284` | watch 4.0–6.4 s; until-ready 4.9–5.8 s (§4) |
| `T_write` — inbox append | `Inbox.ts:1081-1092`, idempotent by deterministic id (`WatchMode.ts:591-593`) | low ms locally, ≤2 s flock ceiling (`Inbox.ts:1157-1164`) |
| `T_deliver` — row to the agent reading it | `.claude/hooks/yeet-inbox.sh:230-311` + `.claude/settings.json:109`/`194`/`212`/`237` | **no timer**: four event boundaries only, so unbounded for an idle session |
| Registration patience | `WatchMode.ts:665`, `MonitorChecks.ts:179-185` | ~95–100 s before an empty rollup is believed |
| Settle timeout | `MonitorPolicy.ts:50` | 30 min, counting only registration/missing contexts |
| Conflict terminal | `Settle.ts:940-950` (`budgetApplies: false`) + `:1128-1129` | none — a base-conflict verdict can never become `settle-timeout` |

`L_row = T_visible + T_phase + T_poll + T_write`, and
`L_act = L_row + T_deliver`. Three structural facts collapse most of this:

1. **The classic monitor writes no row at all.** `Planner.ts:612`/`:630` runs
   two gh steps and `Handler.ts:1324-1363` races them against the comment
   printer; there is no `appendYeetInboxRow*` reachable on that path.
2. **`--until-ready` writes exactly one row kind.** `MonitorLoop.ts:1385` is
   the loop's only append, and it is `pr-merge-ready`. The required-red branch
   (`:1443-1451`) is a `Console.log` plus a process exit. `check-failed`,
   `review-thread` and `base-drift` are produced only by
   `convergeYeetWatchDispatch` (`WatchMode.ts:595-656`), reachable only from
   the watch stream. `--until-ready` polls comments once, on its first cycle
   (`MonitorLoop.ts:1465-1472`), and never again.
3. **No GitHub-side check timestamp is captured.** `gh pr checks --json`
   exposes `completedAt` and `startedAt`; `WatchMode.ts:232` asks for
   `name,state,bucket,link,workflow` and `Status.ts:868` for
   `name,state,bucket`, and neither row schema could hold a timestamp
   (`WatchMode.ts:146-157`, `Status.ts:497-506`, `internal/github/JobShape.ts:150-157`).
   Adding two field names makes event→row latency measurable per check from
   artifacts. `Ci/LaneTimings.ts:133`/`:142` already decodes exactly those
   fields, in another command.

## Harness-side primitives (2026-09-24)

**These are observed tool schemas in the Claude Code desktop app on the
operator workstation, read from the live tool registry during the research
pass. They are not repo code, not a documented API, and not under this repo's
version control — they can change without a release note. Treat every quoted
string as an observation of that session's registry.**

- `ccd_pr.set_monitor` with `auto_fix=true` on a bound open PR: the app "wakes
  this session with a `<ci-monitor-event>` on CI failures, merge conflicts and
  review comments". `address_comments` is the same switch. Each call needs user
  approval. `bind_pr` binds a PR by URL. This is the packet's spark, already
  shipped as a switch — and it covers exactly the three events the operator
  named.
- `ccd_pr.get_status` reads PR number/url/state/branches, CI check counts and
  failing check names, review decision, mergeability, and the
  `auto_fix` / `auto_merge` / `auto_archive_on_close` switches from the app's
  cache, with the instruction to use it "after `gh pr create` instead of
  polling `gh pr checks`".
- `ReadNotifications` is a queue of GitHub activity on subscribed PRs,
  scheduled triggers, and messages from other Claude sessions; a system notice
  announces pending notifications and the tool drains them oldest first.
- `Monitor` is a background monitor whose stdout lines — or WebSocket text
  frames via a `ws` source — arrive as chat notifications on their own
  schedule; max 30 minutes per arm, re-armable; the documented example polls PR
  comments with `gh api` every 30 s.
- `CronCreate` creates session-only cron prompts that fire only while the REPL
  is idle, with a 7-day expiry; `ScheduleWakeup` self-paces `/loop`
  (60–3600 s).
- `SendMessage` cross-session: messages enqueue and drain at the receiver's
  next tool round; `notify_when_idle` gives a one-shot idle notice; a session
  in a different permission mode holds peer messages for user approval.
- `FetchInboxMessage`: Remote Control relays chat-thread messages as
  session-inbox events.
- `ccd_session_mgmt.send_message` (the desktop session manager, distinct from
  the harness `SendMessage`): delivers a message to another desktop session as
  a user turn labelled "From {sender title}"; its result reports "delivered"
  when the target session's turn has started on the message and "queued" when
  it waits behind that session's current work. It is unavailable in unattended
  sessions (scheduled-task runs and remote-dispatched sessions) and cannot
  deliver to them. This is the idle-wake primitive the capture named, confirmed
  to exist as a tool.
- `ccd_pr.get_status` on the research session reported no bound PR and stated
  the auto-bind rule: the app binds a PR when the session runs `gh pr create`
  or pushes to a branch with an open PR. `ReadNotifications` in the same
  session returned "No queued notifications" (nothing subscribed).
  `PushNotification` reaches the human (terminal notification, phone under
  Remote Control), never a session.
- Hooks in `.claude/settings.json`: `yeet-inbox.sh` is wired at PreToolUse
  (`:109`), UserPromptSubmit (`:194`), SessionStart (`:212`) and Stop (`:237`)
  (no SubagentStop registration), beside `hook-pulse.sh` and `law-pulse.sh`.
  **None of these fires while a session is idle.**

Two consequences for the design. First, the desktop app already delivers the
three spark events to a bound session, so anything this packet builds must
justify itself against that switch rather than against nothing — on
attribution, per-head coalescing, durability across a dead session, and working
in a terminal session rather than only in the app. Second, the harness
primitives that wake a session are session-scoped and app-scoped, while the
inbox is checkout-scoped; a design that mixes them inherits both scopes.

## Measurement (2026-09-24)

First end-to-end measurement of the current path, read-only: no GitHub event
was generated, no mutation was issued, `yeet monitor`/`publish` were never run,
and nothing was written under `.beep/`. The one live `--until-ready` job
observed was already running and was only read.

### A. Webhook delivery latency (the push-source upper bound)

All 100 deliveries in the active hook's retention window
(2026-09-24T23:41:55Z → 2026-09-25T00:07:30Z). Every one is
`event=workflow_job`, `status_code=201`, `redelivery=false`,
`throttled_at=null`. Delta = `delivered_at` minus the action-appropriate
`workflow_job` timestamp (`completed_at` / `created_at` / `started_at`); zero
null source fields.

| action | n | min (s) | median (s) | p90 (s) | max (s) |
|---|---|---|---|---|---|
| completed | 41 | 1.35 | 2.08 | 2.86 | 5.52 |
| queued | 27 | 0.98 | 2.49 | 2.78 | 2.97 |
| in_progress | 32 | 1.40 | 1.97 | 3.97 | 11.02 |

Receiver response duration, GitHub-measured: min 0.07 s, median 0.15 s, max
1.56 s. Payload timestamps have 1 s precision, so every delta carries ±1 s.

**Scope, and the decisive finding.** There is exactly one webhook on the
repository (id and endpoint withheld): Repository type, active, `events` is
`["workflow_job"]` and nothing else, content_type json, secret set,
`insecure_ssl` 0, created 2026-08-09, last response 201. No webhook subscribes
to `issue_comment`, `pull_request_review`, `pull_request_review_comment`,
`check_run`, `pull_request` or `push` — **none of the three events the spark
names has a push source today.** The one hook is the CI runner autoscaler's
receiver.

### B. Poll path (the current event→row producer)

Measured from inside a real PR lane using the code's exact argument vectors
with no PR number and no `--repo`, so gh's own branch→PR resolution is
included. Three repetitions each, milliseconds.

| Call | Code site | Mode | RTT (3 reps) |
|---|---|---|---|
| `gh pr view --json id,number,state,isDraft,mergeable,mergeStateStatus,reviewDecision,headRefOid,labels` | `WatchMode.ts:390` | watch | 2136 / 926 / 699 |
| `gh pr checks --json name,state,bucket,link,workflow` | `WatchMode.ts:232` via `:403` | watch | 1296 / 899 / 1893 |
| same with `--required` | `WatchMode.ts:232`, second arm of `:403` | watch | 1192 / 1059 / 916 |
| `gh api graphql` review threads | `WatchMode.ts:212-213`, `290-300` | both | 498 / 1034 / 543 |
| `pulls/{n}/comments --paginate` (since) | `MonitorComments.ts:1102` | watch only | 1085 / 445 / 1155 |
| `issues/{n}/comments --paginate` (since) | `MonitorComments.ts:1108` | watch only | 1085 / 453 / 1072 |
| `pulls/{n}/reviews --paginate` (**no** since) | `MonitorComments.ts:1117` | watch only | 1622 / 638 / 673 |
| `gh pr view --json …,url,…` | `Status.ts:1261` | until-ready | 778 / 3126 / 849 |
| `gh pr checks --json name,state,bucket` (±`--required`) | `Status.ts:868` via `:1281-1284` | until-ready | 950 / 2379 / 936 |
| `gh run list --branch … --limit 20 --json …` | `Status.ts:990` | until-ready | 2876 / 1269 / 4708 |

| Per-poll total | Reps (ms) |
|---|---|
| watch snapshot chain (sequential) | 4034 / 4209 / 6387 |
| watch comment poll (concurrency 3) | 2404 / 2653 / 1490 |
| **watch poll total** | 6438 / 6863 / 7878 |
| **until-ready chain** | 4909 / 4938 / 5802 |

| Cadence | Value | Site |
|---|---|---|
| `--watch` / `--until-event` | 10,000 ms | `Porcelain.ts:506`, `:556` |
| `--until-merged` / `--until-ready` | 30,000 ms | `MonitorLoop.ts:129`, `:1581` |
| classic monitor comments | 10 s | `MonitorComments.ts:40` |
| `yeet job wait` | 2,000 ms | `ProofJob.ts:1139` |
| check registration backoff | 5/10/20/30/30 s | `MonitorChecks.ts:179-185` |

**Observed `--until-ready` poll period**, recovered from the `waited …` settle
counter in all 6 on-disk monitor job logs (n=326 consecutive-poll deltas):
min 32,961 ms, p10 33,660, median 35,416, p90 41,521, p99 73,067, max 84,212.
Subtracting the 30,000 ms interval gives real per-poll work: median 5,416 ms,
p90 11,521 ms, max 54,212 ms — the median agrees with the measured 4,938 ms
chain.

**Expected and worst-case event→row:**

| Path | Expected | Worst |
|---|---|---|
| watch → `check-failed` / `review-thread` / `base-drift` row | ~9.2 s (5.0 s phase + 4.209 s median chain) | 16.4 s |
| watch → `comment-posted` stdout event | ~11.9 s | 17.9 s, plus up to 20 s of comment settle before an `--until-event` exit |
| `--until-ready` → `pr-merge-ready` row | ~20.4 s (15.0 s phase + 5.416 s median work) | 41.5 s typical; **84.2 s** observed |
| `--until-ready` → check / thread / conflict row | **never** (no producer) | unbounded |
| classic monitor → any row | **never** (no append reachable) | unbounded |

Add `T_visible` on top: 1.4–5.5 s using §A's `workflow_job` deliveries as the
only available proxy.

### C. Historical timelines from persisted artifacts

Three `pushed → ready` gates exist on disk (from `pr-merge-ready` capsules and
job-log gate lines). Note `pushedAt` is the head commit's **committer date**,
documented as an approximation because publish commits and pushes in one step
(`MonitorPolicy.ts:318-320`).

| Run | pushed→firstObserved | pushed→settled | pushed→ready |
|---|---|---|---|
| PR #1174 | 32.2 s | 2,274.0 s | 2,326.9 s |
| PR #1180 | 19.0 s | 3,210.5 s | 3,223.9 s |
| PR #1183 | not persisted | 3,273.2 s | 3,273.2 s (closeout ran 04:46, board settled 05:39 — the gate is settle-bound) |
| PR #1220 (live at read time) | 76.6 s | — | — |
| `fix_version-sync-turbo-lockfile-pin` | **20,821.6 s (5.78 h)** | — | none stamped |

`pushed→firstObserved`: n=4, values 19.0 / 32.2 / 76.6 / 20,821.6 s. The last
is not poll latency — it is a monitor launched hours after the push, and it is
the clearest on-disk instance of this packet's gap: nothing was watching, so
the head was invisible to any agent until an operator started a monitor.

**Mode census, 66 job logs across 9 checkouts:** 31 publish, 29 verify, 6
monitor — and all 6 monitor jobs are `monitor --until-ready`. **Zero detached
`--watch` jobs exist**, i.e. the only mode that produces actionable rows has
never been run unattended on this box. `grep -i 'first.observed'` over all 66
logs returns 0 hits; `firstObservedAt` lives only inside 4 persisted
`status.json` artifacts.

### D. Row → ack (the only available row→session-acted measure)

Joined `failures.ndjson` row `ts` to `acks/<id>` `ackedAt` across 64
`.beep/inbox` directories: 1,051 rows, 875 ack files, **869 joined pairs**, 0
unparsable, 0 orphan acks, 0 negative deltas, 143 rows never acked.

| Decile | 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| seconds | 0.1 | 15.9 | 32 | 43.6 | 71.2 | **119.4** | 287.4 | 567.5 | 955.6 | 6,056 | 486,893 |

| By kind | n | median (s) | p90 (s) |
|---|---|---|---|
| `proof-job-finished` | 57 | 2.0 | 166 |
| `check-failed` | 200 | 52.9 | 7,409 |
| `pr-merge-ready` | 3 | 76.7 | 686 |
| `local-shard-failed` | 536 | 196.1 | 7,908 |
| `review-thread` | 73 | 380.4 | 2,007 |

By severity: P0 n=567 median 210.3 s; P1 n=295 median 46.3 s; P2 n=7 median
0.87 s. Ack resolutions used: fix-sha 398, wontfix 179, environment-only 171,
thread-url 59, observed 57, waive 5.

**Inbox kind census, 1,051 rows in 64 checkouts:** `local-shard-failed` 605,
`check-failed` 268, `review-thread` 104, `proof-job-finished` 72,
`pr-merge-ready` 3, **`base-drift` 0**, **`sibling-collision` 0**. The conflict
class has never produced a row on this box, and the one kind designed for
cross-checkout delivery has never been written.

**Delivery latency is unmeasurable from disk.** 1,055 valid session files carry
exactly `[incidentId, schemaVersion, seenIds]` — there is no timestamp at any
nesting level, and the file's mtime is overwritten on every hook read. So
"when did this session first see this row" is unrecoverable, and row→ack is an
upper bound that conflates delivery with reading, attributing and fixing. The
deciles show the real shape: 30% of rows acked within 32 s, 50% within 120 s;
the p90 and max are dominated by long-abandoned checkouts.

**Hook cost trajectory.** The ack scan spawns two jq processes per receipt
(`.claude/hooks/yeet-inbox.sh:87-106`): ~3.0 ms per receipt, 0.20–0.23 s over
the live 70-receipt directory, against a `"timeout": 2` budget. Receipts grow
~3.6/day with no pruning anywhere in `Ack.ts`, so the budget is exhausted at
roughly 333 receipts (with a 1 s flock wait) to 667 (uncontended) — about
73–164 days out. Past that, delivery fails **silently**: no rows are injected
and the P0 gate stops arming.

**Stale wave record, measured.** `dispatch.json` in this checkout is pinned to
a PR and head from 2026-09-09 — 15 days stale on a branch that has moved.
Replaying the hook's own jq against that wave with zero acks: 70 unique rows
in, 11 of 13 `check-failed` rows land `superseded` and are dropped; only the
pinned PR's 2 rows survive as `live`; the 42 local-shard and 15 proof-job rows
survive as `unknown` purely because their capsules lack `prNumber`. Only the
watch stream re-pins the wave (`WatchMode.ts:822`, `:1009`);
`--until-ready`/`--until-merged` and `yeet inbox append` never do.

**Owner attribution, measured.** The workstation registry holds 803 rows over
197 PRs. **163 rows (20.3%) are `harness=unknown` + `sessionId=null` +
`entrypoint=unknown`**, and 100 of those are `role=monitored`. 40 of 197 PRs
have no resumable row at all; 47 of 197 do not resolve under the default
newest-`created`/`pushed` selection, while 157 have at least one resumable row
— a 7-PR gap where `--agent N` works and the bare command does not. The cause
is closed-loop: the detached monitor runs inside a proof-job unit whose env
allowlist admits neither `CLAUDE_CODE_SESSION_ID` nor `CODEX_THREAD_ID`
(`ProofJob.ts:146-165`, `:182`), and harness is classified from those two
variables alone (`Provenance.ts:1301-1302`). Observed directly: one PR's
`created` row is `codex/<session>` at 00:10:01Z and its `monitored` row is
`unknown/null` 37 s later, written from the checkout a running detached
monitor owns. Only 4 of 59 distinct recorded Claude session ids were live at
read time.

### Caveats

- `pushedAt` is not a push event; it is the commit's committer date
  (`MonitorPolicy.ts:318-320`), so every `pushed→X` figure carries the
  commit-to-push gap as unknown error.
- §A measures GitHub→receiver for `workflow_job` only. It is not the latency of
  a comment, a review, a conflict or a `check_run`, none of which this repo
  delivers by webhook.
- Poll timings were taken against a small PR (40 checks, 17 required, 5 threads
  on one GraphQL page, all comment collections single-page). A PR that
  paginates adds one sequential round trip per 100 items.
- `gh` RTTs include process startup and shared-network jitter, and the jitter is
  large relative to the signal (`gh run list` ranged 1,269–4,708 ms within one
  round). The 326 logged poll periods are the reliable cadence measure.
- The 869 row→ack pairs span 64 checkouts and roughly a month, mixing code
  versions; per-kind medians are not a controlled comparison.
- The orchestrator's pre-fact timeline for one PR (pushed 23:13:17Z → ready
  23:24:10Z) could not be verified: that job record is a `publish`, its log ends
  before the claimed gate line, and the timestamp appears in no job log on the
  box. The three verified on-disk gates are 2,327 / 3,224 / 3,273 s — an order
  of magnitude slower, on code boards rather than a docs board.
- `gh api rate_limit` is unreliable for this credential (reported 0/5000 before
  and after ~100 REST GETs); the `X-Ratelimit-*` response headers are what was
  used.
- §B measures the mode-equivalent call chains, not a whole poll: convergence,
  diffing and artifact writes are excluded from per-call numbers but included in
  the 326 logged periods, which is why median logged work slightly exceeds the
  measured chain.
- Coordinated latency is unmeasured: if GitHub's mergeability recompute or check
  registration lags, the poll sees nothing and the next poll pays a full
  interval again.

## Constraints Discovered

**GitHub platform.**

1. Conflicts cannot be pushed. No webhook event reports mergeability; the
   documented path is webhook-then-poll; the REST read is what schedules the
   recompute. Every surveyed product has the same hole. Conflict awareness is
   poll-only for anyone.
2. A receiver must ack in 10 s, GitHub never retries, order is not guaranteed,
   delivery history is 3 days, payloads over 25 MB are silently dropped, and a
   delivery `guid` is shared across all hooks subscribed to that event — so the
   fold must be commutative per head and the dedupe key cannot be the GUID
   alone.
3. Repository webhooks see `check_run` `created`/`completed` only, and
   `check_run` does not trigger Actions workflows for Actions-created check
   suites — our own red lanes cannot relay themselves through Actions. Nor can
   Yeet's own bot comments: `GITHUB_TOKEN`-triggered events create no workflow
   runs outside `workflow_dispatch`/`repository_dispatch`.
4. The Notifications API is classic-PAT-only, so notification-based wake and
   GitHub-App bucket isolation are mutually exclusive; and on this account
   notification delivery for this repo is unproven.
5. GraphQL has no 304 path; REST does and it is free when authorized. The
   cheapest poller is REST+ETag plus exactly one GraphQL call, because thread
   resolution has no REST representation.
6. A GitHub App buys bucket isolation, not headroom, for this org (free plan,
   5 repos, 1 member ⇒ flat 5,000/hr).

**Existing infrastructure.**

7. The one live webhook is the CI autoscaler's and carries `workflow_job` only.
   Enabling the module's `eventbridge` input reroutes `workflow_job` off the
   direct queue dispatch — a behaviour change on the live CI critical path,
   bounded by `runners_maximum_count: 2`,
   `scale_up_reserved_concurrent_executions: 1`
   (`infra/src/CiFleetController.ts:973`, `:981`) and a signed $200/mo ceiling
   (`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md:76-78`).
   Applies need a reviewed preview and the operator attending
   (`docs/runbooks/ci-runner-reliability.md:88-100`).
8. No GitHub Pulumi provider is installed and org hooks are unreadable with the
   current token scopes, so a second or org-level webhook has no first-class
   IaC path today.
9. Nothing on the workstation consumes an AWS push transport, and there is no
   standing AWS credential. Every delivery leg from AWS to this box is net-new.
10. GitHub cannot reach this workstation: the repo's only tunnel primitive is
    tailnet-only `tailscale serve`, Funnel appears nowhere, and the posture is
    explicitly no-funnel. So either AWS stays the always-on receiver or the leg
    is outbound-only.
11. `gh webhook forward` is one-per-repo, documented as unsupported in
    production, and currently exits on the first socket close.

**Harness.**

12. Channels require Anthropic auth at claude.ai or a Console API key and are
    unavailable on Bedrock / Google Cloud Agent Platform / Microsoft Foundry;
    whether they work behind this workstation's local proxy is **untested**.
    Remote Control is definitively excluded when `ANTHROPIC_BASE_URL` is
    custom, which rules it out for the proxy wrappers.
13. `MCP_PROTOCOL_NEGOTIATION=auto` de-registers a channel server that
    negotiates revision `2026-07-28` — and this repo already holds an MCP
    server behind that exact variable.
14. The Monitor tool is unavailable when `DISABLE_TELEMETRY` or
    `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set; plugin monitors are
    interactive-only and never run in `-p`.
15. Cross-session inbound **holds** a message sent into a bypass-permissions
    session unless the sender also asserts bypass or is verified as the
    session's own child. A relay spawned from a hook is delivered; a standalone
    daemon needs `crossSessionInbound: accept`.
16. The message line format for the inbox socket is undocumented (the auth line
    is documented; the payload shape is not). Any relay must establish it
    empirically and treat it as unstable.

**This repo's own mechanics.**

17. `base-conflict` yields `settled: false, budgetApplies: false`
    (`Settle.ts:940-950`), and the only terminal settle reason is
    `settle-timeout` (`:1128-1129`), so no loop mode can end on a conflicted
    PR; the code documents the wait as clearing "when the operator merges the
    base and pushes" (`CheckOutcome.ts:60-64`). There is no conflict row kind.
18. `--until-ready` — the canonical detached recipe — writes only
    `pr-merge-ready`. A required red is stdout plus an exit code.
19. Rows land only in the checkout that ran the command
    (`Inbox.ts:1085`); 64 independent inboxes exist on this box, and a linked
    worktree counts as its own because the hook's root walk accepts a `.git`
    file. There is no cross-checkout delivery mechanism.
20. The hook and the CLI compute row liveness by different rules — the CLI
    escapes four kinds by kind (`InboxView.ts:154`: `sibling-collision`,
    `local-shard-failed`, and the observed kinds `proof-job-finished` and
    `pr-merge-ready`), the hook escapes one kind plus a capsule-shape test
    (`yeet-inbox.sh:141-143`) — and both supersede every capsule carrying
    `(headSha, prNumber)` on a head mismatch, which includes `review-thread`
    and `base-drift` (`Inbox.ts:315-317`, `:378-379`). They agree today only
    because the kinds the CLI escapes and the hook does not have capsules
    without `prNumber`, which the hook keeps as `unknown`. (Corrected
    2026-09-25; the earlier text said no non-check capsule carries
    `prNumber`. Thread and drift capsules do. The 11-of-13 drop measured
    above was `check-failed` rows against a stale pin, not thread rows.)
21. Any writer that appends a row without re-pinning the wave has its
    `review-thread` and `base-drift` rows silently superseded against a
    possibly ancient `dispatch.json`.
22. The detached proof-job env allowlist strips both harness session ids, so the
    canonical babysit erases its own owner attribution.
23. The hook's hot path grows with an unpruned ack directory and fails silently
    past its 2 s budget.
24. systemd path units ignore dotfiles — so `.beep/` cannot be watched by
    basename — carry a 2 s/200 trigger limit that fails the unit, and expose
    `$TRIGGER_PATH` as explicitly lossy. Timers default to 1 minute accuracy.
    inotify headroom on this box is ample.

## Binding-gap analysis (2026-09-24)

### Gap 1 — push source: **narrowed, and re-scoped**

Its GitHub half is measured and small. A webhook delivers in a median 2.08 s
(p90 2.86 s, n=41 completed) versus a 10 s poll phase whose expected
contribution is 5.0 s and whose worst case is 10 s — so a receiver buys roughly
8 s on average and ~16 s at worst-case phase, against a hosted board that takes
15–25 minutes. The three verified `pushed→ready` gates are 2,327 / 3,224 /
3,273 s; seconds at the front of that are not what makes a PR slow.

Its in-repo half is not small at all, and the measurement moved it. Today the
one active webhook carries `workflow_job` only, so **none of the three spark
events has a push source**; and the mode agents actually run
(`--until-ready`, 6 of 6 detached monitor jobs, 0 detached `--watch`) has no
producer for any of them. Cheap wins that do not need a receiver: collapse the
watch poll from 10 GraphQL requests to one combined query at cost=1 (measured),
and request `completedAt`/`startedAt` in the two `gh pr checks --json` call
sites so the latency this section argues about becomes measurable from
artifacts at all.

### Gap 2 — idle wake: **narrowed by the vendor, still unbuilt here**

The capture's premise is now false as a product statement: 33 hook events
exist, `Notification`/`idle_prompt` and `FileChanged` fire with no tool call,
and `asyncRewake` exit 2 "wakes Claude immediately even when the session is
idle". Cross-session messaging is documented as starting a new turn on an idle
receiver, over a local socket, on every provider, with a plain local script
sanctioned as the sender. The desktop app already wakes a bound session with a
`<ci-monitor-event>` on exactly the three spark events.

None of it is wired in this repo: `rg 'asyncRewake|FileChanged' .claude/`
returns nothing, ruling 46's PR2 spike (`goals/time-to-certainty/research/decisions.md:528-540`)
is still unexercised, there is no channel server, and the delivery hook has no
timer — four event boundaries only. The gap is real but no longer the hard part,
and its measurement is the weakest in this report: session files carry no
timestamps, so row→delivery cannot be separated from row→ack (median 119 s,
30% within 32 s, dominated at the tail by abandoned checkouts).

### Gap 3 — lane dispatch: **open, untouched since capture**

The wave record still covers checks only. `review-thread` (P1) and
`base-drift` (P2) rows exist but bypass the wave's coalescing entirely
(`WatchMode.ts:605-655`), so they are never queued as capsules — yet both
readers still supersede them on a head mismatch against the pin, because
their capsules carry `(headSha, prNumber)` (finding 20, corrected
2026-09-25); `Remediation.ts:670-729` only ever takes a check. There is
no launcher: `dispatch.json`'s only consumers are the watch stream and a
liveness read, and `--detach` exists on no fixer command. The stale-wave replay
shows the cost of appending rows from a non-watch writer — 11 of 13
`check-failed` rows dropped as superseded against a 15-day-old pin. The best
external pattern is content-addressed, not head-addressed: Bugbot stores the
git patch-id and skips a same-patch-id diff, which a rebase-preserving fix
would benefit from.

### Gap 4 — dead owner: **open, and measurably worse than the capture thought**

A4's takeover stays retired by operator PR #921, and nothing found externally
restores a dead owner (`--resume`/`--continue`/`--fork` all start a new process
from a transcript). The measurement adds a new failure: 163 of 803 registry
rows (20.3%) are unresumable, 100 of them written by detached monitors, because
the proof-job env allowlist strips both harness session ids. 40 of 197 PRs have
no resumable row; 47 of 197 fail default selection while 157 have one. The
primitives A4 wanted are all live but pointed elsewhere — `ProcessIdentity`'s
procStart fence, `beep worktree new` / `yeet sweep --retire`, and the systemd
launcher. Turning them back on at the PR layer reverses an explicit operator
fence, which is an align decision, not a research finding.

### The binding gap

**Push source, scoped to its in-repo half: event capture in the mode agents
actually run.** `yeet monitor --until-ready --detach` — the recipe the yeet
skill makes canonical, and the only mode ever run detached (6 of 6 monitor
jobs; zero detached `--watch`) — writes exactly one row kind,
`pr-merge-ready`, and has no producer for a required red, a review thread or a
conflict. Across 1,051 inbox rows in 64 checkouts there are **zero**
`base-drift` rows. A conflicted PR additionally cannot terminate any loop mode,
by construction (`budgetApplies: false` with `settle-timeout` as the only
terminal reason).

The reasoning is that the other three gaps are all downstream of an event that
is never recorded. A webhook cannot improve a median that does not exist. An
idle-wake primitive — `asyncRewake`, the inbox socket, a channel, or the
desktop switch — has nothing to deliver. A dispatch policy has no capsule to
coalesce, and an owner has nothing to be woken about. Meanwhile the delivery
and wake halves are both cheaper than the capture assumed: the poll contributes
≤16 s in watch mode, the inbox write is local and idempotent, and the wake has
at least four documented vendor mechanisms of which one already fires on
exactly the right three events. Fix the producer and the rest becomes a
delivery-mechanism choice; leave it and everything else is theatre.

### Questions the align stage must grill

- Which mode owns durable delivery — does `--until-ready` gain the watch's
  convergence (`check-failed`, `review-thread`, `base-drift`), or does the
  canonical detached recipe become `--watch --detach`? Today the skill's
  canonical mode is the one that loses the bad news.
- What terminates a conflicted PR? A `base-conflict` verdict is
  `budgetApplies: false` and never terminal, and no conflict row kind exists.
  Add a row kind plus a terminal, or keep an unbounded named wait and deliver
  it some other way?
- Do we forward `CLAUDE_CODE_SESSION_ID` and `CODEX_THREAD_ID` into the
  proof-job env allowlist — a two-name change that addresses 100 of the 163
  unresumable rows — and is a session id credential-shaped enough that the
  allowlist should stay closed?
- Which wake mechanism, and does it work in `claudex`/`claudeg` proxy sessions?
  `asyncRewake` exit 2, a cross-session socket write from a hook-spawned child
  under own-child verification, a channel server, or the desktop
  `set_monitor auto_fix` switch. Channels' proxy-session support is untested and
  Remote Control is definitively out.
- Given that the desktop app already wakes a bound session on CI failures,
  merge conflicts and review comments, what does this packet add that the switch
  does not — attribution, per-head coalescing, durability across a dead
  session, terminal-session parity — and is that enough to build anything?
- Does the wave record extend to threads and conflicts so they are coalesced
  and superseded per head, and what re-pins `dispatch.json` for a row appended
  by a non-watch writer? Should the supersede key be the head SHA or a
  patch-id, so a rebase that preserves the diff is skipped?
- Cross-checkout delivery: rows land only in the checkout that ran the command
  (64 inboxes). Does the orchestrator share a checkout with the monitor, does
  `yeet inbox append` gain a target, or does `sibling-collision` finally get a
  producer?
- Push source decision: keep the poll (and cut it from 10 GraphQL requests to
  one combined query at cost=1), or stand up a receiver? If a receiver, does it
  flip the CI autoscaler's `eventbridge` input — a live-CI behaviour change — or
  get its own API Gateway on the `CiTurboCache` shape, and who mints the second
  secret with no GitHub Pulumi provider? The existing in-repo design at
  `goals/ship-velocity/research/c2-yeet-monitor-backpressure.md:371-385` is the
  starting point, not a blank page.
- Dead owner: does the wake fall through to `yeet resume`, a fresh
  footer-seeded orchestrator, or a warm fixer — and does any of those reverse
  operator PR #921's fence?
- Measurement debt: do we add `completedAt`/`startedAt` to the two
  `gh pr checks --json` call sites, and a timestamp to the hook's session
  files, so event→row and row→delivery become measurable instead of inferred?
- Is the unpruned ack directory in scope here (~3.0 ms per receipt against a
  2 s hook budget, silent failure at roughly 333–667 receipts, about 73–164
  days out) or a separate P2?
