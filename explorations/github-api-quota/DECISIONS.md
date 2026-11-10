# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-11-09 — package homes (answered from doctrine, not asked)

**Question:** Where do the pieces live?

**Answer:**
- **The conditional-request (ETag) layer and rate-limit handling go in `packages/drivers/github`.** They sit beside
  `Resilience.ts` and the `internal/octokit.ts` transport, and are exposed through the existing `fetch` option on
  `TransportOptions`.
- **Everything else goes in the tooling family:**
  - per-host reader/worker, PR snapshot, Yeet readers, budget ledger: `packages/tooling/tool/cli`
  - parcels: `packages/tooling/library/palantiri` and the CLI's Palantiri commands

**Rationale:**
- `standards/architecture/03-driver-boundaries.md:54` lists "retry, timeout, transaction, and transport helpers" as
  driver concerns.
- `standards/architecture/07-non-slice-families.md:42` routes "repo operations, generators, policy packs, and
  automation" to `tooling`.
- No slice or shared-kernel package is involved, because nothing here is product language. Rejected:
  `foundation/*`, because this substrate is GitHub-specific, not domain-agnostic.

## 2026-11-09 — scope: per host first

**Question:** Should "one reader per fact" be per host, fleet-wide, or webhook-first?

**Answer:** Per host. Each host runs one reader per PR. Hosts coordinate only through a budget ledger that reads the
free `GET /rate_limit`, which reports the true fleet-wide usage of the shared user bucket.

**Rationale:** Every brick that the reader, snapshot, lease and parcel need already exists at host scope
(`research/2026-11-09-in-repo-bricks.md` §d). Nothing in the repo shares state across hosts.

Rejected (operator chose the recommendation):
- **Fleet-wide now:** greenfield cross-host state with a single point of failure.
- **Webhook-first:** a NET-NEW receiver, public ingress and redelivery reconciler before any saving lands.

## 2026-11-09 — reader: a per-host worker

**Question:** Which process is the single reader on a host?

**Answer:** A dedicated per-host GitHub-state worker, a systemd user service built from the `ObservationWorker`
template:
- flock singleton, unix socket at 0600, token delivered through `LoadCredential=`
- reads every tracked PR in batched GraphQL plus ETag-revalidated REST
- publishes PR-keyed snapshots

Yeet commands (monitor, ready, merge-gate, watch, gate-table) and the orchestrator scripts read those snapshots. They
fall back to a direct read when the worker is absent or its snapshot is stale.

**Rationale:**
- merge-gate, gate-table and the orchestrator watchers run with no monitor alive, so a monitor-held lease would leave
  them polling.
- The worker covers every consumer, batches across PRs, and gives a later webhook path somewhere to land.
- `LoadCredential=` keeps tokens out of the unit environment (ruling 39).

Rejected:
- **Lease among monitors:** misses the consumers that run without a monitor.
- **T3 Code as the reader:** cross-repo fork changes, and it would couple Yeet to T3.

## 2026-11-09 — measure first

**Question:** Should attribution come before the redesign?

**Answer:** Yes. Slice 0 is a persisted per-identity, per-resource budget ledger:
- fed by response `x-ratelimit-*` headers and the free `GET /rate_limit`
- with per-command and per-host attribution
- exposed as a `github-headroom` Palantiri parcel in `session open`

The later goals are sized from its numbers.

**Rationale:** The paper estimate (720–1,440 GraphQL/h per monitor) conflicts with the measured 430 GraphQL/h
fleet-wide with 2–3 monitors running (`RESEARCH.md` Measurements). Without attribution there is no way to know
whether a change saved anything.

Rejected:
- **Build in parallel:** the reader would be sized on estimates.
- **Skip:** the conflict is unexplained.

## 2026-11-09 — identity: read-only monitor on the App bucket, after the reader

**Question:** Should the monitor become read-only so polling can move to the orchestrator App's separate bucket?

**Answer:** Yes, as a goal after the reader:
- Widen `.github/workflows/rerun-runner-loss.yml` to cover the monitor's environment-only rerun signatures, so the
  reruns run on `GITHUB_TOKEN`.
- The per-host worker then reads on the beep-fleet-orchestrator App installation token, delivered via
  `LoadCredential=`.
- The 2026-10-31 "never bridge the App token into yeet monitor" ruling is reversed by a recorded decision.

**Rationale:**
- It doubles headroom without creating new Apps. The existing App has a real purpose, and minting Apps only to
  multiply buckets is a no-go (`RESEARCH.md` Constraints).
- The ruling's stated reasons fall away once the monitor no longer writes. Those reasons were missing Workflows
  permission for merges, raw `gh` reads, and job reruns.

Rejected:
- **Keep the user identity:** leaves a free bucket unused.
- **Decide after measuring:** the direction is clear, and measurement only sets the timing.

## 2026-11-09 — webhooks: a gated later goal

**Question:** Where do webhooks go?

**Answer:** They are a gated candidate in `MAP.md`, not built now. Re-entry condition: after the reader and identity
goals land, the ledger still shows the user bucket above about 60% average use, or event latency becomes the
bottleneck. When the gate fires, the packet reopens at `decompose`.

**Rationale:**
- A receiver needs a public ingress (Tailscale Funnel or smee), signature checks, delivery-id dedupe, and its own
  reconciler, since GitHub does not redeliver failed deliveries automatically and keeps only 3 days.
- The per-host worker is where a receiver would land later, so nothing built now is wasted.

Rejected: building it now (cost before evidence), and killing it (it remains the end state if polling is not
enough).

## 2026-11-09 — merge-gate: a snapshot consumer only

**Question:** What does this packet do with merge-gate?

**Answer:**
- merge-gate becomes a snapshot reader. It holds with no API call while checks are pending or the review window is
  open, and it does one authoritative re-read right before its head-pinned merge.
- Adopting GitHub's native merge queue stays in [`explorations/github-merge-queue`](../github-merge-queue/README.md).

**Rationale:** The early return saves 13–17 → 2–3 REST per held attempt for little effort. Replacing merge-gate is a
gate-semantics decision (merge_group triggers, admission verdict, the meaning of `--until-ready`) that the
merge-queue packet already frames.

Rejected:
- **Absorb the merge queue:** scope creep into gate semantics.
- **Leave merge-gate alone:** the cheapest saving would go unused.

## 2026-11-09 — T3 Code: measured, with changes gated

**Question:** What is T3 Code's place?

**Answer:**
- The ledger attributes T3's share. T3 changes stay out of scope unless the ledger shows its share above a set
  threshold, which is to be set in the ledger goal.
- The reader's reserve policy keeps the shared bucket from being driven to 0. That alone stops T3's background
  reads from pausing at its 10% floor and leaving watched threads unwoken.

**Rationale:**
- T3 spends GraphQL only: about 60 points/h per host, plus 35–115 per watched PR
  (`research/2026-11-09-t3-code-pr-sweeps.md`).
- It already shares one read per (project, PR) across threads.
- Patching the fork couples two repos for an unmeasured gain.

Rejected:
- **T3 reads our snapshot now:** a cross-repo change ahead of evidence.
- **Ignore T3:** its pause behaviour is a real casualty of the drain.

## 2026-11-09 — appetite: 3 goals, about 2 weeks

**Question:** What appetite does the redesign get?

**Answer:** Three goal packets, about 2 weeks, with at most 3 open PRs at once (the packet rule):
1. **Ledger and attribution.**
2. **Per-host worker:** the batched GraphQL query, the ETag layer in `drivers/github`, and the snapshot readers in
   monitor, ready, merge-gate, watch and gate-table.
3. **Read-only monitor on the App identity.**

**Rationale:** This covers the ranked structural items (C1–C5) while keeping webhooks and T3 behind evidence gates.

Rejected:
- **Small (ledger + reader):** identity is cheap once the worker exists.
- **Large (everything):** builds webhooks before the evidence.

## 2026-11-09 — tracked PR set: local owners, plus every open PR on the hub

**Question:** Which PRs does each host's worker read?

**Answer:**
- Each host reads the PRs that have a local owner in its `PrSessionRegistry` or a live consumer request.
- The orchestrator host (DankStation) also reads every open PR in `beep-effect/beep-effect`, for gate-table,
  merge-gate and the orchestrator watchers.
- The "all open" flag is per-host configuration.

**Rationale:** Batching makes all open PRs about 2 GraphQL documents per cycle, but six hosts each reading every PR
would multiply that by 6. Only the hub consumes the full set.

Rejected:
- **All open PRs everywhere:** about 6x the cost.
- **Locally owned only:** the hub's gate-table and watchers would keep polling directly.

## 2026-11-09 — reserve: 15% of the shared bucket

**Question:** Should the reader keep a reserve?

**Answer:** Yes:
- Background reads (worker cycles, monitors, watchers) back off once the ledger's fleet-wide remaining falls below
  15% of the limit (750 of 5,000), per resource (core and GraphQL), until the reset.
- Interactive and merge-critical reads (the head-pinned merge re-read, an operator's direct command) may go down
  to 1.

**Rationale:**
- 15% sits above T3's 10% background floor, so T3's watch and sync sweeps keep running instead of pausing.
- Remaining counts are approximate per GitHub, so a margin is required.
- The ledger reads the free `/rate_limit`, which reflects every host.

Rejected:
- **10% like T3:** both would contend for the same last 10%.
- **No reserve:** #3032's sleep-until-reset only reacts after the drain.

## 2026-11-09 — ad-hoc agent gh calls: steer through skills

**Question:** How should ad-hoc agent `gh` calls be handled?

**Answer:**
- Add a cheap command that reads the worker snapshot (a `beep yeet status --cached` style read).
- Update the yeet and orchestrate skills to prefer it over raw `gh pr view`/`gh pr checks`.
- Raw `gh` stays allowed.
- The ledger's attribution shows whether this is enough.

**Rationale:** Steering costs little and is reversible.

Rejected:
- **A gh shim on PATH:** invasive and brittle across gh versions.
- **Ignoring them:** they are a plausible share of the unexplained burn.

## 2026-11-09 — left to design latitude (not operator calls)

Recorded in `BRIEF.md` rabbit holes and decided inside the goal SPECs:
- the snapshot store (file per PR vs a per-host SQLite table)
- the freshness bound
- the ETag cache partition key under hourly App-token rotation
- the worker's poll cadence and fingerprint gating
- whether a 304 costs a secondary point
