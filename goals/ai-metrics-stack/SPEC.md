# AI Metrics Stack Specification

## Status

**COMPLETE — RETAINED**

## Owner

@beep-team

## Created / Updated

- **Created:** 2026-05-05
- **Updated:** 2026-08-10

## Purpose

The repo needs a durable, privacy-safe metrics stack for developer AI usage.
The first data product is not generic product analytics. It is a config-impact
scorecard that answers:

- did changes to `.codex`, `.claude`, `.ai`, `.aiassistant`, `AGENTS.md`, or
  `CLAUDE.md` improve coding-agent outcomes?
- did adding or changing repo guidance improve completion rate, quality gates,
  intervention rate, cost, latency, or cycle time?
- which agent/provider/model/gateway paths are effective for this repo?

## Scope

In scope:

- Codex, Claude Code, OpenClaw transcript and session discovery
- xAI and Venice.ai usage where available through passive logs or optional
  LiteLLM gateway enrichment
- config snapshot hashing and attribution
- outcome-heavy scorecards and curated repo benchmarks
- encrypted raw archive plus redacted derived dashboards
- OTLP-first export with Phoenix as the default UI
- local smoke workflow and dankserver tailnet production deployment
- CLI install, doctor, ingest, label, benchmark, and report workflows

Out of scope for v1:

- product/runtime customer AI analytics
- replacing `@beep/observability` as the runtime observability package
- making `effect/unstable/eventlog` the only deploy-safe raw source of record
- exposing raw prompt or transcript bodies in observability UIs
- public internet access to the metrics stack
- requiring measured provider/gateway token, cost, latency, or tool-call
  metrics before the first seven-day config-impact scorecard is credited

## Architectural Boundaries

`@beep/repo-ai-metrics` owns developer AI analytics language: source
discovery, transcript ingest, redaction results, raw event envelopes, config
snapshots, benchmark cases, outcome labels, scorecards, install specs, and
export adapters.

`@beep/observability` owns general Effect runtime observability: OTLP layers,
metrics, logs, traces, resource attributes, and reusable runtime signal
helpers. This initiative may use it, but must not move developer AI analytics
semantics into it.

`@beep/infra` owns Pulumi deployment orchestration, including real dankserver
remote apply.

`@beep/duckdb` owns the technical DuckDB boundary: native client execution,
transactions, JSON row reads, and Parquet copy mechanics. AI metrics semantics
remain in `@beep/repo-ai-metrics`.

`@beep/repo-cli` owns operator workflows and user-facing command output.
Diagnostic logging remains Effect logging; command results remain `Console`
output.

## Canonical Decisions

- Production target: dankserver tailnet.
- Smoke target: local workstation.
- Backend posture: OTLP-first with Phoenix as the default UI.
- Swappable targets: Langfuse, Opik, PostHog.
- Capture posture: passive-first with optional LiteLLM gateway enrichment.
- Attribution model: config snapshots plus outcome-heavy scorecards.
- Raw data posture: encrypted raw archive plus redacted UI payloads.
- Durable raw spine: JSONL/Parquet archive as deploy-safe source of record,
  with internal EventLog projection proof.
- Benchmark lane: curated cases plus real outcome labels.
- Labeling workflow: CLI review queue.
- Completion evidence: P6a hardening gates, deployed stack, and one restarted
  seven-day real-data scorecard.
- P7 topology posture: decide collection ownership, sync, retention, deletion,
  and restore before adding provider/gateway enrichment or new dashboards.
- P7 production default: hybrid derived mirror. Raw encrypted archives remain
  workstation-local; only sanitized derived/report/status artifacts may sync to
  dankserver.
- Production workstation data root:
  `~/.local/state/beep/ai-metrics`. It is XDG state outside
  every repository, so collection history is independent of checkout choice.
- V1 completion posture: the first production-complete milestone may close
  with provider/model/tool/token/cost metrics explicitly reported as
  unavailable and not scored. Provider/gateway enrichment and dashboard
  expansion remain follow-up P7 work, not blockers for the credited P6
  scorecard.

## Data Products

The primary data product is the weekly config-impact scorecard. It must compare
config snapshots across real sessions and curated benchmark runs.

Minimum scorecard dimensions:

- task success and failure outcome
- quality gate pass/fail state
- human intervention count
- revert or follow-up fix flag
- elapsed cycle time
- model/provider/gateway path
- token and cost metrics when available
- transcript source and agent tool
- primary/subagent source role and hashed parentage when available
- config snapshot hash, included paths, and actual changed paths

A weekly report is completion-creditable only when it has at least one real
outcome label and at least one benchmark run linked to the scored config
snapshot. Model-call, tool-invocation, token, latency, and cost fields may be
reported as unavailable/not-scored until a real provider/gateway source is
integrated, but they must not be silently treated as measured values.

## Privacy Contract

Raw transcripts and provider payloads are private. They may be retained only in
the encrypted raw archive under the selected target data root. Derived tables,
OTLP payloads, and dashboard events must use redacted text, hashed identifiers,
bounded low-cardinality attributes, and explicit allowlists.

Derived metadata is part of the privacy boundary. Session ids, parent thread
ids, fork ids, local paths, source paths, agent roles/nicknames, raw event ids,
timestamps, tool names, labels, and exception text must be explicitly reviewed
before entering derived DuckDB, Parquet, OTLP, or report payloads. P6a derived
attribution preserves source role and hash-only parentage for Codex subagents;
raw transcript bodies and raw local paths remain excluded from derived outputs.

The default privacy mode is `encrypted_raw_redacted_ui`.

Raw archive encryption uses a separate key contract from private identifier
hashing. Install and IaC plans refer to `rawArchiveKeySecretRef`; P2 runtime
commands consume the actual 32-byte base64 key from
`BEEP_AI_METRICS_RAW_ARCHIVE_KEY` and do not resolve secret-manager references
themselves.

P7 remote mirrors are inside the same privacy contract. Synced bundles may
contain only sanitized manifests, status artifacts, reports, and Parquet
exports from an explicit allowlist of derived tables. They must exclude raw
archive tables, transcript bodies, prompt/output text, local repo or home
paths, source paths, archive paths, DuckDB file paths, and encryption
material.

The V1 mirror implementation syncs the bundle manifest, mirror status, and
allowlisted Parquet tables. It does not copy the workstation's Markdown/JSON
report files; the corresponding sanitized scorecard rows are included in the
`ai_metrics_scorecards` Parquet export.

## Deployment Contract

The local target must support repeatable smoke tests without a remote host.

The dankserver target must use Pulumi remote apply from `@beep/infra` to
install and verify required services, storage directories, tailnet-only access,
OTLP endpoints, Phoenix, and health checks. The first deployable P5b slice is
Phoenix-only on the dedicated tailnet URL
`https://dankserver.tailc7c348.ts.net:8447`; optional LiteLLM gateway
enrichment is deferred until after Phoenix is live.

Manual host commands may appear as debugging aids but must not be the final
deployment mechanism.

Live collection is workstation-owned because Codex and Claude raw sources live
on the workstation. The production user timer uses a lock, retry/backoff,
status artifact, and journal evidence. Its code currently executes from the
clean `beep-effect` checkout, while every durable artifact is rooted at the XDG
state path above. Changing checkouts therefore cannot fragment or hide the
production data set.
Server-owned collection is a P7 topology target and requires a separate
transcript access/sync and privacy design.

The current P7 default remote mirror root is
`/srv/data/ai-metrics/p7-derived-mirror`. P7e uses the explicit-confirmation CLI
workflow to build from the XDG data root, sync that sanitized bundle, and read
the remote manifest back as status proof.

## Completion Criteria

The initiative is complete only when:

- `beep-cli ai-metrics install doctor --target dankserver` passes
- Pulumi preview and apply succeed for the dankserver target
- P6a source-aware collection, subagent attribution, scorecard readiness,
  config diffs, metadata allowlist, and archive drill gates pass
- live collection is owned by the workstation timer for the restarted seven-day
  proof and populates raw and derived storage
- Phoenix or the selected default UI shows real data
- source discovery covers Codex and proves Claude Code/OpenClaw adapter
  visibility, while optional gateway/provider measured metrics either populate
  real rows or remain explicit unavailable/not-scored follow-up gaps
- the CLI label queue can record real outcome labels
- benchmark runs are linked to config snapshots
- a restarted seven-day weekly report exists in derived storage and as a
  readable output, with labels and benchmark evidence sufficient for completion
  credit
- a sanitized derived mirror is built and confirmed on dankserver after the
  credited proof report, without syncing raw transcript archives

V1 completion evidence is recorded in
[history/outputs/p7e-production-readiness-closeout.md](./history/outputs/p7e-production-readiness-closeout.md).
P7c provider/gateway enrichment and P7d dashboard/backend expansion remain
separate non-blocking follow-up work.
