# Prior-Art Distillation — agent-effectiveness lineage

> Provenance: pre-exploration codex lane (GPT-5.6 Sol, medium effort,
> read-only), 2026-07-13. Inputs: goals/ai-metrics-stack,
> goals/agent-effectiveness-loop, goals/agent-effectiveness-phoenix-enrichment,
> goals/agent-effectiveness-workflow-integration, goals/agent-pipeline-velocity,
> goals/yeet-agent-ergonomics, explorations/agent-pipeline-velocity.

## 1. Decisions already made

- Privacy is fixed: raw transcripts/provider payloads remain private and
  encrypted; derived tables, OTLP, dashboards, and reports require redacted
  text, hashed identifiers, bounded attributes, and explicit allowlists.
  Metadata — including paths, IDs, timestamps, tool names, labels, and
  exception text — is itself inside the privacy boundary. Remote mirrors must
  exclude transcript bodies, local paths, raw-archive tables, and encryption
  material. (`goals/ai-metrics-stack/SPEC.md:125-152`)
- Deployment is local-workstation collection plus a dankserver tailnet
  production surface: OTLP-first, Phoenix-default, with a hybrid derived
  mirror. Raw archives stay workstation-local; only allowlisted sanitized
  derived/report/status artifacts may sync.
  (`goals/ai-metrics-stack/SPEC.md:75-99`;
  `goals/ai-metrics-stack/history/outputs/p7-topology-first-production-plan.md:33-68`)
- Analytics semantics belong in `@beep/repo-ai-metrics`, operator workflows in
  `@beep/repo-cli`, generic telemetry in `@beep/observability`, deployment in
  `@beep/infra`, and DuckDB mechanics in `@beep/duckdb`.
  (`goals/ai-metrics-stack/SPEC.md:52-73`)
- The scoring model is outcome-heavy, comparing config snapshots using
  success, quality gates, interventions, follow-up fixes, cycle time,
  source/agent, and available provider/model/token/cost data. A scorecard is
  completion-creditable only with at least one real outcome label and one
  linked benchmark run; unavailable model/tool/token/cost fields must be
  explicit, never treated as measured.
  (`goals/ai-metrics-stack/SPEC.md:101-123`)
- Phase 1 established a local, report-only trust gate before Phoenix
  mutation. Missing optional evidence is represented as `unavailable`; live
  sync remains dry-run by default and confirmation-gated.
  (`goals/agent-effectiveness-loop/SPEC.md:119-141,158-172`)
- Agent-pipeline-velocity already committed to single-sourced agent laws,
  progressive-disclosure skills, a permission allowlist, greptile-only default
  review, read-only PR cache, measured-before-change pipeline optimization,
  and local/hosted proof parity. These are shipped interventions to evaluate,
  not proposals to rediscover.
  (`goals/agent-pipeline-velocity/README.md:11-17,47-58`)

## 2. What was deliberately deferred and why

- **P7c provider/gateway metrics:** deferred until real — not synthetic —
  model-call and tool-invocation rows can prove privacy, attribution,
  low-cardinality identifiers, and measured-versus-unavailable reporting.
  Candidate sources include xAI, Venice, LiteLLM, OpenClaw, and backend APIs.
  (`goals/ai-metrics-stack/history/outputs/p7-topology-first-production-plan.md:161-183`)
- **P7d dashboard/backend expansion:** deferred until a second backend has a
  specific job that OTLP, static reports, or install configuration cannot
  satisfy, plus redacted-payload proof and a reproducible operator/infra
  path. Phoenix remains the default.
  (`goals/ai-metrics-stack/history/outputs/p7-topology-first-production-plan.md:185-203`)
- **P7e production closeout:** waits for the final credited seven-day report,
  then a confirmed sanitized mirror sync/status check on dankserver. It is
  V1-blocking; P7c/d are not.
  (`goals/ai-metrics-stack/ops/manifest.json:137-173`) No separate P7c, P7d,
  or P7e output files exist in the packet inventory; the manifest points all
  three to `p7-topology-first-production-plan.md`.
- **Phoenix enrichment lane:** Phase 1 deliberately stopped short of live
  mutation, prompt management, experiment automation, and broader enrichment.
  The proposed next evidence was one narrow artifact with exact payload
  privacy checks, confirmation gating, and readback or rollback proof.
  (`goals/agent-effectiveness-loop/history/outputs/phase1-closeout.md:14-23`;
  `goals/agent-effectiveness-phoenix-enrichment/SPEC.md:29-47`)
- **Workflow lane:** automation was deferred until a manual workflow had a
  deterministic evidence source, explicit unavailable/blocked behavior, and
  demonstrated usefulness and repeatability; operator-visible
  commands/runbooks were preferred before CI enforcement.
  (`goals/agent-effectiveness-workflow-integration/README.md:21-25`;
  `goals/agent-effectiveness-workflow-integration/PLAN.md:3-26`)
- **Status caveat:** the enrichment/workflow prose still says "Pending
  planning," but both manifests were updated to `superseded` by
  agent-pipeline-velocity; the surviving enrichment direction is a scored
  repo-task/SkillOpt successor.
  (`goals/agent-effectiveness-phoenix-enrichment/README.md:3-5`;
  `goals/agent-effectiveness-phoenix-enrichment/ops/manifest.json:3-13`;
  `goals/agent-effectiveness-workflow-integration/ops/manifest.json:3-13`)

## 3. Known velocity, bottleneck, and ergonomics findings

- The original baseline found asymmetric Claude/Codex rules, 142 KB of nested
  instructions, 533 KB of skills, no hooks/allowlist, turbo concurrency fixed
  at 3, cold PR cache, duplicate clones, and overlapping review gates.
  (`explorations/agent-pipeline-velocity/BRIEF.md:5-21`;
  `explorations/agent-pipeline-velocity/RESEARCH.md:80-101`)
- Instruction surgery found 77 real nested files plus 53 symlinks, about
  12,000 recoverable tokens, stale guides, template-driven regrowth, and
  skill-registration/locking bugs.
  (`explorations/agent-pipeline-velocity/RESEARCH.md:124-138`)
- Higher turbo task concurrency was not the answer: forced-cold `check` was
  25.0s at concurrency 3 versus 27.3s at 16, with 70% more user time.
  Structural lane concurrency was effective: lint-policy fell from 142.4s
  sequential-equivalent to 32.3s wall time, a 4.4x improvement.
  (`goals/agent-pipeline-velocity/history/rqt-ledger.md:17-26,37-49`)
- Full Yeet baselines were 14m05s cold and 7m42s warm; direct pre-push was
  6m54s. Per-step instrumentation exposed roughly 4.5 minutes of previously
  dark sequential non-turbo work.
  (`goals/agent-pipeline-velocity/history/rqt-ledger.md:3-6,28-35`)
- Yeet ergonomics came from a real merge session: ~20 minutes lost to
  untracked-file refusal/stash conflict; stale-base overlap forced a
  mid-flight rebase; a 35k-line log required grep-mining; PR creation, thread
  mutation, and stale-lock cleanup were manual.
  (`goals/yeet-agent-ergonomics/research/session-findings.md:7-23`)
- Those problems were addressed with staged-only publishing, base-freshness
  checks, packetized failures, always-written verdicts, PR creation, explicit
  thread write-backs, stale-lock healing, and dependency-sensitive cache
  forcing. (`goals/yeet-agent-ergonomics/SPEC.md:44-155`)
- Known residue remains: verdict remediation hints can misattribute the
  failing sub-lane, accepted-proof fixture deletion lacks a machine guard,
  and an exact "rerun failed steps" command is absent.
  (`goals/agent-pipeline-velocity/history/rqt-ledger.md:53-61`;
  `goals/agent-pipeline-velocity/history/reflections/2026-07-05-claude.md:10-35,45-50`)

## 4. Open questions the pulse could answer

- Which skills are actually invoked, on which task classes, and with what
  marginal outcome or token effect? Existing scorecard dimensions cover
  agent/source/config/provider but do not name skill invocation as a
  first-class dimension. (`goals/ai-metrics-stack/SPEC.md:106-118`)
- Did the shipped context reduction, law single-sourcing, hooks, cache
  policy, review consolidation, and lint concurrency improve current
  time-to-mergeable, intervention count, follow-up fixes, and token spend
  beyond their implementation-time measurements?
  (`goals/agent-pipeline-velocity/README.md:47-58`)
- What now dominates merge latency after lint-policy acceleration: proof
  execution, flaky integration lanes, hosted queues, review churn, rework, or
  diagnosis? Prior work measured individual lanes but did not publish a
  post-merge end-to-end pulse.
  (`goals/agent-pipeline-velocity/history/rqt-ledger.md:37-49,63-70`)
- How representative is current evidence across agents? The credited recent
  window was Codex-only, while Claude and OpenClaw were merely
  adapter-visible outside that window.
  (`goals/ai-metrics-stack/history/outputs/p6-proof-runner-isolation-and-runbook.md:82-98`)
- Can human labels be collected consistently enough to support comparisons,
  and which benchmark cases predict real merge outcomes? Labels require
  explicit human judgment, while completion requires both labels and
  benchmarks.
  (`goals/ai-metrics-stack/history/outputs/p6-pre-may16-readiness-ledger.md:92-145`)

## 5. Traps and gotchas

- Never disturb a credited proof window: changing runner, source window,
  privacy contract, timer cadence, or data root restarts the clock. Outcome
  labels require explicit human judgment.
  (`goals/ai-metrics-stack/history/outputs/p6-pre-may16-readiness-ledger.md:13-20`)
- DuckDB-backed metrics commands against one local database must run
  serially.
  (`goals/ai-metrics-stack/history/outputs/p6-proof-runner-isolation-and-runbook.md:132-139`)
- An empty Phoenix root-span view does not prove collection stopped;
  corroborate forwarder status, derived counts, Parquet output, and project
  trace counts.
  (`goals/ai-metrics-stack/history/outputs/p6-proof-runner-isolation-and-runbook.md:63-80`)
- The active scorecard reached `completionReady=true`, but model/tool/cost
  data remained unavailable, and earlier snapshots lacked labels or
  benchmarks. Do not equate readiness with full telemetry coverage.
  (`goals/ai-metrics-stack/history/outputs/p6-pre-may16-readiness-ledger.md:365-373`)
- Measure before tuning concurrency; internally parallel tools can make
  higher task concurrency slower.
  (`goals/agent-pipeline-velocity/history/rqt-ledger.md:17-26`)
- Trust actual runner step labels over routed repair hints; tail-window
  needle matching has produced false remediation attribution.
  (`goals/yeet-agent-ergonomics/research/grounding.md:36-49`)

## 6. Recommended seams

- The new pulse should own a bounded, read-only observational baseline:
  skill-use incidence, agent/source coverage, token availability, phase
  wall-times, diagnosis/rework, intervention counts, and commit-to-mergeable
  timing — using existing scorecards, Yeet verdicts/timings, and sanitized
  artifacts. (`goals/ai-metrics-stack/SPEC.md:101-123`;
  `goals/yeet-agent-ergonomics/SPEC.md:94-104`)
- It should evaluate shipped interventions and identify evidence gaps, not
  redesign telemetry topology, Phoenix payloads, CI enforcement, or Yeet
  behavior during exploration. Phase 1 explicitly established
  research/report-only and no-mutation boundaries.
  (`goals/agent-effectiveness-loop/SPEC.md:106-129`)
- Delegate provider/model/tool/token/cost acquisition and attribution to
  P7c's contract; delegate any new backend/dashboard to P7d; delegate final
  production mirror closeout to P7e.
  (`goals/ai-metrics-stack/history/outputs/p7-topology-first-production-plan.md:161-225`)
- Treat the superseded enrichment packet as a capability specification, not
  an active goal: graduate a separate scored repo-task eval/SkillOpt packet
  only if the pulse shows sufficient labels and repeatable task cases.
  (`goals/agent-effectiveness-phoenix-enrichment/ops/manifest.json:11-33`;
  `explorations/agent-pipeline-velocity/DECISIONS.md:98-104`)
- Likewise, graduate workflow automation only after the pulse identifies one
  useful manual recurring report with deterministic inputs and explicit no-op
  behavior; do not revive the stale pending-planning packet wholesale.
  (`goals/agent-effectiveness-workflow-integration/SPEC.md:29-45`)
