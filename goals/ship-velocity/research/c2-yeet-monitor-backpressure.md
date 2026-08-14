# Lane C2 — Yeet monitor mechanics and sub-minute backpressure

Date: 2026-08-13

## Concrete findings

### 1. The main delay is not GitHub polling; Yeet omits an available fail-fast flag

The ordinary monitor plan is exactly two subprocesses: `gh pr view --json
number,headRefName,state`, then `gh pr checks --watch`
(`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:472-503`). The
handler decodes the PR number and races the check watcher against a comment
poller (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:668-705`).

This looks fail-fast in Yeet's comments, which say plain monitor “exits on the
first red” (`packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:2-8`),
but the planned command does **not** pass `--fail-fast`
(`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:486-498`). The
upstream GitHub CLI defaults to a 10-second interval, exposes both
`--fail-fast` and `--required`, and, without `--fail-fast`, breaks only when no
checks remain pending; with it, it breaks as soon as a failed check is present
([GitHub CLI source](https://raw.githubusercontent.com/cli/cli/trunk/pkg/cmd/pr/checks/checks.go),
lines 20, 110-113, 192-217). Therefore a failure visible on GitHub at T0 can be
polled by `gh` at T0+0..10s yet withheld from the Yeet process until the last
pending lane ends. In this repo that tail can be 20-30 minutes: current p95 is
29.5m for Coverage Regression, 24.3m for Lint, and 20.6m for Lint Policy
(`goals/ci-lane-economics/research/cache-warm-lane-census.md:10-12`,
`goals/ci-lane-economics/research/cache-warm-lane-census.md:42-52`).

This is the highest-confidence explanation for “the agent realizes very late.”
The one-token behavioral change is to plan `gh pr checks --watch --fail-fast`;
the larger watch redesign should not delay that fix.

### 2. There are two monitor modes with materially different semantics

| Mode | Cadence | What it watches | Exit |
| --- | --- | --- | --- |
| Plain `yeet monitor` / publish `--monitor` | GitHub CLI checks every 10s; comments every 10s | One current PR head's full check rollup plus new inline/conversation comments | All checks terminal (green or red), comment-poll failure, or interrupt. Despite source prose, it does not currently exit on first red. |
| `yeet monitor --until-merged` | 30s | Re-runs full `yeet status --remote`; follows new heads; triages red jobs | Only PR `MERGED`, PR `CLOSED`, error, or interrupt; merge invokes the post-merge sweep. |

The command dispatcher selects the separate merge loop only for
`--until-merged` (`packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:365-371`).
That loop sets a fixed 30-second default (`packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:81-84`),
re-collects and prints the entire status snapshot each tick
(`packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:770-801`),
and sleeps/repeats until merged or closed
(`packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:836-860`).
It follows a new head without restart and deliberately keeps running after a
real red (`packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:809-818`).

The ordinary comment stream initializes both cursors at process start, not from
the last known comment, and polls forever every 10 seconds
(`packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorComments.ts:488-499`).
Each tick concurrently calls the REST endpoints
`GET /repos/{owner}/{repo}/pulls/{pr}/comments?per_page=100&since=...` and
`GET /repos/{owner}/{repo}/issues/{pr}/comments?per_page=100&since=...`
(`packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorComments.ts:390-410`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorComments.ts:420-455`).
It prints each new comment to stdout (`packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorComments.ts:376-384`),
but it does not persist the cursor or event. A comment just before startup is
missed; a review body without an issue comment or inline review comment is not
covered; and `Effect.raceFirst` means the stream is interrupted as soon as the
check watcher finishes. Conversely, one transient REST/decode error can win the
race and terminate check monitoring (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:702-705`).
`--until-merged` does not run this comment stream at all; it sees unresolved
threads only on its next 30-second full-status poll.

### 3. Exact GitHub reads and writes

#### Plain monitor, including its terminal status summary

1. `gh pr view --json number,headRefName,state` discovers the current PR
   (`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:472-484`).
   `gh pr view` is a GitHub CLI GraphQL read.
2. `gh pr checks --watch` uses a paginated GraphQL `statusCheckRollup` query on
   the pull request node. GitHub CLI reissues it every 10 seconds until its exit
   condition ([GitHub CLI source](https://raw.githubusercontent.com/cli/cli/trunk/pkg/cmd/pr/checks/checks.go),
   lines 242-292).
3. In parallel, Yeet makes the two REST comment GETs above every 10 seconds.
4. On a check-watcher failure, `failWithRerunGuidance` collects and prints a
   fresh remote status; on success, monitor does the same
   (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:598-645`).
   That status fan-out is:
   - GraphQL `gh pr view --json id,number,url,state,mergeable,mergeStateStatus,isDraft,reviewDecision,headRefOid`;
   - GraphQL `gh pr checks --json name,state,bucket`;
   - one explicit GraphQL PR-node query for the first 100 review threads and
     each thread's first comment;
   - Actions REST through `gh run list --branch ... --limit 20`.
     The commands and joins are in
     `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:618-688` and
     `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:813-901`.

The monitor does **not** call closeout's comprehensive Greptile collector on
each tick. Fresh Greptile state is inferred only when `yeet closeout` paginates
top-level comments, review threads, and reviews over GraphQL
(`packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/GhCollect.ts:127-234`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/GhCollect.ts:266-296`).
Those queries request 100 nodes per page and up to 100 nested comments
(`packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Gh.schemas.ts:966-1053`),
then `runPrCloseout` derives Greptile score/issue count from bot comments and
Greptile-authored threads (`packages/tooling/tool/cli/src/commands/Yeet/internal/Closeout.ts:87-135`).
During monitor, a Greptile comment may appear on stdout, but its score is not
parsed into live readiness; the displayed score comes from the prior closeout
artifact.

#### Long-lived merge loop

Every 30-second tick makes the full status fan-out above. If checks are red, it
then calls `gh run list` a second time, `gh run view <run> --json jobs` for each
same-head failed run, and `gh run view --job <job> --log-failed` for every red
job not classified from job shape (`packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:650-707`).
Known infrastructure flakes may cause the GraphQL/REST-backed Actions mutation
`gh run rerun --job <databaseId>` once per `(head SHA, job name)`
(`packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:710-729`).

#### `yeet reply`

`yeet reply` loads `.beep/yeet/.../reply-drafts.json`, calls `gh repo view`,
then paginates a GraphQL `reviewThreads(first:100)` query carrying thread IDs,
resolution state, location, and the first 100 comment node/database IDs
(`packages/tooling/tool/cli/src/commands/Yeet/internal/Reply.ts:148-169`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Reply.ts:766-804`). It posts
with `addPullRequestReviewThreadReply` and optionally resolves with
`resolveReviewThread`, serially (`packages/tooling/tool/cli/src/commands/Yeet/internal/Reply.ts:806-860`;
mutation definitions at
`packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/WritePlan.ts:31-64`).
It writes `reply-report.json` and prints one outcome per draft plus a summary
(`packages/tooling/tool/cli/src/commands/Yeet/internal/Reply.ts:963-1015`).
Notably, per-draft post/resolve failures are represented in the report but exit
0; only a preflight that attempts nothing exits nonzero
(`packages/tooling/tool/cli/src/commands/Yeet/internal/Reply.ts:908-937`). An
agent that relies on exit code alone can therefore miss failed replies.

### 4. Results reach the process, not the agent

During plain monitoring, check state is GitHub CLI's terminal display and new
comments are stdout lines. Only after the watcher exits does Yeet print the
compact status block (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:598-627`).
The block includes totals, unresolved-thread triage, merge readiness, artifact
path, and next command (`packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1223-1242`).

It also overwrites a branch-scoped `status.json` under
`.beep/yeet/runs/<sanitized-branch-hash>/` (`packages/tooling/tool/cli/src/commands/Yeet/internal/ArtifactPaths.ts:64-65`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/ArtifactPaths.ts:111-118`,
`packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1260-1273`). A
normal monitor run writes a terminal `verdict.json` on success or failure
(`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:1079-1115`).
The long-lived loop overwrites `status.json` every 30 seconds but has no event
journal (`packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:779-781`).

There is no notification transport, agent session registry, file watcher, or
callback. If an agent launches monitor in the foreground and remains attached,
its observation latency is the monitor latency. If it backgrounds the command
without attaching a Monitor tool, leaves the turn, or works on something else,
latency is **unbounded** until the agent/operator explicitly reads stdout,
checks the process, reads `status.json`, or reruns a command. This mechanism
fully explains why operator reminders are needed even when GitHub has already
recorded the event.

### 5. `merge-ready: yes` is narrower than GitHub mergeability and weaker than its name

The three enforced criteria, in order, are:

1. a `pr-closeout.json` exists and its `reviewedHeadSha` equals the PR's current
   head;
2. a check collection was read and has zero failing and zero pending checks;
3. the live unresolved-thread count is zero and the closeout artifact has no
   positive issue count.

This is the exact derivation in
`packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:913-949` and
`packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:999-1014`.
Pending checks correctly block (`packages/tooling/tool/cli/test/yeet-status-triage.test.ts:162-179`),
a missing/stale-head closeout blocks
(`packages/tooling/tool/cli/test/yeet-status-triage.test.ts:199-242`), and schema
checks reject contradictory readiness records
(`packages/tooling/tool/cli/test/yeet-merge-ready-coherence.test.ts:25-103`).

However, the code fetches `state`, `isDraft`, `mergeable`, `mergeStateStatus`,
and `reviewDecision` but none is a readiness criterion
(`packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:820-900`). Greptile
score is explicitly display-only; the test accepts ready with `4/5`
(`packages/tooling/tool/cli/test/yeet-status-triage.test.ts:297-305`). Thus the
current value can say yes for a draft, conflicting/blocked/closed PR, a PR
without an approval, or a closeout run that did not enable the strict Greptile
flags. Also, `checksGreen` currently evaluates every check returned by
`gh pr checks`, not the live required set, so a non-required external red can
block. The current live source of truth is ruleset `10240248` with 16 required
contexts; `JSDoc Ratchet` is visible but not required
(`goals/ci-lane-economics/research/cache-warm-lane-census.md:16-21`).

### 6. Tests protect pure triage more than live backpressure

`yeet-monitor-loop.test.ts` thoroughly tests failure fingerprints and rerun
budgeting, but its listed cases end with pure terminal-state/render assertions;
it does not drive the 30-second loop, API errors, head transitions, comment
stream, or check-watch exit behavior
(`packages/tooling/tool/cli/test/yeet-monitor-loop.test.ts:80-351`). The status
and merge-ready tests strongly protect triage/coherence
(`packages/tooling/tool/cli/test/yeet-status-triage.test.ts:153-305`,
`packages/tooling/tool/cli/test/yeet-merge-ready-coherence.test.ts:118-180`), but
there is no contract test that would notice the missing `--fail-fast` or prove
T0-to-emission latency.

### 7. Prior art is directionally right but partially stale

The older fast-monitor study correctly demanded a repo-owned monitor and warned
against relying on required-only checks before ruleset proof existed
(`goals/repo-quality-throughput/research/batch-03-yeet-fast-monitor.md:8-18`,
`goals/repo-quality-throughput/research/batch-03-yeet-fast-monitor.md:44-68`).
That implementation gap has since closed, and current research now has a live
16-context ruleset boundary. The fail-fast study correctly said to extend the
existing state machine, not create another ship workflow, and to run local proof
and hosted observation concurrently (`goals/speed-loop/research/r1-failfast-yeet.md:14-27`,
`goals/speed-loop/research/r1-failfast-yeet.md:237-264`). Its statement that
monitor was “only `gh pr checks --watch`” predates the comment stream,
merge-following loop, structured status, and flake triage, but its missing
agent-repair transition remains true.

Cancellation must be SHA-safe. The workflow already cancels an older PR run
when a new head starts (`.github/workflows/check.yml:9-11`), while the current
economics ledger records that retrying an obsolete run cancelled the current
head's whole matrix and recommends refusing stale-head reruns
(`goals/ci-lane-economics/research/OPPORTUNITIES.md:110-121`). It also records
a job rerun rejected while its containing workflow was still running
(`goals/ci-lane-economics/research/OPPORTUNITIES.md:95-108`).

## End-to-end latency budget

Assume GitHub records a required-check failure at T0.

| Agent state | Current detection | Current delivery to agent |
| --- | --- | --- |
| Foreground plain monitor | GitHub CLI observes in 0-10s, but without `--fail-fast` Yeet returns only after every pending check finishes: **0-10s + remaining suite tail**, up to roughly the 20-30m current p95 tail. | Terminal output and nonzero exit only then; status/verdict written at exit. |
| Foreground `--until-merged` | Next full poll in 0-30s, plus API time; red-job log triage follows. | Full repeated stdout snapshot and overwritten `status.json`; process does not exit on real red. Agent notices only if its tool is attached to process output. |
| Agent doing other work / no attached watcher | GitHub state may be current immediately; no repo mechanism awakens the agent. | **Unbounded/manual**. Operator reminder, explicit process poll, or rerun is the effective notification. |
| Review inline/issue comment during foreground plain monitor | 0-10s while checks watcher remains alive. | Stdout only; no durable event. |
| Review thread/comment under `--until-merged` | 0-30s via status GraphQL query. | Repeated status stdout + `status.json`; no transition notification. |

Target budget for the redesigned path: GitHub event publication 0-5s + active
poll/webhook delivery 0-10s + normalization/emission under 1s = **p95 under 15s
for a check red and under 30s for review/thread state**, with a durable event
that the agent monitor can consume.

## Ranked recommendations

### Rank 1 — Ship the fail-fast and required-check interim patch

**Design.** Change the planned check step to:

```text
gh pr checks --watch --fail-fast --required --interval 10
```

Gate `--required` on a current ruleset snapshot/provenance check; if required
resolution fails, fall back loudly to all checks rather than returning a false
green. Keep a separate closeout read for all unresolved review threads. Add a
focused planner/handler test that asserts the exact flags and a fake-`gh` test
with one red plus one pending check that must terminate after the first red
poll. Correct the inaccurate “already exits on first red” prose.

**Impact:** Critical; changes failure delivery from the remaining suite tail to
0-10s for an attached agent. Watching only the 16 required contexts prevents an
optional external red from blocking readiness. **Effort:** XS-S, roughly 20-80
LOC plus fixtures. **Risk:** Low-medium; required-context metadata can drift,
as it already did (`goals/ci-lane-economics/research/OPPORTUNITIES.md:30-38`).
Fail closed to all-check watching when provenance is absent.

**API cost:** Same GraphQL poll rate as today, but fewer polls because the
process exits at first red. No new calls.

**Cancel remaining runs:** Do not couple notification to cancellation in this
patch. The first red should awaken the agent immediately while already-running
lanes continue to yield useful sibling evidence, matching the earlier
wave-fail-fast decision (`goals/speed-loop/research/r1-failfast-yeet.md:93-105`).
A later `--cancel-on-required-failure` may cancel only workflow runs whose
`head_sha` equals the PR's current head, only after recording the first failure,
and never cancel/retry an obsolete run. Cancellation saves fleet minutes but
can erase multi-failure evidence and turn checks into cancelled noise.

### Rank 2 — Add a transition-oriented `yeet monitor --watch`

**Design inside the Effect v4 CLI.** Build one `YeetWatchEvent` tagged schema
(`head-changed`, `check-failed`, `check-passed`, `comment-opened`,
`thread-opened`, `thread-resolved`, `mergeability-changed`, `merge-ready-changed`,
`rate-limited`, `watch-error`) and a `Stream` of normalized snapshots. Use
`effect/unstable/http` `HttpClient` with the already-provided Bun client layer
(`packages/tooling/tool/cli/src/bin-main.ts:91-106`), not native `fetch` or
`node:http`. Keep GitHub auth redacted and injected; parse responses through
schemas. Maintain an in-memory map keyed by `(PR, headSha, kind, stableId)` and
emit exactly one stdout/NDJSON line only when normalized state changes. Append
the same events to branch-scoped `monitor-events.ndjson`; atomically overwrite
`status.json`. Emit a five-minute heartbeat separately so silence means “no
change,” not “dead.”

Poll lanes independently:

- required checks/statuses: 10s while any required check is queued/running,
  30s when terminal;
- REST inline + issue comments: 15s;
- PR head/state/draft/mergeability: 30s;
- GraphQL review-thread resolution: 15s while open/review activity is recent,
  30s otherwise.

Use authenticated `ETag` / `If-None-Match` on stable REST GETs and honor
`Retry-After`, `x-ratelimit-reset`, and any `x-poll-interval`. GitHub states
that authorized conditional GETs returning 304 do not consume the primary
limit and recommends webhooks or conditional polling
([REST best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2022-11-28)).
Back off transient errors with jitter (10s, 20s, 40s, cap 60s), but keep the
last good state and emit one `watch-error` transition rather than letting a
comment failure cancel check monitoring.

The process follows new heads and exits only on merged/closed/operator
interrupt by default; `--until-checks-terminal` gives publish its bounded
child-process behavior. A Claude Code Monitor tool attaches once to the
long-running process and receives newline transitions; it no longer has to
relaunch `yeet monitor` or parse repainting terminal tables.

**Impact:** Highest durable agent-leverage; p95 check notification under 15s,
review/thread under 30s, and no operator reminder when the agent has attached
the process. **Effort:** M, roughly 300-600 LOC plus deterministic clock/HTTP
fixtures. **Risk:** Medium; state deduplication, head rollover, auth/rate-limit
handling, and process supervision are the real work.

**API math:** Today's plain pending monitor is approximately 360 GraphQL check
polls/hour plus 720 unconditional REST comment GETs/hour per PR, before terminal
fan-out. Four concurrent checkouts approach 1,440 GraphQL + 2,880 REST reads per
hour. The proposed 10s check + 15s two-comment + 30s PR schedule issues up to
1,200 HTTP requests/hour/PR, but stable REST responses should be 304 and free
of the primary limit. A 15s GraphQL thread query costs at least 240 points/hour
per PR; four PRs cost roughly 960 of the normal 5,000 points/hour. GitHub's
GraphQL documentation gives users 5,000 points/hour, a one-point minimum per
query, 2,000 secondary GraphQL points/minute, and recommends webhooks over
polling ([GraphQL limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)).
Cap active watches, serialize bursts across checkouts, and dynamically slow
unchanged terminal lanes.

**Failure modes:** 304 handling bugs, status/check split-brain, check suites
appearing after the initial empty rollup, `mergeable: null` while GitHub
computes it, GraphQL thread pagination, force-push/head rollover, laptop sleep,
lost stdout consumer, and token/rate exhaustion. Contract tests must use a
virtual clock and scripted snapshots to prove one emission per transition,
first-red latency, no missed head change, cursor persistence, and recovery
after 403/429/5xx.

### Rank 3 — Make readiness truthful and transition-worthy

**Design.** Split `checksGreen` into `requiredChecksGreen` and
`optionalChecksSummary`. Expand hard readiness to require: PR `OPEN`, not
draft, current head bound to closeout, all live required checks terminal-green,
zero unresolved threads, `mergeable === MERGEABLE`, acceptable
`mergeStateStatus`, and the repository's required review decision. Model
`mergeability === UNKNOWN` explicitly, not as red or green. Make strict
Greptile policy part of the closeout artifact (`requiredScore`,
`requiredIssues`, observed values) so readiness can prove which policy was run;
do not treat a display-only `4/5` as ready when policy requires `5/5, 0`.

Emit each criterion flip as a watch event. Preserve the coherent schema check
pattern already tested in `yeet-merge-ready-coherence.test.ts`.

**Impact:** High correctness and clearer agent action routing; eliminates false
“yes” and optional-check false blocks. **Effort:** M, 180-350 LOC plus artifact
migration/tests. **Risk:** Medium-high because review/merge-state policy must
match the live ruleset and merge queue. Roll out as `merge-ready/v2` shadow
output before making it a gate.

**API cost/latency:** No extra calls if fields are folded into the watch
snapshot; only normalization changes. Transition latency matches Rank 2.

### Rank 4 — Add a webhook-to-workstation router after polling is stable

**Design.** Prefer a repository webhook or minimally-permissioned GitHub App
subscribed to `check_run`, `check_suite`, `pull_request`,
`pull_request_review`, `pull_request_review_comment`,
`pull_request_review_thread`, and `issue_comment`. GitHub explicitly directs
review-comment/thread activity to those specialized events
([event reference](https://docs.github.com/en/webhooks/webhook-events-and-payloads)).
An Effect `HttpRouter`/`HttpServer` service verifies `X-Hub-Signature-256` over
the raw body, deduplicates `X-GitHub-Delivery`, persists a small delivery
journal, normalizes the same `YeetWatchEvent`, then routes by
`repository.id + PR number + head SHA`.

For several `../beep-effect*` checkouts, each active watcher registers
`repoRoot`, remote repository ID, branch, PR number, and head SHA in a
user-level registry/socket. The daemon fans one event to every matching
subscriber but marks stale-head registrations instead of delivering a failure
to the wrong checkout. A webhook is an edge trigger, not sole truth: on receipt
the watcher performs one conditional reconciliation read, and a slow 60-120s
poll heals missed deliveries.

GitHub cannot deliver directly to `localhost` or `127.0.0.1`; production needs
a small public HTTPS relay/tunnel or hosted GitHub App endpoint. Signatures are
mandatory, and forwarding must preserve the raw body
([webhook troubleshooting](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/troubleshooting-webhooks)).
`gh webhook forward` is suitable for a development proof but only one person
can forward a given repo/org hook at once
([GitHub CLI forwarding](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/using-the-github-cli-to-forward-webhooks-for-testing)).

**Impact:** Best steady-state latency, commonly seconds, near-zero idle API
load, and true push into all checkout watchers. **Effort:** L-XL, roughly
700-1,400 LOC plus app/webhook administration and service lifecycle. **Risk:**
High: public ingress, secret rotation, delivery replay/deduplication, daemon
availability, laptop sleep/NAT, checkout misrouting, and missed-event healing.

**API cost:** Webhook delivery itself consumes no polling budget; one
reconciliation read per relevant event plus the slow healing poll. Bursty
matrix `check_run` events should debounce by `(PR, headSha)` for 250-500ms so a
wave causes one status reconciliation, not one API read per job.

### Rank 5 — Operational cheap wins while the repo-owned watch lands

1. Agents should launch `gh pr checks --watch --fail-fast --required --interval
   10` immediately after publish and attach it to their Monitor tool. This is
   superior to `gh run watch`: PR checks aggregate all required workflows,
   while `gh run watch` watches one workflow run and misses review threads and
   external checks.
2. If using current Yeet only, prefer one attached
   `bun run beep yeet monitor --until-merged` over periodic manual invocations;
   it follows new heads within 30s. Be aware that merge triggers the workspace
   sweep and that it prints full snapshots rather than transition lines.
3. Add a supervisor convention: monitor process ID/session handle is a required
   publish result, and the agent may not end its turn while that watcher is
   unattached. The durable event artifact from Rank 2 replaces this convention.
4. Do not shorten the full-status loop below 30s as a first response. It fans
   out PR metadata, checks, GraphQL threads, and Actions runs every tick. Apply
   the 10s cadence only to cheap required-check state; use ETags and slower
   independent lanes elsewhere.

**Impact:** Immediate 10-second attached-agent feedback with almost no code.
**Effort:** XS. **Risk:** Low, except that process attachment remains a human or
agent discipline and therefore does not solve the unbounded “agent doing
something else” case. **API cost:** equal to or below current monitor when
fail-fast exits early.

## Recommended delivery order and acceptance gates

1. **PR A:** add `--fail-fast`, current required-set provenance/fallback, and
   black-box fake-`gh` latency tests. Acceptance: one failed + one pending check
   exits within one virtual 10s tick and writes a failing verdict/status.
2. **PR B:** transition schema, direct Effect HTTP polling, conditional REST,
   NDJSON journal, head rollover, and Monitor-tool contract. Acceptance: p95
   synthetic first-red emission under 15s; four simultaneous watches remain
   under 1,000 GraphQL points/hour for thread polling; no duplicate transition
   lines.
3. **PR C:** readiness v2 shadow, required-vs-optional checks, mergeability and
   review policy, strict Greptile provenance. Acceptance: draft/conflicting/
   closed/4-of-5 fixtures cannot say ready; current green fixture can.
4. **PR D:** webhook relay/daemon only if polling telemetry shows rate or
   latency pressure. Acceptance: signed delivery validation, delivery-ID
   idempotency, multi-checkout SHA routing, missed-delivery reconciliation, and
   no raw secret in logs/artifacts.

The decisive metric is not “monitor command ran”; it is
`github_observed_at -> agent_event_delivered_at`, separated into checks,
comments, threads, and mergeability. Record p50/p95, missed transitions,
duplicate transitions, 304 ratio, GraphQL points, and time spent with no
attached consumer. That closes the mechanism that currently leaves the
operator acting as the notification bus.
