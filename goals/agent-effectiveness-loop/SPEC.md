# Agent Effectiveness Loop Spec

## Status

Lifecycle: `completed-retained`. Delivered scope: Phase 0 research and Phase 1
implementation (merged 2026-05-20, PR #167 and PR #168). This spec is the
retained normative contract for that scope; it is not a live execution target.

- **Created:** 2026-05-16
- **Updated:** 2026-10-05 (format alignment and staleness audit; no scope change)
- **Owner:** @beep-team

## Objective

A repo-specific feedback loop for improving coding-agent effectiveness that
uses Phoenix capabilities, existing AI metrics artifacts, and read-only
worker-eval evidence to answer:

- where do coding agents struggle in this repo?
- which repo guidance, config, prompt, or workflow changes improve outcomes?
- which evals and scorecards should be repeatable before changing agent
  configs or graduating worker automation?
- which operator commands make those insights easy to collect and review?

Observable result: a report-only trust gate (`doctor`), a privacy-checked
annotation plan and check, deterministic Phoenix bundle builders, and a
confirmation-gated Phoenix sync, all under `beep agent-effectiveness`.

## Non-Goals

- Using live Phoenix mutation as required Phase 1 closeout proof.
- Moving developer AI analytics semantics out of tooling packages (into shared
  kernel, product slices, generic foundation packages, or runtime
  observability).
- Syncing raw transcripts or private paths into research artifacts.
- Graduating worker auto-remediation from read-only evidence.
- Phoenix-native enrichment (datasets, experiments, evals on traces,
  prompt/config comparison) and repo workflow integration. These were the
  deferred Phase 2/3 tranches; see Successor Packets.
- Reopening this packet. Retained as evidence and reusable bricks only.

## Source Hierarchy

1. User objective that created this packet (2026-05-16).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing standards: `standards/ARCHITECTURE.md`,
   `standards/architecture/07-non-slice-families.md`,
   `standards/architecture/08-testing.md`,
   `standards/architecture/12-observability.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict. There is no `GOAL.md`
launcher; the packet is not execution-capable.

## Inputs

Required repo packets:

- `goals/ai-metrics-stack/{README.md,SPEC.md,PLAN.md,ops/manifest.json}` and
  `goals/ai-metrics-stack/history/outputs/*` (privacy-safe transcript
  ingestion, config snapshots, labels, benchmarks, scorecards, OTLP export,
  and the live Phoenix deployment on dankserver).
- `goals/jsdoc-worker-eval/{README.md,SPEC.md,PLAN.md,ops/manifest.json}`,
  `goals/jsdoc-worker-eval/research/*`, and
  `goals/jsdoc-worker-eval/history/outputs/*` (read-only JSDoc worker-eval
  orchestration and sanitized Phoenix spans for `beep-jsdoc-worker-eval`).

Required Phoenix sources:

- Phoenix docs index: <https://arize.com/docs/phoenix/llms.txt>
- Live read-only Phoenix instance:
  <https://dankserver.tailc7c348.ts.net:8447/projects>

## Target Surfaces

- `@beep/repo-ai-metrics` (`packages/tooling/library/ai-metrics`): report
  schemas, doctor evidence aggregation, annotation-plan construction,
  annotation privacy checks.
- `@beep/repo-cli` (`packages/tooling/tool/cli/src/commands/AgentEffectiveness`):
  the `beep agent-effectiveness ...` operator commands and terminal/JSON
  rendering.
- This packet's `research/` and `history/` directories.

## Constraints

### Ownership

Agent effectiveness metrics are repo-operational tooling.

- `@beep/repo-ai-metrics` owns developer AI analytics semantics.
- `@beep/repo-cli` owns operator commands and user-facing workflows.
- `@beep/observability` owns general runtime OTLP, metrics, logs, traces, and
  reusable observability helpers.
- `@beep/infra` owns deployable topology and dankserver automation.
- Backend-specific `drivers/*` are allowed only when a real Phoenix or
  alternate-backend API wrapper is needed beyond OTLP/export/install contracts.

### Privacy contract

Research and history artifacts may include sanitized evidence only: project
names, aggregate counts, feature availability, schema/attribute/command names,
hashed identifiers already accepted by the AI metrics privacy contract, and
links to repo artifacts and public documentation.

They must not include raw prompt, response, transcript, or tool payload text;
private local, home, source, or archive paths; secrets, tokens, resolved
1Password references, or encryption material; raw Phoenix span payload bodies;
or unreviewed exception text that could contain private content.

Annotation plans are metadata-only: source coverage, scorecard, label,
benchmark, worker-eval, and loop-health metadata, never raw transcript bodies,
private paths, secrets, draft JSDoc bodies, or code examples.

### Phoenix access

Live Phoenix access is read-only by default. The sync command defaults to
dry-run and requires an explicit confirmation token before any Phoenix write.
Research bootstrap must not mutate projects, datasets, experiments, prompts,
annotations, traces, or server configuration.

### Report-only posture

Reports use report-only statuses. Missing Phoenix, missing local DuckDB
evidence, or missing worker-eval reports are represented as `unavailable`
data, not as blocking process failures. Encoding failures remain typed
command failures.

### Defaults

- Phoenix target: `https://dankserver.tailc7c348.ts.net:8447`
  (`defaultAgentEffectivenessPhoenixBaseUrl` in the command module).
- Local metrics root: `.beep/ai-metrics`.
- Worker-eval evidence: the 2026-05-16 Runpod/Ollama Qwen3-Coder 30B packet
  under `goals/jsdoc-worker-eval/history/outputs/`.

## Research Lanes (Phase 0)

Four artifact-producing lanes, each writing one Markdown file under
`research/`, plus a synthesis:

1. **Phoenix capability map** - Phoenix feature inventory mapped to
   coding-agent improvement opportunities.
2. **Live Phoenix state audit** - sanitized read-only evidence from the
   deployed instance and existing projects.
3. **Repo eval and metrics surface audit** - existing repo commands,
   artifacts, privacy rules, and data products.
4. **Agent-effectiveness opportunity map** - ranked candidate evals,
   diagnostics, datasets, annotations, scorecards, and future CLI workflows.
5. **Synthesis and ranked execution plan** - ranks first slices by impact,
   effort, privacy risk, architecture home, and verification burden, and
   chooses one recommended first path.

## Selected Phase 1 Slice

Local and no-mutation first:

- `beep agent-effectiveness doctor --json`
- `beep agent-effectiveness annotations plan --json`
- `beep agent-effectiveness annotations check --json`

Phase 1B landed guarded Phoenix sync plumbing in the same closeout:

- `beep agent-effectiveness datasets bundle --json`
- `beep agent-effectiveness prompts bundle --json`
- `beep agent-effectiveness experiments bundle --json`
- `beep agent-effectiveness phoenix sync --json`

The `evals` subcommand that now also lives under `beep agent-effectiveness`
was added by `skillopt-training-pilot` (PR #309) and `harness-evidence-ledger`
(PR #1362) and is governed by those packets, not this spec.

## Acceptance Criteria

Phase 0:

- [x] All five research artifacts exist and cite their repo or public-doc
      sources.
- [x] Live Phoenix evidence is sanitized and read-only.
- [x] The synthesis ranks first slices and chooses one recommended path.
- [x] No production package, infra, timer, deployment, or agent config
      behavior changed during research bootstrap.

Phase 1:

- [x] The doctor, annotation plan, and annotation check commands exist, are
      report-only, and represent missing providers as `unavailable`.
- [x] Annotation privacy checks pass on the generated plan.
- [x] Phoenix inventory decodes and passes in the live read-only proof; the
      overall doctor may remain `warning` when optional local evidence is
      unavailable.
- [x] Bundle commands are deterministic; sync is dry-run by default with an
      explicit confirmation gate.
- [x] Work shipped as PRs driven to mergeable (PR #167, PR #168) with review
      threads resolved and hosted CI green.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Manifest JSON | `jq . goals/agent-effectiveness-loop/ops/manifest.json` | Passes |
| Packet references | `rg -n "agent-effectiveness-loop\|packetAnchorDocument\|executionCapable" goals/agent-effectiveness-loop` | Hits in manifest and docs |
| Whitespace | `git diff --check -- goals/agent-effectiveness-loop` | Passes |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |
| Packet consistency | `bun run beep goals doctor` | No new blocking findings |
| Live read-only proof | `history/outputs/phase1-live-proof.md` | Phoenix inventory passes; privacy checks pass |
| Merge evidence | `history/outputs/phase1-closeout.md` | PR #167 and PR #168 merged, CI green |
| Command surface still present | `bun run beep agent-effectiveness --help` | Lists doctor, annotations, datasets, prompts, experiments, phoenix |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (any Phase 2/3 tranche).
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec (in particular, any live Phoenix write).
- The same blocker repeats after reasonable investigation.

## Successor Packets

- `goals/agent-pipeline-velocity` (`completed-retained`, PR #295, 2026-07-06)
  superseded the two follow-up packets split from this one
  (`agent-effectiveness-phoenix-enrichment`,
  `agent-effectiveness-workflow-integration`, both deleted in PR #401 on
  2026-07-14). Absorbed constraints:
  `goals/agent-pipeline-velocity/history/absorbed-constraints.md`.
- `goals/coding-agent-effectiveness-evidence-loop` (`active`) is the current
  home for coding-agent effectiveness measurement; it lists this packet as
  retained evidence it will not reopen.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| No `GOAL.md` launcher | This packet | @beep-team | Delivered scope is closed and merged; the packet is retained evidence, not an execution target (`executionCapable: false`). | Never; a revival is a new packet. |
| Local docgen skipped in the PR #168 follow-up loop | PR #168 | @beep-team | Hosted CI docgen passed on the final head and supplied the proof. | N/A (closed). |
