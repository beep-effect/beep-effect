# Brief — GitHub API Quota

## Problem

Every fleet host, T3 server, Yeet monitor, orchestrator watcher and agent `gh` call spends one GitHub user's
buckets: 5,000 REST requests and 5,000 GraphQL points per hour.

On 2026-11-09 the REST bucket hit 0 at 21:31Z. For 11 minutes:
- every `gh` call on all six hosts returned 403
- every Yeet monitor gave up together
- T3 stopped waking watched threads at its 10% floor
- the 403s looked like permission failures and misled a fleet token audit

The waste is structural. The same PR state is read independently by:
- each lane's monitor (every 30 s, now 90 s since #3032)
- `--watch` (every 10 s)
- merge-gate (every 240 s, everything on every attempt)
- gate-table (every PR every 10 min)
- the orchestrator watchers
- T3 on each host
- ad-hoc agent calls

Nothing records who spent what, so nobody can tell whether a change helped.

## Appetite

About two weeks of agent time across three goal packets, with at most three open PRs at once. Webhooks, T3 changes
and fleet-wide sharing are out of this appetite and sit behind evidence gates (`MAP.md`).

## Solution sketch (fat marker)

```text
                 ┌──────────────── one host ─────────────────────────────┐
 GitHub ◀─GraphQL batch + ETag REST── github-state worker (systemd user) │
   ▲              │  token via LoadCredential (user now, App later)     │
   │              │  tracked set: PrSessionRegistry owners (+ all open   │
   │              │  PRs on the hub); fingerprint-gated; 15% reserve     │
   │              ▼                                                      │
   │       PR snapshots  <state>/beep/yeet/pr-status/<repo>/<pr>.json    │
   │       (atomic, head SHA + generation + createdAt, Freshness bound)  │
   │              │                                                      │
   │   monitor · ready · merge-gate · watch · gate-table · watchers ·    │
   │   `status --cached` (agents)   ── read snapshot; direct-read fallback│
   │                                                                     │
   └── ledger: x-ratelimit-* headers + free GET /rate_limit, per identity│
       × resource × command × host  →  github-headroom parcel            │
                 └───────────────────────────────────────────────────────┘
```

1. **Ledger and attribution (goal 1).**
   - Every GitHub response's `x-ratelimit-*` headers are recorded, with identity, resource (core / graphql / search),
     command and host. This builds on `transport.rateLimit` in `drivers/github` and `MonitorRateLimit.ts`.
   - A sampler reads the free `GET /rate_limit` for the true fleet-wide usage.
   - A `github-headroom` Palantiri parcel shows the result in `session open`.
   - `gh` subprocess reads are attributed by wrapping the repo's `gh` spawn helpers (`ghOutput`,
     `runRepoCommandCapture("gh")`), not by shimming `gh` on PATH.
   - The ledger exposes the 15% reserve signal that later goals obey.
2. **Per-host worker and snapshot readers (goal 2).**
   - A GitHub-state worker built from the `ObservationWorker` template reads the tracked PR set each cycle:
     - **Fingerprint first:** one aliased GraphQL document per 25 PRs, carrying head oid, `updatedAt`, mergeability
       and rollup state.
     - **Detail only for changed PRs:** a single rollup + review-threads + mergeState query.
     - **REST through a conditional-request (ETag) `fetch` layer** in `drivers/github`, partitioned per token. Ported
       from Prow ghcache with attribution: revalidate always, no-store for errors and GraphQL.
   - The worker publishes atomic PR-keyed snapshots.
   - Readers accept a snapshot when its head SHA matches and its age is within the bound, and otherwise read
     directly. The readers are the monitor (which keeps its convergence and inbox logic but stops polling),
     `ready`, `merge-gate` (a snapshot-first hold, then one authoritative re-read before the head-pinned merge),
     `--watch`, gate-table, the orchestrator watchers and a `--cached` status read for agents. The yeet and
     orchestrate skills point agents at the cached read.
3. **Read-only monitor on the App identity (goal 3).**
   - Widen `rerun-runner-loss.yml` to cover the monitor's environment-only rerun signatures, so reruns run on
     `GITHUB_TOKEN` and the monitor no longer writes.
   - The worker then reads on the beep-fleet-orchestrator App installation token, delivered by `LoadCredential=`.
     That gives the user bucket's polling load its own 5,000/h.
   - Record the decision that reverses the 2026-10-31 ruling.

## Rabbit holes

- **The snapshot store** is a file per PR (matching Palantiri and the inbox) or a per-host SQLite table (CAS +
  history, as in `OwnerCheckpoint.store`). Pick one in goal 2's SPEC.
  - Repo-cli tests run on Node and Bun, so a SQLite choice needs a client per runtime.
  - Do not reach for `@beep/sqlite` directly.
- **Freshness bound and lease semantics.** The worker is a flock singleton, so readers need no lease. They need a
  bound (about 2x the cycle) and a dead-worker signal (snapshot age, or the socket missing).
- **ETag partitioning under hourly App-token rotation.** GitHub's ETags appear to depend on `Authorization`
  (undocumented). Key partitions by token lineage, and expect one full 200 per resource after each rotation.
- **Whether a 304 costs a secondary point or a concurrency slot** is undocumented. Cap the revalidation rate.
- **GraphQL cost.** There is no 304, nested connections multiply cost, and rate-limit errors can arrive as HTTP 200.
  Measure `rateLimit { cost }` for the detail query before fixing its shape.
- **`gh` spawns bypass the driver.** Migrating the monitor's reads to the in-process client is part of goal 2.
  Leftover `gh` spawns are attributed, not cached.
- **Remaining counts are approximate** and vary by region, so the reserve logic needs margin, not exact arithmetic.
- **The `GITHUB_TOKEN` bucket is 1,000/h per repo, shared with every workflow.** Widening rerun-runner-loss is fine,
  since reruns are rare. Moving censuses into Actions is not.

## No-gos

- Creating extra GitHub Apps or tokens only to multiply buckets.
- A `gh` shim on PATH.
- Fleet-wide shared state or cross-host polling in this appetite.
- Webhook receivers, public ingress, or App hook-config management in this appetite (gated in `MAP.md`).
- Patching the t3code fork in this appetite (gated on the ledger).
- Replacing merge-gate with GitHub's merge queue (it stays in `explorations/github-merge-queue`).
- Tokens in unit environments or argv (ruling 39). Credentials arrive only through `LoadCredential=` or the
  1Password route.
- Weakening any gate's evidence. A snapshot never replaces the head-pinned authoritative read before a merge.
