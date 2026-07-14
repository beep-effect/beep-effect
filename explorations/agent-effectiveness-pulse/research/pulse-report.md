# Agent Effectiveness Pulse Report

> Synthesized 2026-07-14 from the five lane reports in `research/pulse/`
> (skill-usage, token-spend, time-sinks, bottlenecks, pr-cycle) plus the
> Phase-1 pipeline revival. Every number below traces to a reproducible
> command in its lane report. Fleet scope: 8 beep-effect checkouts, both
> harnesses, roughly 2026-06-01 → 2026-07-14 (windows vary per lane).

## The four questions, answered

### 1. Which skills are used the most — or never?

Direct Claude `Skill` invocations (194 total) concentrate in the operator
workflow: **grill-with-docs 46, yeet 30, deep-research 17, reflect 15,
codex plugin lanes 25** combined. Codex never emits a native skill event; its
**read-proxy** ranks `effect-first-development` (936), `schema-first-development`
(610), `yeet` (606), `jsdoc-annotation-specialist` (498).

- **Strongly dead (zero signal in either harness): the four ponytail helper
  skills** (`ponytail-audit`, `-debt`, `-gain`, `-help`).
- Proxy-only, never directly invoked: `turborepo` (127 reads, 0 calls),
  `mcp-graphiti-memory` (129/0), `repo-symbol-discovery` (154/0),
  `effect-v4-imports` (79/0) — codex reads these as *reference material*;
  Claude never selects them as skills.
- Usage concentrates 94–99% in the eight main checkouts; worktree project
  dirs contribute noise-level counts.
- H5 verdict (see hypothesis table): supported on direct-invocation evidence,
  refuted on the union measure — the fair statement is "4 dead, 6 more with
  proxy-only signal".

### 2. What takes the majority of time?

**856 agent-active hours** in ~6 weeks (idle gaps >5min removed): **Codex
71.5% (612h), Claude 28.5% (244h)**. The story is the long tail: the two
harness top-deciles hold **67.4% of all active time** (Claude p90 threshold
4.4h/session; Codex 31m). Claude sessions are few and long (p50 23m); codex
sessions are many and short (p50 6m, 8.3× the count). Peak week (Jul 6):
355 active hours — 41.5% of the window. **68.9% of hours sit in the `other`
branch bucket** — session→work attribution is itself a gap.

### 3. What blocks a PR/goal/exploration from mergeable?

The *typical* PR is fast: **median create→merge 52m; 31% under 15m; 94%
under a day** (371 merged PRs). The tail is **parked batches** — the 12
slowest PRs cluster in same-day landings (#351–354 at ~40h on Jul 10;
#176/177 at ~143h) — operator absence, not CI. In yeet telemetry, the
largest *attributed* failure class fleet-wide is **`full:pre-push` (15)**,
but post-Jul-7, **7 of 8 failures are publish-mode with no failed lane at
all** — the live bottleneck is *failure attribution/diagnosability*, not any
measured step. Yeet has no step durations/attempt counts, so time-dominance
can't be computed — the bottleneck lane ships a concrete instrumentation-gap
list (per-step durations, structured failure codes, retry links, PR
lifecycle events).

### 4. What consumes the token spend?

**53.3B recorded tokens in ~1 month**: Codex 54.8% / Claude 45.2%. Largest
cells: gpt-5.5×beep-effect6 (8.3B), opus-4.8 (13.4B total) ahead of fable-5
(10.6B). Projects: beep-effect2 ≥ beep-effect6 ≈ beep-effect — main-repo-only
accounting would miss most spend. **Cache discipline is excellent** (Claude
cache-read ratio 99.92%, Codex 96.6%) — context-economy rules demonstrably
work; volume, not cache misses, is the cost driver. No dollar figures:
marginal cash ≈ $0 on subscriptions; model→SKU mapping too uncertain to fake
precision.

## Hypothesis pass (H1–H9 from the AGENTS.md pre-audit)

| # | Hypothesis (short) | Verdict | Evidence |
|---|---|---|---|
| H1 | Vague laws don't prevent failures; lint gates teach | **needs data** | Requires transcript-exposure × first-failure join; not yet mined. |
| H2 | Misattributed yeet hints cause extra reruns >10% | **reframed & corroborated** | Post-cutoff: 7/8 failures carry NO lane attribution at all (publish-mode). Worse than misattribution — absent attribution. Rerun counting impossible (no attempt fields). |
| H3 | Scoped law sweep cuts verify attempts | **needs data** | Command-chronology mining not yet done. |
| H4 | >10% goal packets phase-stale post-merge | **REFUTED** (2nd pass) | 0/90 stale-active; 3/90 (3.33%) prose/manifest mismatches; every denominator < 10%. Goal hygiene is healthier than the pre-audit implied. See `research/pulse/closeout-hypotheses.md`. |
| H5 | ≥half of 16 "unreferenced" skills never invoked | **split verdict** | 10/15 named have zero *direct* Claude calls (supports); only 4/15 have zero signal incl. codex proxy (refutes). 4 strongly dead. |
| H6 | Skill collisions → multi-skill loading, no gain | **needs data** | Co-invocation matrix not yet built. |
| H7 | Repo-only discovery false-negatives on deps | **needs data** | Transcript search-target mining not yet done. |
| H8 | Unit-green frontend still breaks in browser >15% | **needs data** | No browser-proof dimension exists in any telemetry (itself a finding). |
| H9 | Atomic ship+manifest+reflection kills closeout debt | **PARTIAL** (2nd pass) | 18/47 (38%) closeouts atomic; later-touch debt 2.06 vs 2.38 commits/goal — real but small; "nearly eliminates" unsupported. Frame the same-PR law as agent-requested ergonomics (11 reflections), not measured-drift prevention. See `research/pulse/closeout-hypotheses.md`. |

## Pipeline revival outcomes (Phase 1)

- Root cause of decay: **no systemd timer was ever installed**; collection
  ran only when someone ran it. Claude-source "0 candidates" was a stale
  Jun-8 status (dir born Jun 11) — no code bug.
- **Parquet export is broken** (`forwarder run` fails at derived-storage
  write unless `--parquet-mode none`): suspected regression via the
  `@beep/duckdb` effect-sql rework and/or the 7-13 catalog dep bump; the CLI
  swallows the underlying cause even at `--log-level debug` — a
  diagnosability bug of its own. Filed as improvement candidate.
- **Bulk ingestion is not a supported shape**: the single-transaction derived
  write fails somewhere above ~160MB/run (2,870-file and 300-file/878MB runs
  both failed; ≤157MB batches all passed). Backfill therefore ran as 16
  byte-capped shadow-home symlink batches + 3 probes: **2,924 files /
  ~2.7GB ingested, ~1.0M turns**, each batch transactional (failed runs roll
  back cleanly — verified). The forwarder also has **no
  skip-already-ingested logic** — repeat runs duplicate turns (the DB held
  5.43M rows ≈ 516K distinct events from 1,222 historical trickle runs).
- OTLP re-export: all 19 new ingest runs exported — **1,007,792 spans** to
  Phoenix; project `default` endTime advanced 2026-07-01 →
  **2026-07-14T07:51Z** (dashboard live again).
- Weekly scorecard regenerated: 2,741 tasks in-window under the current
  config snapshot (claude source now covered); cost/model/tool gaps remain
  flagged as designed (P7c).
- **systemd timer installed and enabled** (`beep-ai-metrics-forwarder.timer`,
  6h interval, 50 files/33MiB caps, `--parquet-mode none` until the parquet
  bug is fixed); first run fired immediately and is collecting.

## Improvement candidates surfaced (for align/shape stages)

1. **Yeet verdict instrumentation** — per-step durations, structured failure
   codes, attempt/retry links, PR lifecycle events (bottleneck lane's gap
   list). Directly unblocks H2/H3 and the time-dominance question.
2. **Native harness OTel adoption** — Claude Code + Codex OTLP into the
   existing collector; obsoletes transcript scraping for live metrics
   (landscape lane; both harnesses ship exporters).
3. **Skill inventory hygiene** — retire the 4 dead ponytail helpers;
   consolidate collision clusters; decide whether proxy-only skills
   (turborepo, repo-symbol-discovery) should be skills at all vs docs.
4. **AGENTS.md restructure** — evict volatile state from the cache prefix;
   add the three repeatedly-requested laws (same-PR packet-state flips,
   failure-attribution taxonomy, durable handoffs).
5. **Forwarder durability** — fix parquet export, surface error causes,
   skip-already-ingested (dedup at ingest), timer as default install step.
6. **Replay eval suite (5 tasks)** — causal proof lane for harness changes
   (landscape lane), feeding the config-snapshot scorecard model that
   already exists.
7. **Session→work attribution** — 69% of active hours in `other` branches;
   token spend can't reach task class; both need a session-labeling
   convention (branch discipline or explicit task tags).

## Known limits of this pulse

- Codex "skill usage" is a file-read proxy, not invocation.
- No step-level timing exists anywhere in yeet; PR create→merge conflates
  operator absence with process latency (batch clustering disambiguates
  partially).
- DuckDB numbers pre-backfill carry heavy duplication; always dedup by
  `raw_event_hash`.
- One month of Claude history, six weeks of codex — trends are directional,
  not seasonal.
