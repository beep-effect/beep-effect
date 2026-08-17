# AI Metrics Stack Fresh Review Handoff

## Copy-Paste Prompt For A Fresh Codex Session

You are starting a fresh Codex session in
this `beep-effect` checkout.

Your mission is **not** to continue implementation immediately. Your mission is
to review the AI metrics stack initiative with a fresh set of eyes, find gaps
or caveats that the current plan may be missing, produce a grounded review
report, and then use `$grill-with-docs` with the user to plan the recommended
next steps.

Treat this as an audit of the initiative packet and implementation, not a trust
exercise. Verify claims against the current checkout and live/local evidence
before repeating them.

## Required Startup

1. Read `AGENTS.md`.
2. Use Graphiti memory if available for repo context, but do not rely on memory
   instead of inspecting the checkout.
3. Read the initiative packet:
   - `goals/ai-metrics-stack/SPEC.md`
   - `goals/ai-metrics-stack/PLAN.md`
   - `goals/ai-metrics-stack/README.md`
   - `goals/ai-metrics-stack/ops/manifest.json`
   - `goals/ai-metrics-stack/ops/handoffs/HANDOFF_P0-P6.md`
   - all files under `goals/ai-metrics-stack/history/outputs/`
4. Read the architecture doctrine needed for a repo-native review:
   - `standards/ARCHITECTURE.md`
   - `standards/architecture/README.md`
   - `standards/architecture/GLOSSARY.md`
   - `standards/architecture/DECISIONS.md`
   - `standards/architecture/03-driver-boundaries.md`
   - `standards/architecture/05-layer-composition.md`
   - `standards/architecture/06-configuration-boundaries.md`
   - `standards/architecture/07-non-slice-families.md`
   - `standards/architecture/08-testing.md`
   - `standards/architecture/10-cross-slice-coordination.md`
   - `standards/architecture/12-observability.md`
5. Inspect the implementation surfaces:
   - `packages/tooling/library/ai-metrics`
   - `packages/tooling/tool/cli/src/commands/AIMetrics`
   - `packages/drivers/duckdb`
   - `packages/foundation/capability/observability`
   - `infra/src/AIMetrics.ts`
   - `infra/Pulumi.yaml`

## Review Posture

Be skeptical in the useful way. Assume the initiative is directionally good,
but look for hidden incompleteness before P6 is treated as merely operational.

Do not implement fixes during the first pass. Produce the report first. After
the report, use `$grill-with-docs` to walk the user through whether to continue
as written or introduce new action items before continuing.

For every issue, classify it as one of:

- blocker before P6 completion
- should fix before seven-day proof starts
- should add to P6 hardening
- safe P7 follow-up
- documentation-only drift
- false alarm after inspection

For every finding, include:

- the exact file or command evidence
- what the current plan/spec says or implies
- what the implementation actually does
- why it matters to the data product or operator workflow
- the smallest recommended next step

## Known Suspicions To Verify, Not Accept Blindly

These are examples of caveats found in prior discussion. Re-check them from the
current checkout.

- Codex subagents appear to create their own session JSONL files with
  `session_meta.source.subagent.thread_spawn`, `forked_from_id`,
  `parent_thread_id`, `agent_role`, and `agent_nickname`; the current derived
  tables may flatten them into ordinary Codex sessions instead of preserving
  parent-child attribution.
- Claude Code source discovery and ingest are implemented, but the current
  local `.beep/ai-metrics` proof may contain Codex rows only because recent
  Claude files were outside the default seven-day window.
- The forwarder appears to be a runnable command rather than an always-on
  daemon/timer. Confirm whether "live collection running for seven days" has an
  owned scheduler, service, lock, retry, and observability story.
- Model calls, tool invocations, token counts, costs, and latency tables may be
  present but empty. Confirm which metrics are real, synthetic, unavailable, or
  deferred.
- Outcome labels and benchmark runs may be implemented as CLI workflows but not
  populated for the current proof. Confirm whether scorecard scoring is useful
  before those fields are populated.
- xAI, Venice.ai, LiteLLM, OpenClaw, Langfuse, Opik, and PostHog may be
  represented as contracts or deferred targets rather than real collected data.
- Phoenix may be receiving redacted derived spans, but raw archive, DuckDB, and
  Parquet storage may remain workstation-local. Confirm whether that is the
  intended production topology.
- Pulumi may model the remote Phoenix deployment while live host state was
  applied manually before state reconciliation. Confirm the current state and
  whether the spec makes this gate explicit enough.
- Secret resolution may rely on `op read` in operator commands. Confirm whether
  docs, CLI, and IaC agree on secret references versus runtime secret values.
- Privacy proof may cover prompt/output redaction, but review whether metadata,
  file names, paths, session ids, timestamps, tool names, exception text, or
  labels can leak anything sensitive.
- Backup, restore, retention, archive decrypt, data compaction, and data
  deletion may be under-specified.
- The scorecard may compare config snapshots, but confirm whether it can explain
  causality around changes to `.codex`, `.claude`, `.ai`, `.aiassistant`,
  `AGENTS.md`, and `CLAUDE.md`.
- The current implementation may have a `maxFiles` default that quietly excludes
  older or lower-recency sources. Confirm this is acceptable for proof and
  reporting.

## Minimum Evidence Commands

Run read-only or non-mutating commands first. Prefer additional targeted checks
where useful.

```sh
git status --short --branch
rg -n "ai-metrics|AIMetrics|CodexTranscriptLine|ClaudeTranscriptLine|sourceRole|subagent|forwarder|scorecard|otlp" \
  goals/ai-metrics-stack packages/tooling/library/ai-metrics packages/tooling/tool/cli/src/commands/AIMetrics infra/src
bun run beep ai-metrics sources discover --target local --hash-salt local-smoke --json --max-files 50
bun run beep ai-metrics sources discover --target local --hash-salt local-smoke --json --all --max-files 50
find .beep/ai-metrics -maxdepth 4 -type f | sort
curl -kIs --max-time 10 https://dankserver.tailc7c348.ts.net:8447/ | sed -n '1,12p'
```

If `.beep/ai-metrics/derived/ai-metrics.duckdb` exists, query it with the
repo's `@beep/duckdb` service rather than ad-hoc parsing. Count rows by table
and by `source_kind`. Also check whether any rows can distinguish main Codex
sessions from subagent sessions.

Do not print raw transcript bodies, prompt text, output text, or secret values.

## Report Shape

After inspection, provide the user a concise Markdown report with:

1. **Verdict** - whether the initiative should continue as written, pause for
   gap fixes, or split out a hardening phase before continuing.
2. **Confirmed Current State** - what is definitely working.
3. **Findings** - ordered by severity, with file/command evidence.
4. **Missing Metrics Or Blind Spots** - what data we still cannot answer.
5. **Architecture/Doctrine Fit** - whether package boundaries, drivers,
   observability, config, and deployment ownership match repo doctrine.
6. **Recommended Next Actions** - grouped into immediate, P6, and P7.
7. **Questions For Grill Session** - the branch-closing questions to ask next.

Do not bury serious issues in a summary. Findings first if there are blockers.

## Grill-With-Docs Follow-Up

After the report, explicitly switch into `$grill-with-docs`.

Use the skill exactly as intended:

- Ask one branch-closing question at a time.
- Explore code and architecture docs before asking any question that can be
  answered locally.
- Provide your recommended answer with each question.
- Challenge vague words such as `collector`, `source`, `provider`, `metrics`,
  `thread`, `session`, `raw`, `derived`, `dashboard`, `production`, and
  `deployment`.
- Decide whether each recommended action is:
  - an amendment to P6,
  - a new P6a hardening subphase,
  - a P7 follow-up,
  - or a spec/doc clarification only.

When the grill session settles decisions, update only the owning initiative
docs or architecture docs. For initiative-level action items, prefer updating:

- `goals/ai-metrics-stack/SPEC.md`
- `goals/ai-metrics-stack/PLAN.md`
- `goals/ai-metrics-stack/ops/manifest.json`
- a new `goals/ai-metrics-stack/history/outputs/...` report

Do not make implementation changes until the user explicitly says to implement
the resulting plan.

## Done Criteria For This Fresh Review Session

The session is done when:

- the review report has been given to the user,
- `$grill-with-docs` has been used to decide the next-step shape,
- any accepted planning/doc updates have been made,
- the user knows whether to continue P6 as written or insert new action items
  before continuing,
- and any durable memory summary has been recorded if Graphiti is available.
