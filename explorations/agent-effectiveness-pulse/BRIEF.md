# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

The repo runs on coding agents but can't see itself. The AI-metrics stack
decayed silently for a month (no timer, dead dashboard feed); skill usage,
time sinks, mergeable bottlenecks, and token spend were all unmeasured. The
pulse (2026-07-14, `research/pulse-report.md`) restored the feed and produced
the first evidence-backed picture — and that picture shows: measurement
itself is the bottleneck (yeet failures are 87% unattributed post-Jul-7;
zero step durations anywhere), the harness carries confirmed dead weight
(4 dead skills, volatile state in the permanent cache prefix, 3 missing laws
agents keep requesting), and attribution is broken (69% of agent hours and
all token spend unattributable to task class). Meanwhile both harnesses now
ship native OTel exporters that the stack ignores, scraping transcripts
instead.

## Appetite

Two waves of deliberately small goals — each a days-scale packet, not a
rebuild. Wave 1: two config/docs-weight goals. Wave 2: two instrumentation
goals. The ai-metrics durability fixes ride the existing `ai-metrics-stack`
goal as one phase. Anything that grows beyond that budget gets cut, not
stretched.

## Solution Sketch

**Wave 1 (graduate now):**

- `harness-otel-adoption` — turn on Claude Code + Codex native OTLP
  exporters, routed to dankserver's existing `monitoring_otel_collector`
  (newly tailnet-exposed via a tailscale-serve route, same pattern as
  Phoenix's 8447→6006); the collector fans out traces→Phoenix and
  metrics→`monitoring_prometheus`/`monitoring_grafana`; logs deferred (no
  Loki). *(Amended at shape sign-off 2026-07-14: the "local collector"
  originally cited belongs to trustgraph, not beep — beep owns no local
  collector.)* Content capture OFF (SPEC privacy doctrine). Custom span attributes
  carry repo / branch / goal-slug / task-class — this is also the
  attribution fix. Pin semconv versions; translate into beep-owned stable
  names before anything downstream depends on them. Validate coverage
  against local transcripts for each execution mode actually used here.
- `harness-hygiene-mechanical` — delete the four zero-signal skills
  (`ponytail-audit/-debt/-gain/-help`); evict volatile operational state
  from `AGENTS.md` (memory-migration dates, Graphiti schedule → pointers to
  owned surfaces); add the three repeatedly-requested laws (same-PR
  packet-state flips, failure-attribution taxonomy for verification reds,
  durable on-disk handoffs). No law deletions, no skill consolidations —
  those wait for evidence (H1) or the replay suite.

**Rides `ai-metrics-stack` (new durability phase, tied to P7e):** parquet
export regression fix (P7e's mirror depends on it), error-cause surfacing
(today the CLI swallows causes even at debug), ingest-time dedup /
skip-already-ingested, chunked bulk writes (~160MB single-transaction
ceiling found during backfill).

**Wave 2 (named in MAP, graduate after wave 1):**

- `yeet-verdict-instrumentation` — per-step durations, structured failure
  codes, attempt/retry links, PR lifecycle events (spec seed: the
  instrumentation-gap list in `research/pulse/bottlenecks.md`). Unblocks
  H1/H2/H3 and the time-dominance question.
- `repo-replay-evals` — five historical merged fixes as executable replay
  tasks, deterministic grading via existing quality gates, repeated trials;
  extends `ai_metrics_benchmark_*` tables. Becomes the gate for future
  harness-law changes.

## Rabbit Holes

- Parquet root cause is unconfirmed (effect-sql rework vs 2026-07-13 dep
  bump) — time-box the diagnosis; if deep, pin the dep and move on.
- OTel GenAI semconv is development-stage with breaking changes — pin
  emitted versions, own the stable schema; do not let upstream names leak
  into scorecards.
- Codex OTel coverage has had command-specific gaps — verify per execution
  mode before trusting completeness.
- Timer/env-file secret handling (`~/.config/beep/ai-metrics.env`) must not
  regress when OTel config lands beside it.
- Dual ingestion (native OTel + transcript pipeline) must not double-count
  in scorecards — decide the precedence rule early in the OTel goal.

## No-Gos

- No new observability backend (Phoenix stays; Langfuse/Weave are WATCH).
- No transcript/prompt content in OTLP exports (privacy contract).
- No law deletions or skill consolidations without H1 evidence or replay
  gating.
- No Harbor / eval-platform adoption; replay suite stays custom and small.
- No redesign of the privacy pipeline, Phoenix payloads, CI enforcement, or
  yeet behavior beyond the named instrumentation fields.
- No branch-discipline law for attribution (OTel attributes own it).
