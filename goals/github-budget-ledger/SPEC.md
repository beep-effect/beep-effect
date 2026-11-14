# GitHub Budget Ledger Spec

## Objective

Record what every GitHub request this repo's tooling makes costs, so later goals are sized on
measurements instead of estimates. Concretely:

- The in-process GitHub transport (`@beep/github`) records the `x-ratelimit-*` headers of every response together
  with the **resource** (`core`, `graphql`, `search`, ...) and the **identity** that made it.
- `gh` subprocess calls made through the repo's spawn helpers are attributed to the calling command.
- Rows are persisted in a host-scoped ledger keyed by identity x resource x command x host.
- One sampler per configured identity reads the free `GET /rate_limit` for the true fleet-wide usage of that
  identity's buckets (today only the user identity; `yeet-monitor-app-identity` adds the beep-fleet-orchestrator App
  installation as a second configured identity, with no ledger code change). The gap between a bucket's sampled
  usage and its attributed rows is reported as an explicit unattributed remainder (T3 Code, raw agent `gh`, other
  hosts).
- `bun run beep session open` shows a `github-headroom` Palantiri parcel: per-resource remaining, reset time and this
  host's top spenders.
- The ledger publishes the **15% background reserve signal**, keyed by identity x resource, that
  `github-state-worker` and later readers obey.
- The goal ends by recording the **T3 share threshold** that gates the `t3-snapshot-consumer` candidate, and a
  measured baseline that goals 2 and 3 are judged against.

Source exploration: [`explorations/github-api-quota`](../../explorations/github-api-quota/README.md) — [`BRIEF.md`](../../explorations/github-api-quota/BRIEF.md),
[`MAP.md`](../../explorations/github-api-quota/MAP.md) (goal 1, first vertical slice), [`DECISIONS.md`](../../explorations/github-api-quota/DECISIONS.md),
[`RESEARCH.md`](../../explorations/github-api-quota/RESEARCH.md).

## Non-Goals

- Changing how often or how anything polls GitHub: no snapshot worker, batched fingerprint GraphQL, ETag layer or
  snapshot readers. Those are [`github-state-worker`](../github-state-worker/SPEC.md) (goal 2).
- Changing which identity reads: the read-only monitor, `rerun-runner-loss.yml` widening and the App installation
  token are [`yeet-monitor-app-identity`](../yeet-monitor-app-identity/SPEC.md) (goal 3).
- Enforcing the reserve in existing callers beyond what the first slice needs. This goal publishes the signal; goal 2
  makes the worker obey it.
- A `gh` shim on PATH. `gh` attribution happens only by wrapping the repo's own spawn helpers.
- Fleet-wide shared state or cross-host polling. The ledger is host-scoped; the free `/rate_limit` is the only
  fleet-wide view.
- Webhook receivers, public ingress or App hook configuration (gated candidate `github-webhook-intake`).
- Patching the t3code fork. T3 is measured here and changed only if the gate this goal sets fires
  (`t3-snapshot-consumer`).
- Creating extra GitHub Apps or tokens to multiply buckets.
- Replacing merge-gate with GitHub's merge queue
  ([`explorations/github-merge-queue`](../../explorations/github-merge-queue/README.md)).
- Weakening any gate's evidence: ledger data never replaces a gate's authoritative read.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/drivers/github` (`@beep/github`):
  - `src/internal/octokit.ts` (`makeTransport` `record`, around lines 282-285): add resource and identity to each
    recorded snapshot and emit it to a sink, not only the last-value `Ref`.
  - `src/Resilience.ts` (`RateLimitSnapshot`): extend the schema with `resource` and `used`.
- `packages/tooling/tool/cli` (`@beep/repo-cli`):
  - `src/commands/Yeet/internal/MonitorRateLimit.ts` (`readYeetGithubRateLimit`, #3032): reuse as the `/rate_limit`
    sampler input.
  - `src/internal/github/GraphqlBudget.ts`: read the ledger first before probing.
  - `src/internal/github/GhCommand.ts` (`ghOutput`) and `src/internal/repo-run` (`runRepoCommandCapture("gh")`):
    attribution wrappers.
  - `src/internal/github/GithubIdentity.ts`: identity label for transport rows (never the token).
  - A new ledger module under `src/internal/github/` (schema, service, file store).
  - `src/commands/Palantiri/` (`Palantiri.service.ts` `writePrivateFile` / `retainLastGood`): the
    `github-headroom` producer.
- `packages/tooling/library/palantiri` (`@beep/palantiri`): `src/Parcel.models.ts`, `src/Freshness.ts`, modelled
  on `AccountHeadroom.ts` / `AccountHeadroom.models.ts`: a `github-headroom` parcel.
- Session-open rendering of the parcel: `packages/tooling/tool/cli/src/commands/Session/Session.command.ts`, which
  renders through `src/commands/Palantiri/Palantiri.hot.ts` (`printHotParcels`) and `layerPalantiriSourcesHot` in
  `src/commands/Palantiri/Palantiri.service.ts`.
- Tests under `packages/drivers/github/test/`, `packages/tooling/library/palantiri/test/` and
  `packages/tooling/tool/cli/test/`.
- This packet (`goals/github-budget-ledger/**`).

No new workspace package is planned. If one becomes necessary it is bootstrapped with
`bun run beep create-package`.

## Constraints

- **Design order:** schema first (`LedgerRow` keyed by identity x resource x command x host, `GithubResource` as a
  `LiteralKit`, identity label, the configured-identity list the samplers read, headroom parcel), then an Effect `Context.Service` contract for the ledger, then implementation. Effect v4 only, validated
  against `.repos/effect`; `Effect.fn` / `Effect.fnUntraced` for generator functions; `effect/HashMap` /
  `HashSet`, never native `Map` / `Set`; imports from `effect/<Module>` leaves.
- **Package homes** follow the exploration decision: header capture and rate-limit handling stay in
  `drivers/github`; ledger, sampler, attribution and the parcel producer live in the tooling family.
- **No secrets in the ledger or anywhere persisted.** Identity is a non-secret label (login, App slug, or a
  short hash of the token lineage), never a token. Tokens arrive only through `LoadCredential=` or the 1Password
  route; nothing goes into unit environments or argv (ruling 39).
- **Remaining counts are approximate** and vary by region: the reserve is a margin (15% = 750 of 5,000 per
  resource), not exact arithmetic. GraphQL rate-limit errors can arrive as HTTP 200; record them as such.
- **`/rate_limit` is free** on the primary limit; sample it on a bounded cadence and never let the sampler itself
  become a measurable spender (record its own calls with cost 0 when the headers confirm it).
- **Leftover `gh` spawns are attributed, not cached.** No `gh api --cache`; it never revalidates.
- **Host-scoped persistence** under `$XDG_STATE_HOME/beep/github/ledger`, written atomically (Palantiri
  `writePrivateFile` pattern), private file mode, bounded retention. A reader of a missing or stale ledger falls
  back to "unknown", never to "plenty of headroom".
- **Ledger failures never fail the request.** Recording is best-effort and off the request's error channel.
- `@beep/repo-cli` tests must pass on both Node and Bun.
- Keep appetite: this goal is the first of three in about two weeks, with at most three open PRs across the
  packets ([`DECISIONS.md`](../../explorations/github-api-quota/DECISIONS.md) "appetite").

## Acceptance Criteria

- [x] **First vertical slice:** a `yeet monitor --until-ready` run on this host produces ledger rows for every
      in-process GitHub request it makes, each carrying identity, resource, command, host, `limit`, `remaining`,
      `used` and `reset`, under `$XDG_STATE_HOME/beep/github/ledger`.
- [x] One `/rate_limit` sampler per configured identity adds fleet-wide `used` per identity x resource; the ledger
      reports `unattributed = fleet used - attributed` per identity x resource and window. Adding a second identity
      is configuration only (tested with two fake identities).
- [x] `bun run beep session open` prints a `github-headroom` line: per-resource remaining and reset time, and this
      host's top spenders by command. A missing or stale ledger renders as unknown with its age.
- [x] `gh` spawns made through `ghOutput` and `runRepoCommandCapture("gh")` are attributed to their command (count
      and, where the next `/rate_limit` sample allows, estimated cost). No PATH shim exists.
- [x] `GraphqlBudget` consults the ledger before spending a probe.
- [x] The ledger exposes a typed reserve signal (`ReserveState` `Below` / `Clear` / `Unknown` per identity x
      resource, threshold 15% of that bucket's `limit`) with a test showing background callers see it and that one
      identity's low bucket does not signal another identity's. The signal carries no caller-priority logic:
      admitting interactive and merge-critical reads below the reserve belongs to its first consumer,
      [`github-state-worker`](../github-state-worker/SPEC.md) (decision 2026-11-10 "reserve priority moves to goal 2").
- [x] **Baseline recorded:** at least 24 h of ledger data on the hub (DankStation) summarised in
      `history/` as requests and points per hour per resource, per command, with the unattributed remainder. This
      resolves or explains the 430-vs-720-1,440 GraphQL/h conflict and is the "before" for goals 2 and 3.
- [x] **T3 share threshold set:** a decision file records the threshold (a share of fleet GraphQL points/h
      attributed or bounded to T3 Code) that fires the `t3-snapshot-consumer` gate, with the measured T3 share at
      the time and how it was measured.
- [x] No token, absolute home path or machine id appears in any ledger row, parcel or packet file.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/github-budget-ledger/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/github-budget-ledger/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/github-budget-ledger` | Passes |
| Driver package | `bun run beep quality package-verify @beep/github` | Passes |
| Palantiri package | `bun run beep quality package-verify @beep/palantiri` | Passes |
| CLI package | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Transport header capture | `bunx vitest run packages/drivers/github/test/internal/octokit.coverage.test.ts packages/drivers/github/test/Resilience.test.ts` | Passes, including resource + identity rows |
| Parcel | `bunx vitest run packages/tooling/library/palantiri/test/Parcels.test.ts` | `github-headroom` cases pass |
| CLI ledger, sampler, attribution (Node) | `bunx vitest run packages/tooling/tool/cli/test/yeet-monitor-rate-limit.test.ts packages/tooling/tool/cli/test/palantiri-parcels-command.test.ts` plus the new ledger test file | Passes |
| CLI ledger, sampler, attribution (Bun) | `cd packages/tooling/tool/cli && bunx --bun vitest run test/yeet-monitor-rate-limit.test.ts test/palantiri-parcels-command.test.ts` plus the new ledger test file | Passes |
| Session open | `bun run beep session open` on the hub | Prints a `github-headroom` line |
| Baseline | `history/` baseline note from 24 h of ledger data | Present, with unattributed remainder |
| Decision log | `bun run beep goals decisions check --slug github-budget-ledger` | No drift |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |
| Final | `bun run beep yeet final-check` | Passes on the pushed head |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add github-budget-ledger --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug github-budget-ledger`; add a `kind: decision` file there, never edit this block._

### Appetite: goal 1 of 3 in about two weeks, at most three open PRs, 2026-11-09

This goal is the first of three packets (ledger, per-host worker, read-only monitor on the App identity) sharing about two weeks of agent time and at most three concurrently open PRs. Webhooks, T3 changes and fleet sharing stay behind evidence gates. Source: exploration `explorations/github-api-quota/DECISIONS.md`, "appetite: 3 goals, about 2 weeks".

Reverse: Re-shape the appetite in the exploration and supersede this decision.

### Measure first: the ledger is slice 0 and sizes goals 2 and 3, 2026-11-09

This goal goes first. It persists a per-identity, per-resource ledger fed by response `x-ratelimit-*` headers and the free `/rate_limit`, with per-command and per-host attribution and a `github-headroom` parcel in `session open`. Its baseline resolves the 430 vs 720-1,440 GraphQL/h conflict and is the before-number for goals 2 and 3. Source: exploration `explorations/github-api-quota/DECISIONS.md`, "measure first".

Reverse: Let github-state-worker start before the baseline exists and size it on the exploration's estimates, recording why.

### Package homes: header capture in drivers/github, ledger and parcel in tooling, 2026-11-09

Header capture and rate-limit handling extend `packages/drivers/github` (`internal/octokit.ts` `transport.rateLimit`, `Resilience.ts`); the ledger, `/rate_limit` sampler and `gh` attribution live in `packages/tooling/tool/cli`; the `github-headroom` parcel lives in `packages/tooling/library/palantiri` and the CLI Palantiri commands. Source: exploration `explorations/github-api-quota/DECISIONS.md`, "package homes".

Reverse: Move the ledger module into drivers/github (or a new package via create-package) and record a superseding decision.

### Reserve: publish a 15% background reserve signal per identity and resource, 2026-11-09

The ledger publishes a signal per identity x resource that is true once that bucket's fleet-wide remaining falls below 15% of its limit (750 of 5,000 for the user's core and GraphQL), until reset. One `/rate_limit` sampler runs per configured identity; today that is the user, and goal 3 adds the App installation by configuration. The exploration decided the threshold for the shared user bucket; keying by identity keeps it from mixing buckets. Background reads back off on it; interactive and merge-critical reads may go to 1. 15% sits above T3's 10% floor. Enforcement in the worker is goal 2. Source: exploration `explorations/github-api-quota/DECISIONS.md`, "reserve: 15% of the shared bucket".

Reverse: Change the threshold constant and the decision; callers read it from the ledger, so no caller changes are needed.

### Scope: per-host ledger, fleet view only via the free /rate_limit, 2026-11-09

The ledger is host-scoped. Hosts coordinate only through the free `GET /rate_limit`, which reports the true fleet-wide usage of the shared user bucket; no cross-host state is built. Source: exploration `explorations/github-api-quota/DECISIONS.md`, "scope: per host first".

Reverse: Introduce a fleet-shared ledger store through the gated github-fleet-sharing candidate and supersede this decision.

### T3 Code: measured here, changes gated on a threshold this goal sets, 2026-11-09

The ledger attributes (or bounds, via the unattributed remainder) T3 Code's share of GraphQL points. This goal records the threshold that fires the `t3-snapshot-consumer` gate. No t3code fork change happens here. Source: exploration `explorations/github-api-quota/DECISIONS.md`, "T3 Code: measured, with changes gated".

Reverse: Lower or raise the threshold by a superseding decision, or open t3-snapshot-consumer directly by operator call.

### A1 Identity label: the bucket owner, with a host-scoped alias map, 2026-11-10

The identity label names the bucket owner: `user:<login>`, `app:<id>/<inst>[/jwt]`, `anonymous` or `unresolved`, with `token:` plus a 12-hex SHA-256 prefix as a degraded label. A host-scoped `aliases.json` maps token hashes to logins. It is seeded at no cost from gh-cli and configured logins, otherwise by one `GET /user` per new token lineage (nominal cost 1). Aliases apply at record time and at read time, so one bucket keeps one label.

Resolves SPEC ambiguity A1 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Drop the alias map and key windows on raw labels.

### A10 Cross-process writers: one O_APPEND write per line, no lock, 2026-11-10

Each row is one `O_APPEND` write of one line to a local regular file, with no lock and a 4 KiB line cap as a sanity bound; the reader skips torn lines. The sampler lease is an exclusive create, a stale lease (120 s) is reclaimed by rename, and the due check is repeated after acquiring it.

Resolves SPEC ambiguity A10 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Move to a SQLite store, per the exploration's rabbit hole.

### A11 Configured identities live in $XDG_CONFIG_HOME/beep/github/identities.json, 2026-11-10

The configured identity list is `$XDG_CONFIG_HOME/beep/github/identities.json`, overridable with `BEEP_GITHUB_IDENTITIES_FILE`. The sampled set is its entries, the env-selected identity and `GhCli`, deduplicated by label. `OpRef` entries require `login`, and reference fields must match `op://`.

Resolves SPEC ambiguity A11 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Move it into env or the state dir.

### A12 GraphQL secondary limits served as 200 are recorded, not reclassified, 2026-11-10

A GraphQL secondary rate limit served with status 200 is recorded with outcome `secondary-limited`. The driver's retry classification is unchanged in goal 1; goal 2's rate-limit handling owns it.

Resolves SPEC ambiguity A12 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Reclassify it as `rateLimited` in `GraphQL.ts`.

### A13 The driver takes an opaque budgetLabel and a technical credential, 2026-11-10

The driver learns the identity only through an opaque `budgetLabel` option (the Prow budget-id pattern) and a technical `credential` (`token`, `app-jwt` or `unauthenticated`). The driver never composes a label; the CLI derives `/jwt` and `anonymous` from `credential`.

Resolves SPEC ambiguity A13 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Move label resolution into the driver.

### A14 Host label: the short hostname, never a machine id, 2026-11-10

Rows carry the short hostname only. `/etc/machine-id` is never read into a row.

Resolves SPEC ambiguity A14 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Hash the hostname.

### A15 Parcel buckets: core, graphql and search in the summary, 2026-11-10

The github-headroom summary lists `core`, `graphql` and `search` per known identity. The items carry every bucket the ledger's reserve signals return.

Resolves SPEC ambiguity A15 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Change the summary filter.

### A16 The baseline and the T3 decision ride the goal's final PR, 2026-11-10

The baseline note and the T3-share decision do not ride the implementation PR. One implementation PR lands first; the goal's final PR follows after at least 24 h of hub data, per the AGENTS two-PR closeout.

Resolves SPEC ambiguity A16 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: None: the two-PR closeout is a repo law.

### A17 GraphQL truth: transport anchors, with samples admitted by calibration, 2026-11-10

GraphQL anchors and the GraphQL reserve use transport-basis readings, because REST `/rate_limit` misreports the GraphQL bucket. REST sample `graphql` readings are admitted only when at least 6 calibration pairs in 7 days show a median drift of at most 50 points. Calibration is a manual command costing 1 point per pair, run once at P1 exit.

Resolves SPEC ambiguity A17 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Trust REST samples unconditionally, or drop them for GraphQL entirely.

### A18 Operation labels are normalised at record time, 2026-11-10

`normalizeOperation` runs at record time: owner/repo, user, org, numeric, SHA and named segments become placeholders, with depth 8 and 120 characters. Callers that interpolate parameters are left unchanged.

Resolves SPEC ambiguity A18 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Change those callers to route templates and drop normalisation.

### A19 T3 share: a one-off fleet aggregation, no shared state, 2026-11-10

The T3 share is bounded by a one-off aggregation of every fleet host's ledger report for the baseline window: T3 plus uncovered spend is at most the hub's `fleetUsed(graphql)` minus the hosts' estimated points and gh estimates. Known in-repo leaks are listed beside it. No state is shared between hosts.

Resolves SPEC ambiguity A19 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Build a fleet-shared ledger through the gated sharing candidate.

### A2 Command label: walk the loaded effect/cli command tree, 2026-11-10

The COMMAND label is read from the loaded `effect/cli` command tree: only known group and subcommand names count, root flags are skipped as in `Dispatch.firstPositional`, at most three words are kept and the default is `beep`. Each record reads it from the requesting fiber's `GithubLedgerCommand` reference.

Resolves SPEC ambiguity A2 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Fall back to the leading-argv-word heuristic.

### A20 Error shape: one GithubLedgerError with a reason, 2026-11-10

Ledger failures are one `GithubLedgerError { reason, detail, cause, message }` using the shared `optionalDefect` helpers. The reasons are `state-dir`, `read`, `write`, `decode` and `config`, with a fixed mapping from each failure source.

Resolves SPEC ambiguity A20 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Split into per-reason error classes.

### A3 Sampler: a 5-minute user timer plus opportunistic monitor samples, 2026-11-10

With no daemon, a 5-minute systemd user timer samples non-App identities. Monitor polls sample their own client's identity opportunistically, forked into the loop scope with a 30 s cap, and the monitor's pause read is recorded too; `session open` never samples. The due check and the lease come before any client build. App identities are sampled only by long-lived processes that already hold an installation client. Each sample is two free reads.

Resolves SPEC ambiguity A3 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Sample Apps in the timer and record the mint and revoke as sampler self-cost.

### A4 Per-request cost: nominal cost plus telescoped fleet usage, 2026-11-10

Rows store the raw headers plus `nominalCost`: REST 1; 304, `/rate_limit` and primary `rate-limited` 0; GraphQL a floor of 1. Hourly fleet usage telescopes per reset epoch. Per-command points use a min-positive same-pid delta-used estimator per GraphQL operation, with at least three candidates. A `gh` spawn costs 1, bounded by the residual.

Resolves SPEC ambiguity A4 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Record `rateLimit{cost}` per GraphQL document (goal 2).

### A5 Resource set: a driver LiteralKit with an unknown member, 2026-11-10

The driver owns a `LiteralKit` with the documented resource keys plus `unknown`. A GraphQL response without a resource header becomes `graphql`; a REST one becomes `unknown`. Unknown `/rate_limit` body keys are dropped.

Resolves SPEC ambiguity A5 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Extend the literal list.

### A6 GraphqlBudget trusts only fresh transport-basis readings, 2026-11-10

`GraphqlBudget` may skip its probe only on a transport-basis (GraphQL header) reading at most 60 s old whose reset is still ahead, from memory or `latest/transport-*.json`. It never trusts samples.

Resolves SPEC ambiguity A6 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Allow sample-basis readings.

### A7 Reserve: Unknown admits background callers, 2026-11-10

An `Unknown` reserve admits background callers. The threshold is `ceil(0.15 x limit)`. A reading counts for 10 minutes; after its reset the state is `Unknown{window-reset}`. The github-headroom parcel shows the reserve state the signal computed, never its own.

Resolves SPEC ambiguity A7 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Make `Unknown` refuse background calls (goal 2 may).

### A8 Retention: 72 h raw rows, 256 MiB cap, 35-day rollups, 2026-11-10

Raw rows are kept 72 h with a 256 MiB cap, and rollups 35 days. An hour is rolled up complete at H+1h+15min once a later anchor exists, or incomplete at H+3h otherwise. Incomplete rollups are rewritten while their raw rows still exist.

Resolves SPEC ambiguity A8 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Change the constants.

### A9 The ledger is disabled in CI and by BEEP_GITHUB_LEDGER=off, 2026-11-10

The ledger sink is disabled when `isCiSync()` holds or `BEEP_GITHUB_LEDGER=off`, read through `configStringOption`. The github-headroom parcel still reads whatever ledger the host has.

Resolves SPEC ambiguity A9 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").

Reverse: Enable it with a CI state root.

### Reserve priority moves to goal 2, 2026-11-10

Hosted Fallow dead-code on #3068 flagged ReserveSignal.belowReserve and admits as unused: only tests called them, and goal 1 deliberately has no reserve-enforcing caller (SPEC non-goal: this goal publishes the signal, github-state-worker makes the worker obey it). The members were removed and consumers read ReserveState via ReserveState.match. The goal 1 acceptance criterion no longer asks for an interactive/merge-critical admission test; github-state-worker's SPEC already owns that rule (merge-critical head-pinned re-read and operator-direct commands may go to 1) and its test, at the first real consumer.

Lane feat/github-budget-ledger · PR #3068

Reverse: Restore a priority-aware admits(priority) on ReserveSignal with a production caller and the goal 1 test

### Review fixes: calibration file, latest retention, shown-bucket freshness, lease token, 2026-11-10

Independent behaviour and laws reviews of the P1 slices found that the design as built made the hot parcel read stale and slow. Five deviations from the normative design (2026-11-10-design.md) fix that:

- **Calibration pairs also go to `calibration.jsonl`** at the ledger root, beside their raw-hour rows. The read side and every prune judge calibration from that small file. They no longer decode seven days of raw hours, so `session open` stays inside its 2 s budget for an `OpRef` identity that only the timer samples. Retention keeps that file to the 7-day calibration window.
- **Prune drops `latest/` transport and sample readings older than 24 h.** A key seen once, such as a reviewer App run, the `unresolved` mint or an old token hash, no longer stays in every read.
- **The parcel's envelope freshness covers only the buckets the summary shows**: the fresh `core`, `graphql` and `search` buckets. This changes section 8's "the oldest reading". With no bucket shown, every bucket decides, so a stale ledger still never reads as headroom.
- **The parcel shows each bucket's newest usable reading** (ledger `latestUsable`, the reading `reserveOf` judges). Its numbers and its verdict therefore always come from the same reading. A `graphql` bucket with only uncalibrated REST samples has no usable reading and is left out.
- **The sampler lease body is `{pid, at, token}` JSON with a random token**, as section 4.2 intended. The holder deletes the lock only while the lock still holds its own token. Each `sampleAll` entry is capped at 60 s, under the 120 s staleness bound.

Spawn rows now take the identity the spawned `gh` spends. That is the env token's `token:` hash when `GH_TOKEN` or `GITHUB_TOKEN` is set, mapped through the alias map at record time. Otherwise it is the hosts.yml login. The label stays the hash rather than `unresolved`, so spawn rows land on the same key as that token's transport rows.

Reverse: Revert the review-fix commit; the ledger falls back to scanning raw hours for calibration, keeps every latest reading, and judges the parcel by its oldest bucket.

### GraphQL windows are reset-scoped instances, even for one token, 2026-11-13

D2f supersedes the 2026-11-13 premise that GraphQL windows are per credential. After #3200 merged, the live ledger reported 108,330+ GraphQL points for 2026-11-13T05 and 184,766+ for T06, against a 5,000-point window. Raw rows show one process, with one token fingerprint and one operation, alternating between two GraphQL windows whose resets are 15 seconds apart: in T06 one window rose to about 3,500 and the other to about 940. A token can therefore read two concurrent GraphQL windows. The 11-12 split by credential matched that data by coincidence and is not a property of the API.

Every GraphQL lane is now one reset-scoped window instance. A known fingerprint splits into instances by transitive reset proximity within five seconds, separately for idle and busy readings, exactly as unknown sources already did. Distinct fingerprints still never merge, and an unknown instance attaches only when exactly one known instance co-observes it (D2e). GraphQL windows never cross a reset. An instance contributes its peak in-hour `used`, minus its peak before the hour, or from zero when the window began inside the hour, or from its first in-hour reading as a lower bound. The peak replaces the last reading because a window's count only rises, so a lower late reading is a lagging response. Known REST credentials keep one continuous lane across resets, because core is shared per user.

Latest transport readings, the in-process cache and the write throttles retain one entry per GraphQL window instance, keyed per credential, so reserve sees a depleted window even when the token read the healthier one last. A window entry keeps its most used reading (then the newest), because a lower late reading is a lagging response; a known REST entry keeps its newest reading, which may follow a reset. GraphQL entries expire at their reset like unknown instances; known REST entries keep age-based retention.

Reserve judges the most constrained fresh (at most ten minutes old) live (reset after now) reading, whichever window or credential it reads. A live window's count only rises, so every such reading is a lower bound on its window, and per-lane newest-reading selection is unnecessary. This keeps the verdict stable when retention splits one reset-jittered window into two entries, which an independent review reproduced with resets drifting 0 to 8 seconds and a lower late reading.

v3 writes its latest transport files as `latest/v3-transport-<key>.json`. A v2 writer scans every `transport-` file and consolidates all files of one credential into one, deleting the rest; the review reproduced it collapsing two v3 window files so that a restarted v3 reader saw only the healthy window. Outside that namespace, v2 cannot touch v3 files. v3 still reads v2's `transport-` files as extra reserve candidates and prunes both namespaces by age and expiry, but never rewrites v2 files.

Rollups move to github-ledger-rollup/v3 and summaries to github-ledger-summary/v3. v1 and v2 rollups are legacy: with raw rows they recompute, and without them they stay explicit legacy-unrecomputable hours. Older summaries decode absent. A checkout that still runs v2 code rewrites v2 rollups for hours that it holds raw rows for, and v3 readers recompute those hours, so v3 readers stay correct while a mixed fleet upgrades.

An independent per-window computation over the live raw rows matches the v3 report for 2026-11-13T05 (3,192) and T06 (4,529).

Lane fix/github-ledger-graphql-windows

Reverse: Revert this change; v2 rollups are still on disk and raw rows recompute any hour within retention

### Ledger windows are per concurrent bucket, not per login, 2026-11-13

Live ledger data on 2026-11-12 established that GraphQL windows are per credential, not per login. Aliases fold multiple credentials into one user key, and the archive also shows one PID using multiple credentials. A key therefore needs physical-window membership, not identity or PID alone.

Rows carry an optional non-secret credential fingerprint: twelve lowercase hex digits of SHA-256, shared with tokenHashLabel. Missing keys decode to None; App installation identities remain unknown because their tokens rotate. Gh spawns fingerprint only their selected environment token, never gh's stored token.

D2/D2a retain continuous sequences for known fingerprints. Distinct known GraphQL fingerprints never merge. D2e supersedes D2d's closest-reset attachment: an unknown reset instance attaches only when exactly one known GraphQL lane directly co-observes it. Co-observation requires both readings to be busy, within five seconds of reset agreement, and observed before the reset. With no candidate the instance remains its own inferred lane. With multiple candidates it is ambiguous: accounting omits its usage and marks every hour touched by its anchors as an inferred lower bound. Reserve keeps the ambiguous readings as their own candidate lane so depletion cannot be hidden. An unknown instance is never a union edge between known fingerprints. The single-credential upgrade still counts 110 rather than 210; an unknown producer switching between A and B with observations 100, 110, 200 and 210 now counts the known total 320 rather than 410. A closest-reset or tie choice cannot establish credential ownership, so omitting ambiguous usage is the conservative bound. For core, search and other shared resources, groups merge only when positive readings observed before their reset agree within five seconds. A known REST sequence can absorb an unknown instance only through such a co-observation.

D2c supersedes D2b's fingerprint-free sub-lane continuation. Across the entire key, unknown busy anchors form window instances by transitive reset proximity within five seconds, irrespective of PID or sample source. Idle anchors form separate idle-only reset instances. Unknown instances never continue across a reset: the latest-ended-tail rule is removed. This prevents the cross-epoch merge bridge in which different PIDs inferred different successor assignments and whole-group merging retroactively joined concurrent windows.

An inferred instance's hourly fleet contribution uses its earliest reset minus one hour as its window start. With an anchor before the hour, subtract the last before-hour reading from the last in-hour reading. Otherwise count the last reading from zero if the window began in the hour, exactly; if it began earlier, subtract the first in-hour reading and mark the result as a lower bound. Floor each rise at zero. Known fingerprint lanes retain their real-reset crossing lower bounds, but apply the same start-time test to the first window: count its first observation from zero when it began inside the hour, otherwise disclose the initial undercount as a lower bound.

Unknown windows never carry a reset crossing, including when transitive jitter creates a cluster wider than five seconds. Inferred contributions set lanesInferred and render as `(inferred lanes)`; that marker is separate from the reset/partial-window lower-bound flag. Peak enrichment stays within a known lane. Nominal attribution and gh-spawn counts belong to the row's timestamp hour. Operation costs pair only within a PID, credential and compatible epoch, rejecting idle-to-busy jumps across incompatible resets.

Latest samples retain one row per identity and credential source in both file and memory stores; legacy sample files remain one source. Latest transports, in-process readings and write throttles retain known fingerprints per key and credential. Unknown transport readings use one-second reset buckets, separately for idle and busy states. A neighbour check within five seconds reuses the lexicographically earliest retained key and consolidates all matching neighbours while retaining the newest observation. If no retained instance matches, an occupied reset-bucket stem is never reused: allocate the first unused numeric suffix, checking all retained keys. This preserves separate windows when successive jitter moves a retained reading away from the reset encoded in its original key. Suffixes participate in the same persistence, cache, throttle and expiry paths. Distinct reset windows from one PID therefore survive, including in the same second of observation. The live files, memory store, cache and throttle share this retention helper. At each retention cycle, expired unknown reset instances are removed from persistent state and the cache; associated throttle entries are retired too. Known sequences retain their ordinary age-based retention. Reserve uses the same partition as accounting, treats each unknown window instance as a candidate, selects its newest fresh live reading, and signals on the most constrained candidate.

Summaries use github-ledger-summary/v2; v1 summaries decode absent. Rollups remain github-ledger-rollup/v2. Version-tagged reads distinguish current and legacy rollups. Raw-backed v1 hours recompute; without raw rows, an explicit legacy-unrecomputable result preserves request counts and marks invalid fleet/attribution estimates unknown. It never becomes an ordinary empty hour.

The independent D2c per-instance replay matches the report for core and GraphQL in all four target hours. GraphQL T20–T23 is 1,176+, 1,204+, 1,539+, 2,130+; T20 falls inside the independent 1,176..1,216 bound. The earlier dated design note is retained as history. The exact R1–R8 reproductions, the D2a resource rules, and D2c's three hourly baselines and cross-epoch bridge are covered by regression tests.

Lane fix/github-ledger-concurrent-buckets

Reverse: Revert this implementation; preserve raw rows and legacy rollups before any recalculation or migration

### T3 share threshold: fire t3-snapshot-consumer above a 60% median share and 1,500 points/h, 2026-11-13

The `t3-snapshot-consumer` gate (exploration MAP) fires when a 24 h window measured by the A19 method, run on the hub plus every reachable fleet host's `github ledger report --since 24h --json`, shows **both**:

1. The hourly **median** T3 share bound of the user identity's `graphql` key above **60%** of fleet GraphQL points. The bound is the residual `fleetUsed(hub) - hub est - hub gh - sum over hosts (est + gh)`, floored at 0, over `fleetUsed`.
2. The hourly **median** residual at or above **1,500 points/h**, 30% of one 5,000-point window.

**Measured at the time** (baseline `history/2026-11-13-hub-baseline.md`, 24 complete hours 2026-11-12T21Z to 2026-11-13T21Z, hub plus tbk-worker and dankserver): median share 45.6%, p90 66.4%, median residual 1,194 points/h. **The gate does not fire.**

**Why a share and an absolute floor.** The bound is an upper bound. It also holds raw agent `gh` and fleet hosts that were not reached, so a share threshold at or below today's 46% would fire on noise. The absolute floor covers the opposite failure. Once `github-state-worker` removes most `yeet monitor` spend (93% of the hub's attributed GraphQL points), T3's share rises mechanically while its spend stays the same. A large share of a small total is not a reason to patch the t3code fork. 1,500 points/h is about 25% above today's residual, so the gate fires only on real growth in T3 (or uncovered) spend.

**When to re-measure.** After `github-state-worker` lands (its after-number) and after `yeet-monitor-app-identity` 3b moves monitors to the App identity. Each re-measurement uses the same method and records the numbers in that goal's packet.

Lane goals/github-budget-ledger-final

Reverse: Supersede with a decision that sets a new share or absolute floor, or open t3-snapshot-consumer directly by operator call.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
