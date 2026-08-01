# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-07-14 — packet-vs-prior-art

**Question:** How should this work relate to the substantial prior art
(`ai-metrics-stack` Active at P7, `agent-effectiveness-loop` Phase 1
complete, enrichment/workflow lanes manifest-superseded,
`agent-pipeline-velocity` and `yeet-agent-ergonomics` completed-retained)?

**Answer:** New pulse exploration packet (this one) that synthesizes,
revives the pipeline, mines evidence, and at graduation decides whether to
cut fresh successor goals — linking to prior art, never re-litigating it.

**Rationale:** Recommended over (a) skipping exploration and directly
planning the pending goals — rejected because those manifests turned out to
be `superseded`, and (b) folding into ai-metrics-stack P7c/d/e — rejected
because the pulse's core questions (skill usage, time sinks, bottlenecks)
are broader than the deferred provider-metrics/dashboard lanes and skill
invocation is not a scorecard dimension anywhere in that packet.

## 2026-07-14 — pipeline-revival-depth

**Question:** How deep should the stalled-pipeline revival go (raw capture
stopped Jun 8, DuckDB Jun 15, last Phoenix trace Jul 1, claude source never
captured)?

**Answer:** Durable revival: backfill codex+claude with `--all` and a raised
`--max-files`, re-export OTLP to Phoenix, regenerate the weekly scorecard,
and install the existing systemd forwarder timer so collection stops
decaying.

**Rationale:** One-off refresh and mine-raw-directly were rejected: the
pulse needs fresh data anyway, the root cause turned out to be "nobody ran
it since June" (no code fix), and without the timer the same decay recurs.
Constraint honored: check proof-window state before changing timer cadence.

## 2026-07-14 — mining-scope

**Question:** Mine the main repo only, or the whole fleet (~9 beep-effect
clones, 550MB+ combined `.beep`, ~1.3GB claude transcripts across clone
project dirs, 8GB codex sessions)?

**Answer:** Whole fleet.

**Rationale:** Work is spread across clones (all 7 siblings have yeet runs;
claude project dirs exist per clone); main-repo-only numbers would
misrepresent skill usage and bottlenecks. Cost is bounded by tested
streaming extractors.

## 2026-07-14 — subagent-economy

**Question:** Which model runs the heavy subagent lanes?

**Answer:** Codex GPT-5.6 Sol at medium reasoning effort via the codex
plugin; cheap Claude (haiku) agents only for glue. Operator grilling
checkpoints via `/grill-with-docs` after the pulse report and after research
deepening.

**Rationale:** Preserves the operator's Fable 5 weekly limit; codex-rescue
lanes proved effective during pre-exploration (five briefs, all read-only).

## 2026-07-14 — Checkpoint A: forwarder-durability fix routing

**Question:** Who owns the four forwarder defects surfaced by the revival
(parquet-export regression, ~160MB bulk-transaction ceiling, swallowed error
causes, no ingest-time dedup)?

**Answer:** Fold into `goals/ai-metrics-stack` as a new phase tied to P7e
closeout. No new goal.

**Rationale:** ai-metrics-stack owns `@beep/repo-ai-metrics` semantics per
its SPEC, remains Active, and the parquet fix is a P7e prerequisite (the
sanitized mirror is built from parquet exports). Rejected: a fresh
successor goal (two packets co-owning one library) and inline no-ceremony
fixes (loses the P7e linkage and phase evidence).

## 2026-07-14 — Checkpoint A: first graduation wave

**Question:** Native harness OTel adoption vs yeet verdict instrumentation —
which graduates first?

**Answer:** Native OTel first (Claude Code + Codex OTLP exporters into the
existing collector; content capture OFF — doctrine per the ai-metrics SPEC
privacy contract). Yeet instrumentation graduates in wave 2.

**Rationale:** Cheapest signal-per-effort — both harnesses ship exporters;
config-only adoption starts live token/cost/tool telemetry immediately while
the yeet runner work is designed. Rejected: yeet-first (moderate effort,
total telemetry gap can wait one wave) and both-at-once (splits attention
during shaping).

## 2026-07-14 — Checkpoint A: harness hygiene scope

**Question:** How does harness hygiene proceed given the landscape lane says
harness changes should be replay-eval-gated but no replay suite exists?

**Answer:** Mechanical cleanup now (delete the 4 dead ponytail helper
skills; evict volatile state from AGENTS.md's cache prefix; ADD the 3
repeatedly-requested laws — same-PR packet-state flips,
failure-attribution taxonomy, durable handoffs). Law DELETIONS (the
lint-duplicated rules) wait for H1 evidence or the replay suite.

**Rationale:** The mechanical items are no-regret with strong evidence (zero
usage signal; 11/6/10 reflection requests). Rejected: waiting for the replay
suite (blocks cheap wins on unbuilt infrastructure) and full restructure now
(law deletions without evidence contradict the pulse's own method).

## 2026-07-14 — Checkpoint A: session→task attribution

**Question:** How to fix attribution (69% of active hours on non-canonical
branches; token spend can't reach task class)?

**Answer:** Inside the OTel goal via custom span attributes
(repo/branch/goal-slug/task-class) at export time.

**Rationale:** Zero new workflow discipline; Codex supports custom span
attributes and Claude Code exposes session correlation. Rejected: a
branch-discipline law (friction; 'other' includes legitimate main-branch
work) — a soft naming convention may still ride along informally.

## 2026-07-14 — Checkpoint A: second mining pass

**Question:** Do any needs-data hypotheses get a second pass before shaping?

**Answer:** Yes — cheap pass only: H4 (packet staleness) + H9 (atomic
closeout), one codex lane over git/manifests before BRIEF drafting.

**Rationale:** Both are minutes of git/manifest joins and directly inform
the same-PR packet-state-flip law entering the hygiene goal. H1/H3/H6 need
yeet instrumentation; H8 needs a browser-proof dimension — deferred to
wave 2+.

## 2026-07-14 — Checkpoint A: replay eval suite placement

**Question:** Where does the 5-task replay eval suite sit?

**Answer:** Wave 2, alongside yeet instrumentation, extending the existing
`ai_metrics_benchmark_*` tables.

**Rationale:** By wave 2, OTel telemetry enriches replay scoring, and the
benchmark tables are the natural home (extend, not net-new). Rejected:
wave 1 (thin scoring signal) and parking (the causal-proof lane is the
long-term point of the whole exercise).

## 2026-07-14 — Checkpoint A: process + publishing

**Question:** Keep Checkpoint B? When does the packet publish?

**Answer:** Checkpoint B collapsed — BRIEF/MAP review happens
conversationally as the shape-stage sign-off. The packet publishes via yeet
from a feature branch immediately, before graduation.

**Rationale:** The original Phase-3 content dissolved into the graduated
goals (OTel config verification → OTel goal P0; AGENTS.md proposal →
hygiene goal SPEC). Publishing now ends the risk of 20+ uncommitted files
in a worktree the operator edits in parallel. Rejected: single publish at
graduation (longer exposure window).

## 2026-07-14 — Shape sign-off: OTel signal routing

**Question:** Claude Code's primary OTel signal is METRICS (+events), Codex
exports logs/metrics/traces — but Phoenix only ingests traces. Where does
harness telemetry route?

**Answer:** Dankserver collector hub: expose the existing
`monitoring_otel_collector` (otel-contrib 0.154, currently 127.0.0.1:4318)
on the tailnet via a new tailscale-serve route; both harnesses export there;
the collector fans out traces→Phoenix (same host) and
metrics→`monitoring_prometheus`/`monitoring_grafana`. Logs deferred (no
Loki).

**Rationale:** Zero new containers; grafana MCP already points at that
stack. Discovered during grilling: the "local collector" cited in the
original MAP belongs to trustgraph (and the LGTM box to effect-lexical-chat)
— beep owns no collector, so the cite was corrected. Rejected: traces-only
wave 1 (loses the token/cost metrics — the most valuable Claude Code
signal) and a new beep-owned collector (more moving parts for no gain).

## 2026-07-14 — Shape sign-off: graduation vehicle

**Question:** Stack graduation artifacts on PR #398 or ship separately?

**Answer:** Merge #398 once green (operator merges, or agent on explicit
say-so), then graduation ships on a fresh branch from updated main via the
isolated-worktree yeet flow.

**Rationale:** Clean provenance (exploration PR → graduation PR), each
small and reviewable. Rejected: stacking (bigger diff, PR mutates after
checks) and standing autonomous-merge authorization.

## 2026-07-14 — Shape sign-off: session scope

**Question:** Start wave-1 implementation in the same session as graduation?

**Answer:** Graduate only, stop. Wave-1 implementation starts in fresh
sessions via `/goal`.

**Rationale:** Each goal is a reviewable unit; harness edits (AGENTS.md,
skills) deserve unhurried review, not a tail-of-session push. Rejected:
starting hygiene or both goals immediately.

## 2026-07-14 — Shape sign-off: BRIEF/MAP ratified

**Question:** Does the shaped BRIEF/MAP match the operator's picture?

**Answer:** Signed off, with the routing amendment above applied to
BRIEF/MAP. Wave-1 = `harness-otel-adoption` + `harness-hygiene-mechanical`;
wave-2 = `yeet-verdict-instrumentation` + `repo-replay-evals`; forwarder
durability rides `ai-metrics-stack` (P7f, P7e-linked); no-gos as written.

**Rationale:** Explore-skill shape-stage exit condition met (operator
confirmation via grilling). Additional standing constraint recorded at
sign-off: Fable 5 plans/designs/reviews only — all token-heavy lanes run on
codex `gpt-5.6-sol` at `--effort medium` (operator weekly-limit economy);
encoded in both wave-1 GOAL.md/SPEC.md files.

## 2026-07-31 — Wave-2 graduation: single evidence-loop packet (ADHD-amended)

**Question:** Cut wave-2 as the ratified `yeet-verdict-instrumentation` +
`repo-replay-evals` pair, or as one successor packet reflecting the 2026-07
Codex (GPT-5.6 Sol) bottleneck audit and its grill session?

**Answer:** One packet —
[`goals/coding-agent-effectiveness-evidence-loop`](../../goals/coding-agent-effectiveness-evidence-loop/README.md)
— absorbing both proposed splits plus the audit's storage/identity,
telemetry-truth-model, and canary phases. Before packet creation the plan
was amended via a five-frame `/adhd` divergent-ideation run and a two-round
operator interview (all eight amendment groups adopted; five candidate
directions rejected as traps with reasons). Full inventory:
`goals/coding-agent-effectiveness-evidence-loop/research/2026-07-31-adhd-amendments.md`.

**Rationale:** The audit found the split packets' concerns are causally
coupled through one identity/attribution model (a Yeet verdict schema and a
replay-eval corpus both consume the same lifecycle vocabulary and config
fingerprints), so separate packets would re-create the cross-packet
dependency the wave-1 boundary was designed to avoid. Key amendments: a
sequence-break instrument phase (notification hooks measured with raw hook
timestamps, off the telemetry-rebuild critical path), witness flight records
+ coverage attestation as the telemetry-v2 write contract, the Yeet
mistrial/exhibit doctrine with durable per-lane proofs, replay-twice-diff
replacing shadow-write, five evidence-integrity laws (incl. OIP taint
chain-of-custody), and Goodhart guardrails on the canary gate. H8
(browser-proof dimension) is now owned by that packet's portfolio phase.
The wave-1 standing constraint carries forward: Fable plans/designs/reviews;
token-heavy lanes run on codex `gpt-5.6-sol` at `--effort medium`.
