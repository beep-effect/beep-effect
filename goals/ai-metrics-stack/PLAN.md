# AI Metrics Stack Plan

This plan executes [SPEC.md](./SPEC.md). V1 is complete through P7e: P0
bootstrap, P1 source/privacy proof, P2 durable ingest, P3 OTLP/backend
contracts, P4 report-first scorecards, P5 install/remote deployment, P6
hardening plus the credited seven-day scorecard, P7a/b hybrid mirror and
retention workflows, P7f forwarder durability, and the P7e production closeout.
Phoenix is live on dankserver, Pulumi state is reconciled, and the workstation
timer owns live collection in the checkout-independent XDG state root.

P7c provider/gateway metrics and P7d dashboard/backend expansion remain
explicitly deferred follow-up capabilities, not V1 completion gates. Final
runtime, report, mirror, and privacy evidence is recorded in
[history/outputs/p7e-production-readiness-closeout.md](./history/outputs/p7e-production-readiness-closeout.md).

## P0: Initiative Bootstrap And Current State

Status: completed

- Create `@beep/repo-ai-metrics` with schema-first models, tolerant JSONL
  ingest summaries, benchmark/scorecard models, and target-agnostic install
  specs.
- Add `beep-cli ai-metrics` command scaffolding for install preview, ingest,
  forwarder, and benchmark workflows.
- Add `@beep/infra` `AIMetricsStack` as an import-safe Pulumi contract.
- Record current gaps in `history/outputs/p0-current-state.md`.

## P1: Source Discovery And Privacy

Status: completed

- Added source discovery for Codex, Claude Code, and OpenClaw safe gateway
  metadata, with configurable repo, home, and unit roots, last-seven-days defaults,
  `--since`, `--max-files`, and `--all`.
- Replaced the install-spec hardcoded transcript assumption with source
  discovery, config snapshot, and privacy-check planned commands.
- Added redaction result schemas, hash-only raw event envelopes, sanitized
  transcript projections, and salted private identifier hashes.
- Added deterministic config snapshots for `.codex`, `.claude`, `.ai`,
  `.aiassistant`, `AGENTS.md`, and `CLAUDE.md`, excluding `.repos`,
  `node_modules`, generated, cache, and build roots.
- Added synthetic tests and CLI smoke tests proving raw prompt/output text,
  secrets, and private local paths do not leak into derived JSON outputs.
- Recorded evidence in
  [history/outputs/p1-source-discovery-and-privacy.md](./history/outputs/p1-source-discovery-and-privacy.md).

## P2: Durable Ingest And Derived Storage

Status: completed

- Added `@beep/duckdb` as the driver-level DuckDB boundary, using the official
  DuckDB Node API and DuckDB `COPY ... FORMAT parquet` export path.
- Added AES-256-GCM encrypted raw archive objects under the target data root,
  keyed by `sourceKind + sourcePathHash + plaintextContentHash`.
- Added durable forwarder ingest for Codex and Claude JSONL plus OpenClaw safe
  gateway metadata, with config snapshot attribution.
- Materialized derived DuckDB tables for ingest runs, source files, raw archive
  objects, sessions, turns, and empty future-ready model/tool/label/benchmark
  and scorecard tables.
- Exported all derived tables to per-run Parquet snapshots.
- Added an internal in-memory Effect EventLog proof for sanitized turn
  projection.
- Recorded evidence in
  [history/outputs/p2-durable-ingest-and-derived-storage.md](./history/outputs/p2-durable-ingest-and-derived-storage.md).

## P3: OTLP And Backend Stack

Status: completed

- Use core Effect `Metric`, `Tracer`, `Logger`, `LogLevel`, `ErrorReporter`,
  `Clock`, and `Redacted` APIs as the instrumentation vocabulary.
- Export through stable `@effect/opentelemetry/NodeSdk.layer` for v1, with a
  trace-only `@beep/observability` Node SDK helper using protobuf OTLP HTTP
  exporters for Phoenix smoke targets.
- Keep `effect/unstable/observability` and `effect/unstable/devtools` as later
  or experimental references.
- Added generated local Phoenix compose smoke target and kept Langfuse, Opik,
  and PostHog behind install/export contracts instead of backend-specific
  drivers.
- Add low-cardinality OTLP attribute policy for agent, source, provider, model,
  config snapshot, and outcome labels.
- Added redacted derived DuckDB to OTLP span projection and CLI export workflow.
- Recorded evidence in
  [history/outputs/p3-otlp-and-backend-stack.md](./history/outputs/p3-otlp-and-backend-stack.md).

## P4: Scorecards, Labels, And Benchmarks

Status: completed

- Added deterministic `AgentTask` projection rows linked to sessions through
  hash-only deploy-safe metadata.
- Added scriptable `ai-metrics label queue` and `label add` workflows with
  structured labels, redacted notes, and config-snapshot attribution.
- Added deploy-safe benchmark case and recorded run workflows linked to config
  snapshots without storing prompt text in derived tables.
- Added `ai-metrics report weekly` to generate Markdown and JSON weekly
  config-impact reports from derived DuckDB tables.
- Recorded evidence in
  [history/outputs/p4-scorecards-labels-and-benchmarks.md](./history/outputs/p4-scorecards-labels-and-benchmarks.md).

## P5: Install And Remote Deployment

Status: completed

- P5a completed: added typed install plan, install doctor, and dry-run apply
  contracts plus CLI workflows. Recorded evidence in
  [history/outputs/p5a-operator-contract-and-dry-run-apply.md](./history/outputs/p5a-operator-contract-and-dry-run-apply.md).
- P5b implementation complete: `@beep/infra` now uses Pulumi remote command
  resources to preflight dankserver, render the Phoenix compose and user
  systemd unit, configure dedicated Tailscale Serve HTTPS on port `8447`, and
  run health checks. Recorded evidence in
  [history/outputs/p5b-real-pulumi-remote-apply.md](./history/outputs/p5b-real-pulumi-remote-apply.md).
- P5b live deployment completed over SSH using the same remote commands the
  Pulumi component owns. Phoenix is verified at
  `https://dankserver.tailc7c348.ts.net:8447`.
- The AI metrics 1Password refs now resolve at
  `op://TBK/ai-metrics/hash-salt` and
  `op://TBK/ai-metrics/raw-archive-key`.
- The first live forwarder run wrote encrypted raw archive metadata, derived
  DuckDB/Parquet state, and redacted OTLP traces. Recorded evidence in
  [history/outputs/p6-seven-day-proof-and-hardening.md](./history/outputs/p6-seven-day-proof-and-hardening.md).
- P5b Pulumi state reconciliation completed on May 9, 2026:
  `pulumi preview -s beep-ai-metrics-dankserver --non-interactive --diff` and
  `pulumi up -s beep-ai-metrics-dankserver --yes --non-interactive` passed,
  stack state has 6 resources, and live Phoenix reports version `15.5.0`.
- Preserve local as the repeatable smoke target.

## P6: Seven-Day Proof And Hardening

Status: completed

- Preserved the first real collection/export proof as baseline evidence and
  credited the explicit May 9, 2026 02:26 through May 16, 2026 02:26
  America/Chicago window.
- Retained the human-approved label and benchmark evidence for
  `config-6c5738fd0e1932ced6043ab52c7df04e52278b1024470769243b724c265f7d52`;
  the final exact-window scorecard remains `completionReady=true`.
- Production collection is workstation-owned by
  `beep-ai-metrics-forwarder.timer` at a six-hour cadence. The unit executes
  from the clean `beep-effect` checkout and writes all durable state to
  `~/.local/state/beep/ai-metrics`; no checkout contains a
  `.beep/ai-metrics` tree.
- The source cap remains intentionally bounded at 50 files per source and 32
  MiB per file. The fixed-branch closeout run included 50 of 179 Codex
  candidates plus all 36 Claude files, created 66 new/changed archive objects,
  and exported all 27,453 newly pending turns. Candidate counts describe the
  rolling rescan set rather than an unprocessed queue; there was no evidence
  that justified raising the memory-heavy production cap.
- Final P6 and P7e evidence is in
  [history/outputs/p7e-production-readiness-closeout.md](./history/outputs/p7e-production-readiness-closeout.md).

## P6a: Fresh Review Data And Ops Hardening

Status: completed

- Preserve Codex subagent attribution through source discovery, privacy
  projection, derived DuckDB/Parquet, OTLP span attributes, and label queues
  using source role plus hash-only parent/session/thread metadata.
- Replace global forwarder source starvation with source-aware per-source
  budgets and coverage reporting for Codex, Claude Code, and OpenClaw gateway
  metadata.
- Persist config snapshot manifests and latest pointers so scorecards can
  distinguish included config files from actual added, modified, and removed
  paths.
- Make weekly scorecards report `completionReady=false` until at least one
  outcome label and one benchmark run exist for the scored config snapshot.
  Provider/model/tool/token/cost metrics remain explicit
  `*_unavailable_not_scored` gaps until real integrations populate them.
- Add an explicit OTLP metadata allowlist and keep subagent/source identifiers
  hash-only in derived exports.
- Add a workstation systemd user timer render path for live collection with
  lock, retry/backoff, status artifact, and journal evidence. True server-owned
  collection remains a P7 topology target.
- Add an archive decrypt drill that verifies one encrypted raw archive object
  without printing transcript text.
- Update install/runbook commands so 1Password refs are separate from runtime
  values: commands that need the raw archive key must export
  `BEEP_AI_METRICS_RAW_ARCHIVE_KEY="$(op read '<ref>')"`.
- Reconciled Pulumi before restarting the credited proof: preview/apply/health
  passed and live Phoenix version matches declared stack config.
- Documented retention, deletion, archive decrypt, backup, restore, and proof
  restart policy in the P6a closeout output.
- Recorded closeout and proof restart evidence in
  [history/outputs/p6a-closeout-proof-restart.md](./history/outputs/p6a-closeout-proof-restart.md).

## P7: Topology-First Productionization

Status: completed for V1

- Preserve the credited P6 evidence and privacy contract while operating
  against the single XDG production root.
- P7a implemented: raw encrypted transcripts remain workstation-local, while a
  sanitized derived mirror bundle can be built under
  `<dataRoot>/mirror/bundles/<bundleId>`. The bundle contains `manifest.json`,
  `status/mirror-status.json`, and Parquet exports from an explicit P7-safe
  table allowlist. Raw archive tables, transcript bodies, local source paths,
  archive paths, DuckDB paths, and encryption material are excluded from the
  synced payload.
- P7a implemented: added `beep ai-metrics mirror build`, `mirror sync`, and
  `mirror status`. `mirror sync` is dry-run by default and requires
  `--confirm p7-derived-mirror` before rsync writes to
  `/srv/data/ai-metrics/p7-derived-mirror` over SSH.
- P7b implemented: added `beep ai-metrics retention list`,
  `retention restore-drill`, `retention delete`, and `retention compact`.
  Delete and compact default to dry-run and require both an explicit time
  window and `--confirm p7-retention-window` for real mutation. The restore
  drill verifies decrypt plus content-hash integrity and replays into a
  disposable derived root without printing transcript text.
- P7b implemented: `@beep/infra` now models the remote mirror root as
  `remoteMirrorRoot` with default `/srv/data/ai-metrics/p7-derived-mirror`.
- P7f completed for the V1 production path. Content-addressed ingest and
  at-least-once OTLP delivery had already landed. This closeout adds a durable
  checkpoint after every acknowledged 512-span chunk, preventing a backlog
  larger than Phoenix's bounded queue from replaying its accepted prefix and
  starving later turns. The production timer remains on `--parquet-mode none`;
  that is not a mirror gate because `mirror build` creates fresh allowlisted
  Parquet directly from DuckDB.
- P7e completed: generated the final exact-window scorecard, built the
  sanitized bundle from the XDG data root, synced it with explicit confirmation to
  `/srv/data/ai-metrics/p7-derived-mirror`, and read the remote manifest back
  through `mirror status`.
- Follow-up, not V1-blocking: P7c provider/model/tool/token/cost enrichment,
  P7d dashboard/backend expansion, clearer sanitized OTLP failure causes,
  Phoenix capacity telemetry, and remote mirror lifecycle automation beyond
  confirmed bundle sync/status.
- Planning packet:
  [history/outputs/p7-topology-first-production-plan.md](./history/outputs/p7-topology-first-production-plan.md).

## Required Checks

- `bun run check`
- `bun run config-sync`
- `@beep/repo-ai-metrics`: `check`, `test`, `lint`, `docgen`
- `@beep/repo-cli`: `check`, `test`, `lint`
- `@beep/infra`: `check`, `test`, `lint`
- CLI smoke for source discovery, ingest, install plan/doctor, forwarder timer
  rendering, archive drill, labels, benchmarks, and report generation
- Production timer verification: service `WorkingDirectory`, absolute XDG data
  root, six-hour cadence, latest status JSON, and Phoenix health/capacity
- Pulumi preview and apply for the dankserver target
