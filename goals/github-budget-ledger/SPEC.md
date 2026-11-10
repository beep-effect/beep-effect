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

- [ ] **First vertical slice:** a `yeet monitor --until-ready` run on this host produces ledger rows for every
      in-process GitHub request it makes, each carrying identity, resource, command, host, `limit`, `remaining`,
      `used` and `reset`, under `$XDG_STATE_HOME/beep/github/ledger`.
- [ ] One `/rate_limit` sampler per configured identity adds fleet-wide `used` per identity x resource; the ledger
      reports `unattributed = fleet used - attributed` per identity x resource and window. Adding a second identity
      is configuration only (tested with two fake identities).
- [ ] `bun run beep session open` prints a `github-headroom` line: per-resource remaining and reset time, and this
      host's top spenders by command. A missing or stale ledger renders as unknown with its age.
- [ ] `gh` spawns made through `ghOutput` and `runRepoCommandCapture("gh")` are attributed to their command (count
      and, where the next `/rate_limit` sample allows, estimated cost). No PATH shim exists.
- [ ] `GraphqlBudget` consults the ledger before spending a probe.
- [ ] The ledger exposes a typed reserve signal (`belowReserve` per identity x resource, threshold 15% of that
      bucket's `limit`) with a test showing background callers see it, that one identity's low bucket does not
      signal another identity's, and that interactive / merge-critical callers are not blocked by it.
- [ ] **Baseline recorded:** at least 24 h of ledger data on the hub (DankStation) summarised in
      `history/` as requests and points per hour per resource, per command, with the unattributed remainder. This
      resolves or explains the 430-vs-720-1,440 GraphQL/h conflict and is the "before" for goals 2 and 3.
- [ ] **T3 share threshold set:** a decision file records the threshold (a share of fleet GraphQL points/h
      attributed or bounded to T3 Code) that fires the `t3-snapshot-consumer` gate, with the measured T3 share at
      the time and how it was measured.
- [ ] No token, absolute home path or machine id appears in any ledger row, parcel or packet file.
- [ ] No unrelated refactors or formatting churn.

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

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
