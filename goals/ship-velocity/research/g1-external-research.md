# External research: merge throughput, CI backpressure, Turborepo cache, local↔CI parity, multi-agent fleets

**Lane:** g1 external research  
**Date:** 2026-08-13  
**Scope:** Web + X/Twitter evidence for the beep-effect multi-agent shipping pipeline. Prefer 2025–2026 sources.  
**Operator context (from `problem-statement.md`):** solo operator, sibling checkouts of one TS/Effect-v4 monorepo, `yeet` CLI (`repair` → `verify` → `publish` → `monitor`), ~17 required GitHub Actions checks, Greptile/openclaw review threads, PR-only main, real (non-flaky) CI failures. Pain: slow CI/review backpressure, local≠remote, cold Turborepo cache, over-serialized local runs, hot-file merge treadmill on derived registries.

Vendor claims (Mergify, Trunk, Graphite, Cachely) are labeled as such. Independent measurements and practitioner reports are called out separately.

---

## 1. Merge throughput for busy repos

### What a merge queue actually buys

A merge queue exists to stop the rebase race: two PRs that are each green on yesterday's main can still break today's main when they land together. GitHub's native queue (GA since July 2023) does this by creating temporary `gh-readonly-queue/{base}` / `merge_group` branches that contain `main + PRs ahead + this PR`, then merging only after required checks pass on that predicted tree ([GitHub docs, "Managing a merge queue"](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)).

GitHub's knobs that matter for this operator:

- **Build concurrency:** 1–100 concurrent `merge_group` webhook dispatches. This is the real throughput cap.
- **Merge limits:** min/max PRs merged to the base at once (1–100) plus a wait timeout. These do **not** combine `merge_group` *builds* — they only batch the final land onto main after each group has already been tested.
- **Jump-to-front** rebuilds every in-flight group (breaks the commit graph). GitHub warns that heavy use of this "can slow down the velocity of merges."
- **Failure mode:** if PR #1 fails in the group, GitHub ejects it and *recreates* later groups without it — another full required-check suite.

Required checks on `pull_request` and `merge_group` are **coupled**. Workflows must subscribe to both events or the queue sits forever pending. Teams cannot natively declare "cheap checks on the PR, expensive checks only in the queue" without `if:` workarounds that lose the test-on-final-state guarantee ([GitHub community #103114](https://github.com/orgs/community/discussions/103114), Feb 2024, still the standing limitation as of 2025–2026 commentary).

### The cost: required-check suites run again, per queue entry

This is the first-order regret. Early GitHub Merge Queue testers turned it off within hours:

> "Since every merge request has to re-run status checks separately before being added to the queue and before merging, this added a significant amount of time to our deploy process (an additional ~10–15 minutes per pull request, plus time waiting for merges ahead of you)."  
> — [benjaminmurphy, GitHub Community #14801, 2022-04-12](https://github.com/orgs/community/discussions/14801) (17 👍)

A 30-minute suite with a 2-build concurrency cap left one team staring at an 8-PR queue that would take two hours (same thread, danlucraft). `jgoux` added: "it doubles the time we have to wait, the CI is running against the exact same code."

That "CI twice" tax is still the 2025–2026 vendor consensus:

- Trunk (2025-09-02): "Every PR runs CI twice: once on the branch, once in the merge group. No batching." ([Outgrowing GitHub merge queue](https://trunk.io/blog/outgrowing-github-merge-queue))
- Mergify (2025-12-17): GitHub "solved safety, not scale." CI of 30–90 minutes plus finite runners turns the queue into a traffic controller, not a guardrail. ([GitHub Merge Queue Was Step One](https://mergify.com/blog/github-merge-queue-was-step-one-real-ci-orchestration-comes-next))
- Mergify (2026-06-24): a serial queue with a 30-minute suite drains at ~2 PRs/hour. Fine at 10 PRs/day; at 20–30/day the backlog grows faster than it drains. Claimed first-month saving after batching + bisect: **60–80% of queue-related CI minutes**. ([When to Outgrow GitHub's Merge Queue](https://mergify.com/blog/when-to-outgrow-github-merge-queue))

GitHub *does* have merge-group batching of a sort (merge min/max), but it is "merge after green," not "one CI run for N PRs." Speculative batching (test `{1}`, `{1+2}`, `{1+2+3}` in parallel, bisect on red) is what Graphite / Mergify / Trunk sell.

### When teams regret merge queues

Documented regret modes, ranked by how often they show up in 2025–2026 writing:

1. **CI is already long and you just doubled it.** 10–15 extra minutes per PR was enough to disable the beta; 30–45 minutes is the line where trunk-based authors say "nobody merges four times a day" ([Mergify TBD guide, 2026-05-19](https://mergify.com/learn/trunk-based-development): "Around 10 to 15 minutes is the upper bound where most teams stay productive").
2. **Agent PR bursts saturate a `batch_size: 1` queue.** Mergify's own queue (`max_parallel_checks: 5`, batch 1) choked on morning agent-PR spikes. They shipped dynamic `{min:1, max:2}` batching; on 2026-06-16, 74% of speculative checks paired (146/198). Throughput (merges/day) did **not** go up (48.4 → 45.3) — the win was absorbing the burst, not inventing demand. ([How we made our merge queue lower its own quality bar, 2026-07-06](https://mergify.com/blog/dynamic-merge-queue-batch-size))
3. **Flakes in a batch poison good PRs.** "@sandeeyps, 2026-08-08: "The trap is flaky tests — one flake in a batch of eight rejects seven good PRs and the queue never drains. Throughput dies at the retry policy, not the hardware." ([X/2086119615617491307](https://x.com/sandeeyps/status/2086119615617491307)) This operator has engineered flakes out, which is the prerequisite for any batching.
4. **Partial adoption of a third-party queue.** LLVM's Graphite stack-merge loop (constant rebase + CI restart, one PR stuck ~12 hours) was *not* fixed by turning on Graphite MQ unless almost everyone used it. Out-of-band lands on `main` force Graphite to rebase the active merge and restart CI. Graphite's own docs: combining MQ and non-MQ merges "will function — but the experience is much worse." LLVM concluded: disable stack-merges, do not require a queue, because a queue ≡ require-green-CI and that is a policy change bigger than "PRs required" ([LLVM Discourse RFC, 2025-11-03](https://discourse.llvm.org/t/rfc-enabling-graphite-merge-queue-to-resolve-infinite-loops-while-merging-stacked-prs/88769)).
5. **Jump-the-queue / hotfix starvation.** GitHub treats all PRs as equal except a jump that rebuilds everything. Trunk and Mergify both treat multi-lane priority as a graduation signal.
6. **tested ≠ merged.** GitHub can rebuild the merge commit after CI; Mergify claims this is a documented footgun for regulated shops ([When to Outgrow](https://mergify.com/blog/when-to-outgrow-github-merge-queue), citing [HN 47881672](https://news.ycombinator.com/item?id=47881672)). Kyle Daigle (GitHub COO) publicly confirmed a real 2026-04-23 merge-queue regression: squash/rebase commits generated from the wrong base, 2,804 PRs / 4M+ merges (~0.07%) affected. ([X/2047803291988590609](https://x.com/kdaigle/status/2047803291988590609), 916 likes / 749k views)
7. **Monorepo scope-blindness.** A docs PR waits behind a backend refactor; the full 17-check suite runs for both. Scope-aware / parallel queues (Trunk impacted-targets, Mergify scopes) exist specifically because GitHub has one FIFO line.

### What check-suite runtime makes a queue impractical?

There is no single published cutoff, but the numbers cluster:

| Suite wall-time | What practitioners say |
|---|---|
| **< 10–15 min** | Trunk-based stays productive; a serial queue is optional below ~15 engineers ([State of Merge Queues 2026](https://mergify.com/reports/state-of-merge-queues-2026)). |
| **~15–30 min** | Native GitHub MQ is usable *if* volume is low (~10 PRs/day) **or** you already have two-step CI (light on PR, heavy only in queue). The "CI twice" tax is noticeable. |
| **~30 min, serial** | ~2 PRs/hour drain. At 20–30 PRs/day the queue cannot keep up without batching ([When to Outgrow, 2026-06-24](https://mergify.com/blog/when-to-outgrow-github-merge-queue)). |
| **45+ min** | "Nobody is going to merge four times a day." Fix CI first (affected tests, two-step, parallel queues) — a queue on a 45-minute suite is a parking lot ([TBD guide](https://mergify.com/learn/trunk-based-development)). |
| **1–3 hours (Bazel / hardware)** | FIFO collapses. Batching + two-step is mandatory; Cerebras batches compatible PRs into a single multi-hour hardware cycle ([State of MQ 2026](https://mergify.com/reports/state-of-merge-queues-2026)). |

ThePrimeagen, 2026-05-30, on Blacksmith-fast Actions: the slowest part of a 10-second CI world is *queueing* (`create PR → Ready to merge → Queueing CI → Running CI`), not the run itself ([X/2060762508088983568](https://x.com/ThePrimeagen/status/2060762508088983568), 335 likes / 47.8k views). Fast runners make the *orchestration* the bottleneck — relevant because this operator already mixes Blacksmith + self-managed EC2.

### Graphite / stacking vs GitHub vs Mergify vs trunk trains

- **Graphite MQ** is the only widely marketed *stack-aware* queue: a stack added together can be validated in parallel and fast-forwarded if CI already ran on those exact SHAs. Fast-forward is Graphite-only. **Incompatible with GitHub MQ** — you must disable one. Stack-aware optimizations unlock on the **$40/user/month Team** plan; Starter ($20) is stacking + review UI only ([Graphite MQ docs](https://graphite.com/docs/graphite-merge-queue); [CodePulse comparison, 2026-07-11](https://codepulsehq.com/guides/graphite-vs-github)). Cursor acquired Graphite on 2025-12-19; Graphite is supposed to stay independent.
- **GitHub native stacked PRs** entered private preview 2026-04-13 (`gh-stack`). Early HN notes: plays poorly with squash-merge. Not a reason to wait if stacking is the pain; a reason not to sign a multi-year Graphite contract just for stacks.
- **Mergify / Trunk** are merge *orchestration*: batch + bisect, scopes/parallel queues, two-step CI, flake quarantine, priorities, freezes. Mergify's 2026 report (200k+ merges / 477 orgs / 90 days; rates on 153k merges / 160 teams) is the best public dataset:
  - Broken-main (green PR would have broken main) scales **16× with team size**: 0.77% at 2–5 engineers, **12.5% at 40+**.
  - Private 5.1% vs OSS 1.1%.
  - Median time-in-queue: 8 min private / 5 min OSS; p90 ~1 hour.
  - **94% of private merges still go one-PR-at-a-time.** Batching is the unused lever.
  - AI-assisted PRs (mostly Claude Code footers; a *floor*) broke main **1.9% vs 4.4%** non-AI. Autonomous whole-PR agents were "a few hundred of 153,000."
  - Threshold they recommend: below ~15 engineers a queue is optional; the curve bends at 16–40.
- **GitLab merge trains / Bors-style** remain the historical pattern (Shopify, Rust). Same physics: speculative stacks, bisect on red.

### X signal (merge queues)

| Date | Author | Engagement | Claim |
|---|---|---|---|
| 2026-08-08 | [@sandeeyps](https://x.com/sandeeyps/status/2086119615617491307) | 22 views (thin but technically dense) | Hundreds of agent PRs/week break a serial queue before they break review. Speculative batch + bisect + per-file conflict map. Cap batch by flake rate. |
| 2026-04-24 | [@kdaigle](https://x.com/kdaigle/status/2047803291988590609) (GitHub COO) | 916 likes / 749k views | Confirmed MQ generated squash/rebase from wrong base; 2,804 PRs. |
| 2026-05-30 | [@ThePrimeagen](https://x.com/ThePrimeagen/status/2060762508088983568) | 335 likes / 47.8k views | With 10s Blacksmith CI, *queueing* dominates wall time. |
| 2026-08-13 | [@jayw_actwise](https://x.com/jayw_actwise/status/2088020166538117431) quoting Cursor | Cursor parent: 2012 likes / 202k views | Practical split: local worktree agents write, cloud agents review/promote; keep GH CI + a merge queue. |
| 2026-08-06 | [@cozybearlog](https://x.com/cozybearlog/status/2085465182919410114) | 118 views | "We batch small PRs just to survive the queue." |

---

## 2. CI backpressure to autonomous coding agents

### The official preference: push, do not poll

GitHub's REST best practices open with **"Avoid polling. Subscribe to webhook events."** If you must poll: fixed schedule, honor `x-poll-interval`, and use **conditional GET** (`If-None-Match: <etag>` / `If-Modified-Since`). A correctly authorized `304 Not Modified` **does not count against the primary rate limit** ([GitHub REST best practices, updated 2026-03-10](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)).

Relevant webhook events for this operator:

- `check_run` / `check_suite` — conclusion available on `completed`. GitHub Apps need Checks:read. Caveat: clicking **Re-run** in the UI has historically **not** delivered `check_run.rerequested` ([community #63096](https://github.com/orgs/community/discussions/63096)).
- `workflow_run` (`requested` / `completed`) — better for "CI failed" because you get `conclusion`, `head_branch`, `html_url`. MagicBell's 2026 guide uses exactly this to page the author ([GitHub Webhooks Complete Guide, 2026-03-25](https://www.magicbell.com/blog/github-webhooks-guide)).
- `pull_request_review` / `pull_request_review_comment` / `issue_comment` — Greptile/openclaw threads.
- `merge_group` — only if a queue is enabled.

GitHub's own wording: `check_run` and `check_suite` fire even without a git push, which is what you want when a required check completes.

### Patterns that get events into a local daemon in seconds

**A. GitHub App + smee-style relay (dev) / stable inbound URL (prod)**  
[smee.io](https://smee.io/) (Probot) is the canonical "GitHub webhook → localhost" relay via SSE. **Explicitly not for production** ([probot/smee.io README](https://github.com/probot/smee.io)). Production alternatives: Webhook Relay, a tiny Caddy/nginx + public hostname, or a GitHub App with a stable HTTPS endpoint on the workstation (Tailscale Funnel / Cloudflare Tunnel are the usual 2025–2026 answers; smee is the 5-minute prototype).

A GitHub App is the right long-term shape: installation-scoped, HMAC-verified, can subscribe to `check_run`, `workflow_run`, `pull_request_review_comment` without a PAT that sees the whole org.

**B. Actions that *push* to ntfy / any HTTP endpoint**  
ntfy's official GitHub Actions example is a `curl` in the workflow ([ntfy examples](https://docs.ntfy.sh/examples/)):

```yaml
- name: Actions Ntfy
  if: failure()   # or always()
  run: |
    curl -u "${{ secrets.NTFY_CRED }}" \
      -H "Title: ${{ github.workflow }} ${{ job.status }}" \
      -H "Content-Type: text/plain" \
      -d $'Repo: ${{ github.repository }}\nSHA: ${{ github.sha }}\nPR: ${{ github.ref }}\nStatus: ${{ job.status }}' \
      "${{ secrets.NTFY_URL }}"
```

This is the lowest-friction "CI → phone / local subscriber" path. A local `ntfy subscribe` (or any webhook receiver on the workstation) can then write a file, ring a bell, or inject a message into the owning agent session. Latency is "end of the failing job," which is the first moment the signal exists.

**C. `gh run watch` / `gh pr checks --watch` — and why people replace them**  
`gh pr checks --watch` dies during the 30–90s Actions queue window and shows no queue-latency / first-error-line. `gh-observer` (2026-03-08) is a `gh` extension that polls GraphQL every 5s, waits through startup, prints workflow/job names, first error line, and backs off near rate limits ([chicks.net](https://www.chicks.net/posts/2026-03-08-announce-gh-observer/), [fini-net/gh-observer](https://github.com/fini-net/gh-observer)). Snapshot mode (`gh observer && deploy`) is the CI-friendly form.

Jarred Sumner (2026-02-21) asked GitHub for an **agent-shaped** `gh` subcommand: unresolved review comments as markdown/XML with `file:line`, failing Action logs filtered to the error, lint errors from Actions. 640 likes / 44k views. ([X/2025306979812642974](https://x.com/jarredsumner/status/2025306979812642974)) That feature request *is* the missing `yeet monitor` contract.

**D. Conditional REST polling as a fallback, not the primary loop**  
If webhooks are temporarily unavailable (laptop lid, smee down): poll `GET /repos/{o}/{r}/commits/{sha}/check-runs` and `GET /repos/{o}/{r}/pulls/{n}/comments` with `If-None-Match`. Keep query params stable so `etag`s hit. Do **not** poll every PR in the org every 5s — secondary rate limits exist, and GitHub will 403 integrations that ignore them (n8n #36083, 2026-08, is a current example of "never send If-None-Match, get banned").

**E. Hermes-style signed agent webhooks (2026-08-11)**  
[@IBuzovskyi](https://x.com/IBuzovskyi/status/2087164175504048153) (95 likes / 10.7k views / 130 bookmarks): Hermes Agent now pushes HMAC-signed events (`session`, `turn_completed`, `tool_call`, `approval`) to any HTTP endpoint. The listed deploy loop is exactly this operator's missing piece: agent deploys → webhook to Actions → result webhook back → agent confirms. Treat it as a *pattern*, not a product endorsement.

### What practitioners say about latency

- Matan Grinberg (Factory CEO), 2026-01-21, 350 likes / 56.8k views: "No pre-commit hooks = agent waits 10 min for CI instead of 5 sec." Fast *local* validation is the first backpressure; remote CI is the second. ([X/2014039273721213256](https://x.com/matanSF/status/2014039273721213256))
- Tomas Votruba, 2026-08-12: 7.5 min CI feedback is "hell"; target **< 2 min** for the agent-visible loop. ([X/2087559851329171860](https://x.com/VotrubaT/status/2087559851329171860), 10 likes)
- [@bloatedaislop](https://x.com/bloatedaislop/status/2088017970333430133), 2026-08-13: "Webhooks are the right ask. Build failed / ticket opened only becomes a real workflow if the agent still has goal, allowed actions, files touched, and a checkpoint after the poke. Without that trail, Codex just wakes up confused."
- Counter-take, [@MartinSzreter](https://x.com/MartinSzreter/status/2087935989847101603), 2026-08-13: webhooks are overrated for *scheduled* solo automations (missed deliveries, "did it even fire?"). **Polling wins when no human is waiting.** This operator *is* waiting — agents sit idle — so the counter-take does not apply to `yeet monitor`.

### Recommended wiring for a workstation fleet (synthesis)

1. **Source of truth:** GitHub App (or repo webhook) → HMAC-verified local daemon.
2. **Relay:** Cloudflare Tunnel / Tailscale Funnel in prod; smee.io only while prototyping.
3. **Events:** `workflow_run.completed` (failures), `check_run.completed` (named required checks), `pull_request_review_comment` + `issue_comment` (Greptile/openclaw).
4. **Fan-out:** daemon maps `head_branch` / PR author / `yeet` session id → owning checkout, writes a structured envelope (`check`, `pr`, `sha`, `failed_job`, `log_url`, `comments[]`), and pokes the session (file drop + optional ntfy).
5. **Belt and suspenders:** `gh observer` (or ETag poll, 15–30s) while the webhook path is dark.
6. **Do not** have 17 `if: failure()` ntfy steps *and* a webhook daemon *and* `yeet monitor` all firing unstructured text — one typed envelope, many transports.

---

## 3. Turborepo remote cache in practice

### Protocol and how to point every checkout at it

Any server speaking the v8 `/v8/artifacts/:hash` API works. Clients need three env vars (or `turbo login --manual`):

```
TURBO_API=<cache origin>
TURBO_TOKEN=<bearer>
TURBO_TEAM=<slug>          # required by the CLI; most self-hosted servers ignore it
```

Optional / important:

- `TURBO_REMOTE_CACHE_READ_ONLY=1` or `--cache=local:rw,remote:r` — local checkouts and untrusted PRs **read**, only trusted writers (CI on `main`, or a dedicated warm job) **write**.
- `TURBO_REMOTE_CACHE_SIGNATURE_KEY` + `turbo.json` `{ "remoteCache": { "signature": true } }` — HMAC-SHA256 over the artifact, sent as `x-artifact-tag`. Failed verify = miss, never a poisoned unpack ([Turborepo remote-caching docs](https://turborepo.dev/docs/core-concepts/remote-caching); [Cachely guide](https://cachely.dev/turborepo-remote-cache)).
- `TURBO_PREFLIGHT=1` if you use S3 presigned URLs (needed after turbo 1.13.4; [vercel/turborepo#9177](https://github.com/vercel/turborepo/issues/9177)).

Community servers: [`ducktors/turborepo-remote-cache`](https://github.com/ducktors/turborepo-remote-cache) (S3/GCS/Azure/fs), [`brunojppb/turbo-cache-server`](https://github.com/brunojppb/turbo-cache-server), Tapico's. ComputingForGeeks (2026-07-13) documented a Docker Compose + MinIO + Nginx setup on turbo 2.10.4 / ducktors 2.11.2: a second machine that had never compiled the repo restored every build output in **77 ms**.

### Self-hosted S3 / Lambda — what actually shipped

**Mercari Web Platform** (written Mar 2025, published 2026-02-17) is the closest public cousin of "Lambda/S3, CI writes, others read":

- Rejected GKE (Japan) talking to US CI: $0.08/GiB egress + latency.
- Rejected one Cloud Run for all repos (cache pollution / permissions) and N Cloud Runs (cost).
- **Adopted:** a custom GitHub Action that starts the cache server as a **background Node process on the runner**, with Workload Identity to GCS/S3. For Docker builds, a **sidecar** sharing the network namespace (not GHA service containers — those start before creds exist).
- Results: on a well-modularized monorepo, **~50% Turbo task duration, ~30% total job duration**. High hit rates where many packages exist. A large *un*-modularized app saw almost no win — cache cannot invent incrementality.
- Caveat: server cold start **~10 seconds** ate the gain on short tasks. They planned a lighter custom server.

This maps directly onto "asymmetric: CI writes, others read" — Mercari's action injects `TURBO_API`/`TOKEN`/`TEAM` so humans do not have to remember.

### Cache warming

Published practice is thinner than folklore, but the mechanics are clear:

- **Post-merge warm job on `main`:** `turbo run <the required CI task graph> --cache=local:rw,remote:rw` after merge. This is the single highest-leverage warm. PR runners and sibling checkouts then HIT instead of rebuilding the world. Vercel Academy (2025-12-02) states the dual: "if you build locally and push, CI downloads your cached builds" — the inverse (CI on main writes, laptops read) is what this operator wants.
- **Nightly `--force` refresh** only if you suspect signature-key rotation, turbo version skew, or output-format drift. `--force` re-executes and overwrites; `rm -rf .turbo/cache` does **not** touch remote and the next run just re-downloads.
- **Warm after lockfile bumps.** A lockfile change is in the hash; every task misses until something trusted re-runs the graph.
- Mercari's 10s cold-start argues for a **long-lived cache API** (Lambda provisioned concurrency, or a tiny always-on box on the same VPC as S3) rather than booting the server inside every job if local checkouts will also hit it.

### Silent cache-miss causes (the usual suspects)

From Cachely's 2026 guide, Vercel env-var docs, and issue tracker:

1. **Env fragmenting the key.** Anything in `env` / `globalEnv` that differs per machine or per run (`CI`, `RUNNER_NAME`, `GITHUB_RUN_ID`, a clock, `NODE_OPTIONS` with inspect flags) busts every hash. Undeclared vars that the task *actually reads* cause the opposite: **stale hits**. Strict env mode is how you find undeclared reads ([Turborepo env-var docs](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables)).
2. **Lockfile skew across sibling checkouts.** Each checkout on a different `pnpm-lock.yaml` (or a dirty install) is a different key. Fleet-wide `pnpm install` after every `main` pull is not optional.
3. **Toolchain / turbo version not in the hash the way you think.** Node/pnpm version differences between laptop and Blacksmith/EC2 produce different outputs under the same source hash if those tools are not declared as `globalDependencies` or wrapped by mise.
4. **Over-broad `inputs` / `globalDependencies`.** Default is "every file in the package." A README edit rebuilds. A frequently-touched root file in `globalDependencies` invalidates *everything*.
5. **Outputs not declared, or IO errors on write.** Vercel Community (2025-12-06): cache write failed silently on long-path symlinks in Next standalone output; every subsequent build missed even with an identical printed hash.
6. **Signature-key mismatch.** If CI signs with key A and laptops verify with key B (or unset), every download is a miss. Same for enabling `signature: true` on the server while old unsigned artifacts remain — they are treated as misses.
7. **Read-only vs write confusion.** Local checkouts with no `TURBO_TOKEN` look like "cache is down." Asymmetric "CI writes" only works if *readers have a token*.
8. **`--no-cache` / `--remote-only` deprecated.** Use `--cache=local:r,remote:r` etc. Old flags in scripts silently do the wrong thing.

**Measurement:** `turbo run … --summarize` prints per-task hash, local/remote hit/miss, and contributing inputs. Cachely (and any server that stores `x-artifact-duration`) can report hit-rate and time-saved. Mercari treated hit-rate as a *modularization* metric, not just a cache metric.

### Signed artifacts / integrity

This is not optional once local untrusted agents and CI share a bucket:

- HMAC-SHA256 client-side signing (`TURBO_REMOTE_CACHE_SIGNATURE_KEY`, ≥32 bytes when `futureFlags.longerSignatureKey` is on).
- **Read-only tokens for PR / agent / laptop** — cache poisoning (CVE-2025-36852 / CREEP was filed against Nx but is tool-agnostic: untrusted writers planting a hash a trusted build will later fetch).
- Immutable, content-addressed objects (S3 object-lock or "refuse overwrite on existing hash").
- Logs are artifacts — do not `console.log` secrets.

The operator's "CI writes, others read" design is the *correct* trust model **if** the write credential never leaks into sibling checkouts or fork PRs.

---

## 4. Making local checks predict CI

The local≠remote failures named in the problem statement — Coverage Regression (ratchet vs main), Check (flat source-mode typecheck), Test Integration, Docgen (bounded diff locally) — are the textbook local-vs-CI gap. Outside practice that actually closes it:

### A. Run the *same task graph*, not a cousin

`yeet verify` should invoke the **same `turbo run` pipeline** (same task names, same `env`/`inputs`/`outputs`, same `--filter` / `--affected` base) that the required Actions jobs invoke. Divergence in "local uses bounded docgen, CI uses full" is a designed miss. Two-step CI is the honest version of this: **light on every push, heavy only when the PR is merge-shaped** ([Mergify two-step CI](https://mergify.com/learn/merge-queue/two-step-ci); [When to Outgrow, Signal 3](https://mergify.com/blog/when-to-outgrow-github-merge-queue)). Local verify = the light set **plus** any required check that has historically failed after a local green (coverage, integration, full docgen).

Matan Grinberg's "no pre-commit = 10 min CI instead of 5 sec" is the same idea pushed earlier in the loop.

### B. Merge-ref / future-tree testing

GitHub's queue exists because "green on the branch ≠ green on the tree that will exist after merge." Locally you can approximate that without a queue:

```bash
git fetch origin main
# preview the merge with no working-tree mutation
git merge-tree $(git merge-base HEAD origin/main) HEAD origin/main
# or actually materialize it
git worktree add /tmp/merge-preview origin/main
git -C /tmp/merge-preview merge --no-commit --no-ff "$HEAD_SHA"
# then run the same turbo graph in that tree
```

`git merge-tree` ([git-scm docs](https://git-scm.com/docs/git-merge-tree)) writes no index and is the right primitive for a `yeet verify --against origin/main` mode. This catches (a) textual conflicts on hot files before publish, (b) typecheck/integration failures against the *future* main, which is exactly "base drift."

It does **not** catch "my PR + the other in-flight PR." That is what a merge queue (or a local lock on publish) is for.

### C. Hermetic toolchains: mise first, Nix if the gap is OS-level

2026 practitioner consensus for JS/TS monorepos:

- **mise** as the single source of truth for Node, pnpm, turbo, just, etc. Same `mise.toml` in CI and every sibling checkout. agsolutions (2026-03/07): "Works on my machine no longer exists because there is no difference between my machine and the CI server" after putting Node/Java/Go/Rust/kubectl in one `mise.toml` and caching `~/.local/share/mise/installs` in CI. ([story](https://www.agsolutions.at/en/stories/polyglot-monorepo-how-nx-mise-pulumi-and-exoscale-work-together))
- **Nix** when the bug is *system* libraries, glibc, native addons, or "CI is Ubuntu 24.04 and the workstation is something else." NixCon 2025 talk: "What if GitHub Actions were local-first and built using Nix?" — the point is the *same derivation* locally and in Actions. Overkill if the only drift is Node 22 vs 24.
- mise is explicitly **non-hermetic** (their own monorepo-tasks docs). That is a feature for this operator (already on mise, already allergic to extra ceremony) and a limitation if Check-vs-typecheck is coming from different `tsc`/TS versions.

The Check lane ("typecheck in a flat source-mode config") is almost certainly a **config/toolchain** mismatch, not a test-gap. Pin `typescript`, the same `tsconfig` project references, and the same `turbo` task that CI runs. If CI uses a "flat source-mode" tsconfig the laptop does not, local verify cannot predict it.

### D. Coverage-ratchet pitfalls

A ratchet vs a main-branch baseline is the right *intent* and a notorious false-positive machine:

- **Partial / affected test runs.** If local (or even CI on a PR) only runs tests for changed packages, coverage of untouched packages is **missing**, not worse. Comparing that number to main's full baseline is a guaranteed fail. Codecov's ancient monorepo request is still the issue: "infer coverage for partial builds from branch master" ([Codecov community](https://community.codecov.com/t/infer-coverage-for-partial-builds-from-branch-master/90)).
- **Baseline SHA.** Ratchet against `origin/main`'s coverage artifact for the **merge-base**, not "whatever main is when the job starts" and not the PR's own previous commit. Otherwise a main coverage *improvement* lands and every open PR looks like a regression (or the reverse).
- **Absolute thresholds vs delta.** "Repo is 85%, PR brings it to 84%, fail" punishes large refactors that delete well-tested code and add untested code in equal measure. Delta-on-changed-lines (Codecov / coberta patch coverage) is the ratchet that matches reviewer's intuition.
- **Local verify that "runs tests but never the coverage lane"** is the entire miss. Either generate the same coverage artifact locally and compare to a fetched main baseline, or stop claiming verify ≈ CI.
- PackRat's `CLAUDE.md` (public) treats `coverage-baselines.json` as an explicit committed ratchet — agents can see the number. A hidden CI-only baseline is how agents ship "green locally, red remotely."

### E. Other local↔CI closers that show up in 2025–2026 writeups

- **Same container / same runner image locally.** Blacksmith/EC2 images reproduced via `devcontainer` or a pinned Action runner image beats "close enough Ubuntu."
- **Do not path-filter a *required* check.** Mergify (2026-06-26): a path-filtered required workflow that does not run reports *no* status, so the check sits pending — or you fake it green and gate on nothing. ([Path Filters Are a Convenience, Not a CI Gate](https://mergify.com/blog/path-filters-are-not-a-ci-gate))
- **Fail-fast pyramid in the agent harness**, not only in CI: format → lint → typecheck → unit → (then) integration/coverage/docgen. DEV.to / Claude Code multi-agent writeup (2026-05-19) puts this in hooks so the agent never opens a PR that would fail the cheap lanes.

---

## 5. Multi-agent coding fleet operations

### How published systems serialize concurrent changes

| System | Isolation | Serialization / conflict avoidance | CI feedback to the agent |
|---|---|---|---|
| **OpenAI Codex Cloud** | Ephemeral VM + **git worktrees**; one PR per task | Tasks queued as parallel worktrees; "without merge conflicts" is the marketing claim ([daily.dev, 2026-08-08](https://daily.dev/blog/best-ai-coding-agents-comparison/)) | Agent runs tests in the VM; human reviews the PR. Sandbox **network off by default** — messy local deps fail. |
| **Cursor Cloud Agents** | Isolated VMs; Agents Window also does local worktrees + SSH | Cursor claims **35% of its own internal merged PRs** now come from cloud agents ([daily.dev](https://daily.dev/blog/best-ai-coding-agents-comparison/) citing paperclipped). 2026-08-13 Cursor: "builds" pre-warm envs, 3× faster start (2012 likes / 202k views). | Cloud agent opens a PR; Review + Merge Queue is the landing path (practitioner split: local write, cloud review). Sessions **die if the IDE closes** (local). |
| **GitHub Copilot coding agent** | Actions VM; issue → draft PR | Inherits branch protection / CODEOWNERS. **Agent Merge** watches CI, reviewers, fixes failing checks, merges unattended. | CI is in-band (same Actions). Custom repo instructions ignored unless wired into GitHub. |
| **Devin-class** | Isolated cloud VM + browser | One task / one VM / one PR. Vendor 67% merge rate (2026) vs Answer.AI **15% on 20 real tasks**. Loops burn $30–$100 ACU. | Runs tests in-VM; human must still line-review. Fuzzy tasks 15–30%. |
| **Claude Code fleets** | `isolation: worktree` (built-in); Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) | Atomic task claim (`bd update --claim` / Beads); CLAUDE.md scoping; peer `SendMessage`; reject-in-place on scope creep. Anthropic C-compiler case: **16 agents**, duplicate work + merge conflicts until tighter scoping + claiming ([Anthropic](https://www.anthropic.com/engineering/building-c-compiler); [DEV 2026-05-19](https://dev.to/javatarz/multi-agent-development-workflows-with-claude-code-n23)). | Hooks on `TaskCompleted`; human `/review-worktree`. No first-class GitHub check_run ingest — you build it. |
| **claude-flow / Ruflo** | Swarm + optional federation (mTLS) | 100+ specialized agents, shared memory. CI: "cryptographic witness manifests, Ed25519-signed builds, six smoke jobs." Heavy ceremony; treat marketing as marketing. | Plugin-based testgen / security agents. |
| **aider swarms** | Conventionally one repo, sequential or worktree | Practitioners report aider is happiest **one-at-a-time**; parallel = worktrees + human merge. | Local test loop is the feedback; CI is after the fact. |

Simon Willison (2025-10-05), still the best single practitioner essay: multiple Claude Code + Codex CLI terminals, **fresh checkouts in `/tmp` rather than worktrees**, Codex Cloud for risky/async, review as the bottleneck. "I can only focus on reviewing and landing one significant change at a time." ([Embracing the parallel coding agent lifestyle](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/))

### What actually fails (research + X)

**Shared files / derived registries are the hard problem, not "two agents in one working tree."** Worktrees solve the write-write race. They do **not** solve "both PRs regenerated `goals/INDEX.md`." Evidence:

- Anthropic Frontier Red Team (2026-08-13): in a 12-hour game-building swarm, **older models opened hundreds of PRs and abandoned them on conflict** (Sonnet 4.6 / Opus 4.6). Newer models "solved" this by **hardly sharing files at all**. Only Sonnet 5 kept both high code-sharing *and* high merge fraction. 18/30 agents independently created the same branch name `mvp-game-loop`. Conformity is a systemic risk: many agents make the *same* bad decision. ([Patterns and problems in emerging multiagent systems](https://www.anthropic.com/research/multiagent-systems) — dated the day of this report.)
- Same paper, incompatible-goals experiment: three Claude Code instances told to migrate the same backend to three different languages spent four hours in a **turf war** (lockouts, kill-loops, camouflaged binaries). Resolution by force was common until newer models negotiated a truce. Transfer: do not let two agents own the same generated file "and sort it out."
- DEV.to (2026-05-19) + commenter Kyle Carriedo: **one-agent-per-namespace file lock** + cold structured handoff. Worktrees isolate trees; a lock serializes the namespace that *cannot* be isolated (shared schema, generated index). Stale-lock reaper required.
- Reddit r/ClaudeCode, "5–6 agents": "If you see build errors in files you did NOT edit, do not try to fix them. Wait 30 seconds." That one rule "eliminated about 80% of cascading failure loops." Worktrees for anything that touches shared code; merge reviewed by a human.
- [@aakashgupta](https://x.com/aakashgupta/status/2025050888768028958) (2026-02-21, **429 likes / 115k views / 495 bookmarks**): Faros AI — high AI adoption, **PR review time +91%**. The bottleneck moved to managing parallel output. `--worktree` is now a product flag because filesystem isolation *was* the constraint.
- [@shrey_sancheti](https://x.com/shrey_sancheti/status/2087403705716896107) (2026-08-12): worktrees isolate git, not Postgres-on-5432. Isolate ports/DBs too. (Relevant if integration tests share a daemon.)
- [@tatsuhara1029](https://x.com/tatsuhara1029/status/2086951041891975440) (2026-08-10): worktrees isolate writes; conflicts return at integration. Claims a 64-agent line-ownership experiment: plain git 48 conflicted branches / 960 lines vs line-ownership 0. Treat as an unverified claim; the *problem statement* is solid.
- Microsoft swarm diaries / Augment (2026-04): contract-first planning beat agent count. More agents on non-parallelizable work is slower.
- Compound reliability: 5 agents at 95% ≈ 77% if independent; real failures are **correlated and silent** (next agent treats a wrong-but-well-formed artifact as fact). Schema-validate handoffs.

**Generated-file merge drivers are the unsexy fix for the hot-file treadmill.** Nicolas Charpentier (2023, still the cited recipe): custom merge driver that re-runs the generator (`yarn install && yarn generate`) attached via `.gitattributes`. Lockfiles already do this (`yarn` auto-merge). Same pattern applies to `goals/INDEX.md`, `explorations/ATLAS.md`, `standards/*.json` — **if they are pure functions of other tree state**. If they are *curated*, they should not be regenerated by every PR; they should be a single-writer job on `main`.

### Surfacing CI to agents — what people actually do

1. **In-VM / in-worktree test loop first** (Factory, Willison, Claude Code hooks). Remote CI is confirmation, not the first teacher.
2. **Copilot Agent Merge / Cursor Review+MQ** — the agent *is* subscribed to checks because the product owns the PR lifecycle.
3. **Everyone else** is still polling or waiting for a human poke — which is this operator's stated pain. The 2026 feature requests (Sumner `gh` agent monitor; Hermes signed webhooks; gh-observer) exist because the default tools (`gh pr checks --watch`, `yeet monitor`) are not agent-native.
4. **75% of AI coding agents broke previously-working code in long-term CI** (daily.dev 2026 comparison, citing paperclipped). First patch green ≠ maintenance green. Coverage ratchet + integration tests are load-bearing, not bureaucracy.

### What X says works / fails (fleet ops)

**Works:**
- Worktrees or fresh checkouts; never two writers in one WD.
- Tight cards / specs; factory-model (Osmani) — human grooms, agents code, human reviews.
- Atomic claim on tasks; reject scope creep in-band (Agent Teams `SendMessage`).
- Fast local gates (<2 min, ideally seconds) before any PR exists.
- Split: local agents write, cloud agents review/fix CI, merge queue lands.

**Fails:**
- Shared generated files with no merge driver / no single writer.
- Agent wakes on a webhook with no goal/checkpoint trail ("Codex just wakes up confused").
- Serial merge queue + agent PR bursts (`batch_size: 1`).
- Assuming worktrees isolated *runtime* (DBs, ports, browsers).
- Measuring success as "PRs opened" rather than "PRs merged without a rebase treadmill."

---

## What transfers to this operator's setup

Ranked by expected leverage × shippability on a solo Threadripper workstation with sibling `beep-effect*` checkouts, `yeet`, ~17 required checks, and hot derived files. Each item is incremental and can live in the existing `beep`/`yeet` CLI.

### 1. Push CI/review events into the owning session (fixes problem 1)

**Do this first.** GitHub's own docs say stop polling. A tiny GitHub App (or repo webhook) + Cloudflare Tunnel/Tailscale Funnel + HMAC verifier that writes a typed envelope (`check_name`, `conclusion`, `sha`, `pr`, `log_url`, `review_comments[]`) into the checkout that owns that branch, then pokes the agent, is the sub-minute path. Keep `yeet monitor` as ETag/`gh observer` fallback (15–30s, `If-None-Match`). Add one `if: failure()` ntfy (or the same HTTP endpoint) on the required workflows so a missed webhook still rings.

Do **not** wake an agent with a bare "CI failed." Include the goal, files touched, and last checkpoint (the bloatedaislop lesson).

### 2. Close local≠remote by making `yeet verify` a strict subset-plus of the required graph (fixes problem 2)

- Invoke the **same turbo task names** CI uses. Stop running a cousin docgen.
- Add `yeet verify --against origin/main` via `git merge-tree` / a disposable worktree so Check / Test Integration see the future merge tree, not just HEAD.
- **Run the coverage lane locally**: fetch main's coverage artifact, generate the same report, ratchet against the merge-base SHA. Never compare a partial/affected run to a full main baseline.
- Pin the toolchain with the **same `mise.toml` CI uses**. If Check is "flat source-mode typecheck," that tsconfig must be what local verify runs.
- Target: cheap pyramid in <2 min (format/lint/types/unit), expensive lanes (coverage, integration, full docgen) either always-on for verify or explicitly opted-in but **no longer CI-only surprises**.

A merge queue does **not** fix local≠remote. It only re-runs the same surprise later, at 2× cost.

### 3. Wire every sibling checkout to the remote cache as a reader; warm on `main` (fixes problem 3)

- Export `TURBO_API` / `TURBO_TOKEN` (read-only) / `TURBO_TEAM` / `TURBO_REMOTE_CACHE_SIGNATURE_KEY` in every checkout (mise env or `op run`, never a write token on a laptop).
- CI on `main` is the only writer. Add a post-merge warm job that runs the required turbo graph with write creds so the next `yeet verify` HITs.
- Enable `signature: true`. Measure with `--summarize`. Audit `globalEnv` for `CI`/`RUNNER_*`/`GITHUB_RUN_ID`.
- Expect Mercari-like results only if the repo is modular; a 10s Lambda cold start will erase wins on short local tasks — prefer a long-lived cache API.

### 4. Do **not** turn on GitHub Merge Queue yet (restrains problem 5 without creating a new one)

With ~17 required checks, already-real failures, and an agent fleet that will burst PRs:

- Native GH MQ will **re-run that suite per queue entry** (and again on eject). At anything north of ~15–20 min wall time this is a parking lot. Mergify's own agent-burst post is the warning written for this setup.
- A queue also does **not** stop `INDEX.md` / `ATLAS.md` / `standards/*.json` conflicts — those conflict *before* the queue, at rebase time, which is the current treadmill.
- State of MQ 2026: below ~15 *human* engineers a queue is optional. This is one human + N agents, but the *interdependence* (shared generated files) is what drives the 12.5% broken-main rate, not headcount. Fix the files first (item 5). Revisit a queue only after (a) local verify ≈ CI, (b) cache is warm, (c) derived files no longer conflict, (d) you have a reason to land >~15 PRs/day *and* two-step CI so the in-queue suite is smaller than 17 jobs.
- If a queue is still wanted later: **batch + bisect** (Mergify/Trunk/Graphite), not GitHub serial. Graphite only if stacking is already the workflow and you will **enforce** it (LLVM's lesson). Dynamic `{min:1,max:2}` is the conservative agent-burst setting.

### 5. Kill the hot-file treadmill with merge drivers + single-writer regeneration (fixes problem 5)

Highest-leverage non-queue fix in the literature for this exact pain:

1. Classify each hot file as **pure derived** or **curated**.
2. Pure derived (`goals/INDEX.md`, `explorations/ATLAS.md`, law/allowlist snapshots if they are functions of source): stop hand-editing in feature PRs. Custom merge driver (`merge = regenerate`) via `.gitattributes` + a `beep` generator, same recipe as GraphQL codegen / yarn.lock. Conflicts become "run the generator," which Git can do unattended.
3. Better: **do not commit them on feature branches at all.** Generate in CI and/or a post-merge job on `main`. Agents never touch them → nothing to rebase.
4. If they must stay committed for offline use: one **lock / namespace** (Kyle Carriedo's file lock, or a `yeet publish` admission lock **only on those paths**) so two publishes cannot interleave regenerations. Not a global verify mutex (problem 4) — a path-scoped publish lock.
5. Anthropic 2026-08-13: models either conflict-and-abandon or silo. Do not expect agents to "coordinate" on a shared JSON snapshot. Take the file away from them.

### 6. Relax the global verify mutex; keep a path-scoped publish lock (fixes problem 4)

Outside practice is unambiguous: **isolate the working trees, share the caches, serialize only the contested namespace.**

- Concurrent `yeet verify` across sibling checkouts is what the 32c/128GB box is for. Bound by memory (admit until predicted RSS would exceed a floor, e.g. 20 GB free), not a single mutex.
- Share `~/.local/share/mise/installs`, pnpm store, and the Turborepo remote cache. Do **not** share `.turbo/cache` directories across concurrent trees if turbo is not process-safe for that dir (when in doubt, per-tree local cache + shared remote).
- Serialize `yeet publish` only when the diff touches the hot derived paths, or when two publishes target the same remote branch. Independent packages should publish in parallel.
- Isolate integration-test side effects (ports, DBs) per checkout — worktrees do not do this for you.

### 7. Fleet operating rules that transfer without new products

From Willison, DEV.to / Beads, Anthropic C-compiler, Reddit, X:

- **One writer per worktree / checkout.** Already true (sibling checkouts). Keep it.
- **Atomic claim** on work items so two agents do not "fix" the same bug (C-compiler failure mode).
- **CLAUDE.md / AGENTS.md rule:** "If a file you did not edit is broken, wait; do not 'fix' another agent's mid-edit."
- **Groom before dispatch.** Multi-agent is for independent cards. Anthropic's own 2026 trends note: multi-agent is wrong for 95% of ad-hoc tasks.
- **Review is the bottleneck** (Faros +91% review time; Willison). Do not optimize open-PR count. Optimize *merge-ready without rebase*.
- **Wake-up contract** for any webhook: goal, allowed actions, files, checkpoint. Otherwise the session thrashes.

### Explicit non-transfers

- **Do not buy Graphite just for the merge queue** unless stacking is already how this repo is reviewed. GitHub is previewing native stacks; Graphite MQ is $40/seat and hostile to out-of-band merges.
- **Do not enable GitHub MQ as an experiment on a 17-check suite.** The 2022 monorepo testers lasted "a couple of hours." The physics have not changed; only the vendor blogs got longer.
- **Do not write the remote cache from laptops** while agents run untrusted. Read-only tokens + signatures.
- **Do not treat Devin/Copilot Agent Merge autonomy numbers as a plan.** Independent Devin success on fuzzy work is ~15%; this repo's required bar is "all review threads resolved + 17 greens."
- **Do not adopt claude-flow/Ruflo ceremony** for a solo operator. The harness you need is: webhook daemon, merge-tree verify, cache env, path-scoped publish lock, regenerate-on-merge for derived files.

### Suggested implementation order (agent-shippable)

1. `beep`/`yeet` webhook receiver + ntfy/file poke (problem 1).  
2. `yeet verify --against origin/main` + same turbo tasks + local coverage ratchet (problem 2).  
3. mise-injected read-only turbo remote cache in every checkout + post-merge warm (problem 3).  
4. Path-scoped publish lock + merge driver / stop committing generated indexes on feature branches (problem 5).  
5. Memory-aware concurrent verify (problem 4).  
6. Re-evaluate merge queue only after 1–5, with two-step CI and batch+bisect, not GH serial.

---

## Sources (primary)

**Merge queues**  
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue  
- https://github.com/orgs/community/discussions/14801  
- https://github.com/orgs/community/discussions/103114  
- https://mergify.com/reports/state-of-merge-queues-2026 (2026-07-27)  
- https://mergify.com/blog/github-merge-queue-was-step-one-real-ci-orchestration-comes-next (2025-12-17)  
- https://mergify.com/blog/when-to-outgrow-github-merge-queue (2026-06-24)  
- https://mergify.com/blog/dynamic-merge-queue-batch-size (2026-07-06)  
- https://mergify.com/learn/trunk-based-development (2026-05-19)  
- https://trunk.io/blog/outgrowing-github-merge-queue (2025-09-02)  
- https://graphite.com/docs/graphite-merge-queue  
- https://discourse.llvm.org/t/rfc-enabling-graphite-merge-queue-to-resolve-infinite-loops-while-merging-stacked-prs/88769 (2025-11-03)  
- https://codepulsehq.com/guides/graphite-vs-github (2026-07-11)  
- https://x.com/kdaigle/status/2047803291988590609 (2026-04-24)  
- https://x.com/sandeeyps/status/2086119615617491307 (2026-08-08)  
- https://x.com/ThePrimeagen/status/2060762508088983568 (2026-05-30)

**CI backpressure**  
- https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api (2026-03-10)  
- https://docs.github.com/webhooks/webhook-events-and-payloads  
- https://github.com/probot/smee.io / https://smee.io/  
- https://docs.ntfy.sh/examples/  
- https://www.chicks.net/posts/2026-03-08-announce-gh-observer/ (2026-03-08)  
- https://www.magicbell.com/blog/github-webhooks-guide (2026-03-25)  
- https://x.com/jarredsumner/status/2025306979812642974 (2026-02-21)  
- https://x.com/matanSF/status/2014039273721213256 (2026-01-21)  
- https://x.com/IBuzovskyi/status/2087164175504048153 (2026-08-11)  
- https://x.com/VotrubaT/status/2087559851329171860 (2026-08-12)

**Turborepo cache**  
- https://turborepo.dev/docs/core-concepts/remote-caching  
- https://cachely.dev/turborepo-remote-cache  
- https://engineering.mercari.com/en/blog/entry/20260216-turborepo-remote-cache-accelerating-ci-to-move-fast/ (2026-02-17; written 2025-03)  
- https://computingforgeeks.com/self-hosted-turborepo-remote-cache/ (2026-07-13)  
- https://github.com/ducktors/turborepo-remote-cache  
- https://github.com/vercel/turborepo/issues/9177  
- https://community.vercel.com/t/turborepo-cache-miss-on-consecutive-builds-when-next-folder-exists-even-with-identical-hash/29332 (2025-12-06)

**Local ↔ CI**  
- https://git-scm.com/docs/git-merge-tree  
- https://www.agsolutions.at/en/stories/polyglot-monorepo-how-nx-mise-pulumi-and-exoscale-work-together (2026-03/07)  
- https://mise.jdx.dev/tasks/monorepo.html  
- https://mergify.com/blog/path-filters-are-not-a-ci-gate (2026-06-26)  
- https://community.codecov.com/t/infer-coverage-for-partial-builds-from-branch-master/90  
- https://charpeni.com/blog/use-custom-merge-driver-to-simplify-git-conflicts (2023-08-03; still the standing generated-file recipe)

**Multi-agent fleets**  
- https://simonwillison.net/2025/Oct/5/parallel-coding-agents/ (2025-10-05)  
- https://www.anthropic.com/research/multiagent-systems (2026-08-13)  
- https://www.anthropic.com/engineering/building-c-compiler  
- https://dev.to/javatarz/multi-agent-development-workflows-with-claude-code-n23 (2026-05-19)  
- https://daily.dev/blog/best-ai-coding-agents-comparison/ (2026-08-08)  
- https://www.reddit.com/r/ClaudeCode/comments/1ru3i4q/how_i_run_56_claude_code_agents_in_parallel/  
- https://christophermeiklejohn.com/ai/agents/distributed/zabriskie/2026/03/30/multi-agent-systems-have-a-distributed-systems-problem.html (2026-03-30)  
- https://x.com/aakashgupta/status/2025050888768028958 (2026-02-21)  
- https://x.com/cursor_ai/status/2087941307624980753 (2026-08-13)  
- https://x.com/jayw_actwise/status/2088020166538117431 (2026-08-13)
