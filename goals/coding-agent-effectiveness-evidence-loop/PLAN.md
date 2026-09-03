# Coding Agent Effectiveness Evidence Loop Plan

## Status

Status: `in-progress` (packet opened 2026-07-31; the P1 log-only baseline
closed, `desktop-ntfy-1` cut over in the implementation checkout, PR #973
merged, and a guarded 19-adopter/3-exclusion direct-clone rollout completed on
2026-09-03 — see
`research/2026-09-03-p1-baseline-close.md` and
`research/2026-09-03-p1-first-treatment-readout.md`)

**Current phases (single authority for `/goal` executors):** P1 is current.
Hook semantics, the production writer, the fixed baseline, notifier/damping
schemas, desktop delivery, the shared circuit breaker, and the first guarded
post-merge rollout slice are complete. The rollout is deliberately staggered:
active, dirty, detached, and feature-branch checkouts were left untouched. The
first sharp `AskUserQuestion` readout is favorable but small and mode-shifted;
phone delivery is not yet observed, so P1's exit criterion is not met.
**P0 is complete (2026-08-07)** — code, atomic store cutover, and live
verification all landed;
evidence in `history/outputs/2026-08-07-p0-cutover.md`. P2–P8 are not current
until the manifest marks their predecessors' exit criteria met; the "proceeds
in parallel" notes below describe scheduling intent between phases, never
permission to start ahead of this section.

Numbering map to the source audit plan (scratch/codex thread + ADHD
amendments): audit P0→P0, P0.5→P1, P1→P2, P1.5→P3, P2→P4, P3→P5, P4→P6,
P5→P7, P6→P8.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Storage cutover + identity registry | complete (2026-08-07) | Clone-independent canonical store, source registry, bounded config snapshots. | Store serves all clones; snapshots have stage timings; nested worktrees are independent roots. Met — see `history/outputs/2026-08-07-p0-cutover.md`. |
| P1 Sequence-break instrument | in-progress (PR merged; guarded fleet rollout completed 2026-09-03) | Hooks + hook-pulse ledger + notifications + circuit breaker + kill switch; first wait reduction measured. | Baseline captured; desktop notifications and breaker live; eight sharp human-input starts produced seven closures, one tombstone, and an early 80.1% median reduction. Fleet disposition is 19 adopters plus 3 explicit protected/archive exclusions. Still requires a phone-delivery receipt. |
| P2 Telemetry-v2 truth model | pending | FlightRecord + IngestManifest write contract with the five evidence-integrity laws. | Schemas land with fixtures; Claude + Codex emitters flowing; tombstones + leases working. |
| P3 Yeet mistrial + proof durability | pending | Exhibit-required verdicts, mistrial outcome, per-lane durable proofs, `yeet doctor`. | Exhibit-less failure undecodable; interrupted publish resumes as cache hit; doctor names blocking edge. |
| P4 Replay, dedup, trust gates | pending | Replay all raw history into v2; replay-twice-diff determinism; gates pass. | Zero duplicate identities; attestation coverage ≥95%; score families replace composite. |
| P5 Assessment + eval corpus | pending | Bottleneck ranking; 12-task held-out corpus with paired repetitions. | Rankings render with denominators; corpus runnable with memory-ablation profile. |
| P6 Effect vs XState spike | pending | Same schemas, two pure reducers; adopt only on demonstrated advantage. | Shadow replay zero-mismatch or XState removed; decision recorded. |
| P7 Dispositioned portfolio | pending | One-variable-at-a-time treatments; every item dispositioned. | All inventory items shipped/deferred/rejected/waived with evidence. |
| P8 Guarded canary + close | pending | One reversible wait treatment in a disposable worktree; closeout. | Paired-trial win with CI excluding zero + Goodhart guardrails green; reflection + status flip in final PR. |

## P0 — Storage cutover and identity registry

**DONE 2026-08-07.** All three bullets shipped and verified live; the atomic
cutover executed with byte-identical census gates. Evidence and the one
residual (the beep-effect clone pulls merged `main` so the timer unit runs
post-P0 code) are in `history/outputs/2026-08-07-p0-cutover.md`.

- Move the canonical store to
  `${XDG_STATE_HOME:-$HOME/.local/state}/beep/ai-metrics`; precedence
  `--data-root` → `BEEP_AI_METRICS_DATA_ROOT` → XDG default. Stop the
  collector, validate source/target and counts, atomically rename the
  ~19.4GB store (same filesystem), update the user service, verify, restart.
  No compatibility symlink; legacy evidence preserved.
- Record clone, repository, worktree, revision, and source-instance
  identities independently of the data root. Registry of canonical roots;
  nested worktrees become independent roots excluded from parent snapshots.
- Replace recursive config scanning with a bounded per-root baseline +
  session-effective config, with explicit snapshot stage timings and
  file/byte budgets (last run: 9,799 files, 9,570 from one nested worktree).
- **Load-bearing risk:** an unverified store post-rename. Stop condition
  applies; never run dual live stores.

## P1 — Sequence-break instrument (audit P0.5)

The headline wait (plan-approval p95 105 min) needs hooks and timestamps,
not the telemetry rebuild. P2–P4 proceed in parallel but are off this
phase's critical path.

- **First step (before any schema): DONE 2026-08-01** — verified on Claude
  Code 2.1.220 across three rounds and seven real sessions; full evidence in
  `research/2026-08-01-p1-hook-semantics-spike.md`, ledger committed at
  `history/evidence/2026-08-01-hook-pulse-spike.ndjson`. All three wait
  classes emit distinguishable sessionId-bearing events, so the load-bearing
  risk is retired. The amendments below are binding on the schema work.
- **Spike amendments (binding):**
  1. The hook set is **seven** events — `PermissionRequest`, `PreToolUse`,
     and `PostToolUse` join Notification / UserPromptSubmit / Stop /
     SessionEnd. **`PermissionRequest` is the wait-start marker**: it fires
     only when a permission dialog is about to show. `PreToolUse` fires
     before *every* tool call including auto-approved ones (measured: `ls`,
     `Write`, and `ToolSearch` each completed `PreToolUse`→`PostToolUse` in
     ≤1s with no `PermissionRequest`), so a `PreToolUse` bracket measures
     execution, not human waiting.
  2. `waitReason` derives from `PermissionRequest.tool_name`
     (`ExitPlanMode` ⇒ plan approval, any other tool ⇒ tool permission),
     never from Notification message text — `notification_type` is
     `permission_prompt` for both. Unmatched shapes yield `unknown`.
  3. **Wait duration subtracts execution time.** The **terminal tool event**
     (`PostToolUse` on success, `PostToolUseFailure` on failure — see
     amendment 8) marks execution completion, not approval, so the true wait
     is `terminal.ts − PermissionRequest.ts − terminal.duration_ms`. Both
     terminal events carry `duration_ms`. Omitting the subtraction
     systematically inflates permission waits by the tool's own runtime.
  4. Wait spans model **open brackets** as first-class state: a rejected
     plan, a denied permission (no `PermissionDenied` observed on 2.1.220),
     or a crash yields a start with no end. An open bracket is closed only
     by its matching decision or terminal evidence and is otherwise
     tombstoned — **never** by "the next event of any kind", which would
     close an 82s approval at the ~6s corroborating Notification.
     Pairing is a **two-hop join**, and it is a strict one-to-one matching,
     not an adjacency heuristic: `PermissionRequest` carries no
     `tool_use_id`, so each one claims the **nearest preceding unpaired**
     `PreToolUse` in the same session with the same `tool_name`, and each
     `PreToolUse` may be claimed at most once. The bracket then closes
     **only** on the **terminal tool event** carrying that exact
     `tool_use_id` — `PostToolUse` *or* `PostToolUseFailure`, whichever the
     harness emits (amendment 8) — and each `tool_use_id` closes at most one
     bracket.
     This is load-bearing because the same tool can be requested repeatedly:
     a denied request stays open forever (no terminal tool event is ever
     emitted for it), so a looser join would let a later attempt's terminal
     event close the earlier open bracket — recording a fabricated multi-minute
     wait, silently swallowing the later real one, and leaving stale
     escalation state. An open bracket is therefore never closed by a
     different attempt's evidence; it is tombstoned at session terminal
     evidence. If no unpaired `PreToolUse` candidate exists, or candidates
     are indistinguishable, the row is quarantined as `unknown` under law 1
     rather than matched by guess.
  5. Lease renewal must not treat `Stop` as a turn boundary — plan-mode
     turns emit no `Stop`, and the 60s idle Notification is Stop-gated, so
     plan-parked sessions are invisible to idle-based detection.
     **Additionally, the idle Notification fires once, not periodically**, so
     a long human wait emits no further events at all: P1 must supply a
     periodic heartbeat or an explicit pending-wait state, or lease TTL will
     tombstone live blocked sessions.
  6. The whitelist projection happens **in the hook writer**: raw payloads
     carry `prompt`, `last_assistant_message`, `tool_input`, and
     `tool_response`, so privacy-by-unrepresentability cannot be a
     downstream filter.
  7. **Every row carries an explicit `schemaVersion` literal.**
     `notifierRev` identifies notifier state, not row layout; without a
     version discriminator a shared append store can hold multiple layouts
     that P4 replay cannot decode or quarantine deterministically.
  8. **A tool call ends in `PostToolUse` *or* `PostToolUseFailure`, never
     both** — added 2026-08-05 from harness 2.1.223, after amendments 1–7
     were ratified against 2.1.220. The success dispatcher emits
     `PostToolUse`; a separate failure dispatcher, invoked from `catch`
     paths and from the branch that builds `tool_result` with
     `is_error: true`, emits `PostToolUseFailure` with
     `{tool_name, tool_use_id, error, is_interrupt, duration_ms}`.
     Amendments 3 and 4 above are corrected accordingly: the bracket closes
     on the **terminal tool event**, not on `PostToolUse` specifically.
     This is load-bearing and not an edge case. Closing only on
     `PostToolUse` would leave every approved-then-failed call's bracket
     open forever and tombstone it as "human never responded", when the
     human in fact approved promptly and the tool errored. The loss is
     **biased, not merely lossy**: waits ending in failure are dropped while
     waits ending in success are kept, and failed calls are exactly where
     retry storms live — including the 1Password 56/58 identical-retry storm
     this packet targets. A baseline collected under the uncorrected rule
     would understate failure waits and skew the headline p95.
     `error` is content and is never retained; `is_interrupt` is, because it
     separates "the human hit escape" (a human action, in scope for a
     human-wait instrument) from "the tool errored" (not).
     Caveat: the failure dispatcher is gated by an internal feature check and
     returns early when disabled, in which case a failed call emits no
     closing event at all. The correction holds either way — the gate only
     decides whether the bracket closes or is tombstoned honestly. Which
     applies here is a **day-1 empirical check** against the first real rows,
     not an assumption.
- `hook-pulse`: one script appending schema-versioned NDJSON
  (`HookPulseV1`: schemaVersion, sessionId, clone cwd, agent kind, hookEvent,
  toolName, waitReason, durationMs, notifierRev, ts) to
  `${XDG_STATE_HOME:-$HOME/.local/state}/beep/agent-evidence/hook-events/`. Schema
  defined in effect/Schema even though the writer is zsh+jq, so P4 replay
  ingests these files as first-class raw history. Fixtures must include a
  no-match Notification case: jq's `capture()` returns an empty stream on
  no-match, which silently annihilates the whole output object while the
  fail-open script still exits 0 (this defect was caught in the spike).
- Notifications: ntfy desktop/phone push on plan-approval and permission
  blocks, with an escalation ladder and per-session storm damping (one ping
  per retry storm). Stretch: remote Approve/Deny action buttons bridging to
  `ccd_session send_message`.
  - **Escalation triggers on `PermissionRequest`, never on `PreToolUse` and
    never on idle notifications.** Plan-parked sessions emit no `Stop` and
    therefore no idle Notification (amendment 5), so an idle-driven ladder
    would be silent on exactly the headline p95 105-minute wait class.
    `PreToolUse` is equally unusable as a trigger: it fires for every tool
    call, so any slow-but-auto-approved tool would raise a false permission
    alert and burn the storm-damping budget reserved for real blocks. The
    plan-approval trigger is `PermissionRequest{tool_name: "ExitPlanMode"}`;
    the tool-permission trigger is a `PermissionRequest` for any other tool
    whose matching `PostToolUse` has not arrived. Escalation timers run off
    the open bracket's age, independent of any notifier event. Idle
    notifications may raise ladder urgency but must never be a trigger's
    sole precondition.
- Method: instrument-before-treat. ~1 week log-only baseline across clones,
  then flip notifications on — an interrupted time-series is legitimate for
  a 10–20x expected effect. `notifierRev` stamps every event so later
  paired trials stratify on notifier state; the notifier joins P8's frozen
  environment manifest (never the treatment variable).
- Shared operational state, same XDG root + NDJSON idiom:
  - **Circuit-breaker ledger:** op/gh/network probe results consulted by
    all agents/hooks; one failure trips machine-wide; retries become
    labeled skips (kills the 1Password 56/58 identical-retry storm).
  - **Kill-switch sentinel:** one file disarms every telemetry hook in
    under a second; the disarm window self-labels `evidenceTier: unknown`.
- The hook-pulse ledger later serves as the independent witness P4 trust
  gates reconcile v2 wait spans against, and as the P6 spike's fixture
  corpus of real transition sequences.

**Implementation checkpoint (2026-09-03):** the fixed `log-only-0` window is
closed, checkpoint option 3 selects the observed `AskUserQuestion` population,
and `desktop-ntfy-1` is live after an explicitly excluded six-second cutover
overlap. Notification and damping state, breaker state/events, Claude/Codex
adapters, exact-bracket rechecks, desktop Plasma delivery, and cross-adapter
retry suppression have schema and execution proof. PR #973 merged at
`2026-09-03T14:32:50Z`; two direct clones already carried the sharp revision,
and five clean, process-idle `main` clones were then fast-forwarded to
`a1652c1923`. Subsequent owner integrations raised adoption to 19 of 22 direct
clones by `2026-09-03T17:12:07.940Z`. The three non-adopters were one archived
Effect-v3 clone, one live dirty feature checkout with an open PR, and one clean
inactive feature checkout not owned by this executor. They are explicitly
excluded from the current rollout denominator rather than mutated out of band;
their revision-labelled rows remain controls, and the disposition is
re-evaluated on owner integration or reactivation. P1 now has eight sharp
human-input starts: seven exact-ID closures, one honest
tombstone, and a revision-qualified 80.1% descriptive median reduction. P1
remains open until ntfy phone delivery has a safe runtime secret plus receipt.
See
`research/2026-09-03-p1-baseline-close.md` and
`research/2026-09-03-p1-first-treatment-readout.md`.

## P2 — Telemetry-v2 truth model (audit P1)

- **First step:** schema → service → impl. Author `FlightRecord`,
  `IngestManifest`, and LiteralKit domains (`WaitReason`,
  `TerminalOutcome`, `EvidenceTier`, `SkipReason`) with one hand-written
  fixture from a real recent session and one real IngestManifest for this
  workstation's actual universe, round-trip tested — before any hook wiring.
- FlightRecord: objective, semantic turns, waits, terminal outcome,
  evidence refs, config fingerprint. **Mechanical fields (timestamps,
  turn/tool counts, wait gaps) are computed by the hook script from the
  transcript JSONL — never by the agent**; the agent supplies only semantic
  fields; self-report divergence is a first-class per-fingerprint metric.
  An invalid record is itself a recorded event, never a silent drop.
- Codex parity via a `codex exec` wrapper emitting the same schema; brands
  that cannot emit appear in IngestManifests as enumerated-but-unemittable
  (a quantified burn-down list, not a blind spot).
- Heartbeat leases: SessionStart writes a lease, and **any** hook event
  renews it — PostToolUse, Notification, UserPromptSubmit. **Hook events
  alone are not sufficient** (P1 spike, amendment 5): a session blocked on a
  plan approval or permission dialog emits its `PermissionRequest`, one
  corroborating Notification ~6s later, and then nothing at all, so a
  105-minute wait renews no lease after its first seconds. The lease must
  therefore be renewed by P1's periodic heartbeat or carry an explicit
  pending-wait state opened by `PermissionRequest` and closed only by its
  matching decision. An expired lease is only a tombstone **candidate**:
  synthesis happens at ingest reconciliation and requires that the
  transcript/source evidence also shows no later activity **and** that no
  wait bracket is open, so a live-but-waiting session is never tombstoned.
  Detection stays O(open leases).
- Coverage attestation: every ingest enumerates its denominator (clones,
  worktrees, session dirs; read / unreachable / skipped-with-reason)
  **before reading anything**.
- The five evidence-integrity laws (SPEC) are implemented here as schema
  properties: quarantine attribution, weakest-link tier propagation,
  privacy by unrepresentability, instrument-class tagging, OIP taint.
- Orthogonal lifecycle fields, hierarchy, contract-first sources, pinned
  OTel GenAI convention version + bounded `coding_agent.*` extensions —
  unchanged from the audit plan.
- **Load-bearing risk:** SessionEnd does not fire on SIGKILL/crash/context
  exhaustion, and semantic self-report can be wrong. The design holds only
  with the mechanical/semantic split plus lease-driven tombstone
  reconciliation, so channel dropout is a measured number with an alarm
  threshold.

## P3 — Yeet mistrial doctrine and proof durability (audit P1.5)

Dogfoods P2 vocabulary in the operator before any pipeline exists.

- **First step:** in `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts`,
  add a `YeetExhibit` S.Class (laneCommand, checkId, outputSha256,
  content-addressed outputPath), extend the outcome LiteralKit to
  `success | failure | mistrial`, restructure `YeetVerdict` as a tagged
  union whose failure variant requires `S.NonEmptyArray(YeetExhibit)`, and
  land a decode test proving an exhibit-less failure fails to decode.
- Mistrial: exhibit-less failure indicts the instrument (reason from a
  shared instrument-defect LiteralKit: interrupted, lock-poisoned,
  env-missing, auth-instrument, orphaned-process…); `repair`/`verify`
  refuse to blind-rerun a mistrial.
- Proof durability: `ProofState.ts` already keys per-lane proofs by command
  + tree fingerprint. Extend the key with a toolchain hash (bun/turbo/tsgo
  versions + lockfile hash); write lane proofs transactionally
  (temp-file + rename) at **lane** completion; publish consults surviving
  proofs on resume so only unproven lanes rerun — the 17-minute
  byte-identical rerun class dies.
- `yeet doctor`: every state transition appends a checkpoint carrying the
  P2 `waitReason` vocabulary; doctor answers "what is Yeet waiting on and
  why" from checkpoints; `--until-transition` offers a blocking watch that
  replaces status polling. Stretch: cross-clone proof sharing via the P0
  store.
- Exhibits double as P5 eval ground truth; mistrial rate becomes a P8
  guardrail.
- **Load-bearing risk:** classification under crash. Reconstruction erring
  toward mistrial can suppress real failures (worst case: a stale-but-
  matching proof lets an unproven tree publish); erring toward failure
  recreates the rerun treadmill. Checkpoint writes must be transactional
  and fingerprint coverage (untracked files, env, toolchain) provably
  complete before resume-as-cache-hit is trusted.

## P4 — Replay, deduplication, and trust gates (audit P2)

- Offset/inode checkpoints, partial-line handling, rotation recovery,
  source-native IDs, deterministic fallback IDs. Replay ALL encrypted raw
  history into versioned v2 tables; preserve v1 read-only; never present
  v1→v2 score movement as agent-performance change.
- **Crash-only doctrine replaces shadow-write (amended):** raw history is
  append-only truth; v2 is a pure replay function; determinism is proven by
  replaying twice on different days and diffing outputs (zero mismatches
  required); a scheduled delete-and-replay drill keeps the path exercised.
  kill -9 is the only supported collector shutdown.
- Trust gates: zero duplicate source-event identities; privacy scan clean
  (on top of unrepresentability); complete fixture ingestion with visible
  unknown-event counts; sampled parentage agrees with source evidence;
  collector overhead within predeclared budget; critical-path calculations
  never double-count nested/parallel work; v2 wait spans reconcile against
  the P1 hook-pulse ledger (independent witness).
- Replace the 70/20/10 composite with separate outcome, quality,
  reliability, wait/flow, rework, cost, and evidence-coverage families.

## P5 — Assessment and evaluation system (audit P3)

- Extend existing `ai-metrics` / `agent-effectiveness` command groups; no
  new command group or UI. Schema-decoded JSON, human CLI summaries,
  reproducible packet Markdown, Phoenix drill-down.
- Rank bottlenecks by impacted wall time, frequency, outcome association,
  affected objectives, and evidence confidence; heuristic-only findings
  stay advisory; nothing renders without its denominator.
- 12-task time-held-out corpus (discovery/reuse, focused fixes, multi-file
  changes, failed-check diagnosis, reviews/docs, constrained read-only);
  three paired repetitions per treatment; repository revision, model,
  effort, tools, permissions, cache lane, budget, timeout, and grader held
  constant. Retro-mined history is candidate-generation only, never primary
  evidence.
- **Amended hygiene:** treatment assignment verified from observed config
  fingerprints, not intent; a memory-ablated eval profile controls Cognee +
  shared auto-memory as an explicit variable (cross-clone memory makes
  "held-out" leaky by default).

## P6 — Effect vs XState transition-kernel spike (audit P4)

Unchanged from the audit plan: same versioned event/state schemas drive a
native Effect reducer (A) and a direct `xstate@5.32.5` pure transition
kernel (B); Effect owns persistence, replay, fibers, retries, cancellation,
finalizers, telemetry, migrations; no invoked actors, timers, React
integration, or public XState types. Adopt XState only on zero
shadow-replay mismatches, passing cancellation/fault/migration/property
tests, two+ concrete statechart advantages, and budget-clean perf — else
remove the dependency. **Amended input:** the P1 hook-event stream is the
spike's fixture corpus of real recorded transition sequences. Depends on
the `effect-v4-workflow-engine-spike` boundary (no duplication of
kill/restart durability).

## P7 — Evidence-dispositioned improvement portfolio (audit P5)

One variable at a time: AGENTS/CLAUDE context weight; skill trigger
precision and false/missed invocation rates; MCP/tool exposure and failure
quality; hook batching and runtime; subagent decomposition and critical
path; prompt/model/effort/cache configuration; **browser-proof routing —
every UI-affecting case receives real-browser (`browser-qa-loop`/Playwright)
proof or a typed `unverified` outcome, never a jsdom-green pass alone (this
lane owns the pulse's H8 browser-proof dimension)**; the full Ponytail
plugin as an optional treatment; speculative execution at approval gates as
a parked treatment candidate. Every item ends shipped / deferred with
trigger / rejected with reason / explicitly waived — evidence attached.

## P8 — Guarded canary and closeout (audit P6)

- Highest-impact reversible wait treatment, control + treatment in isolated
  disposable worktrees; local edits and checks only (authority limits in
  SPEC Locked Decisions).
- Advance only when: required quality/safety checks pass; edit survival and
  rework do not regress; expected cost per successful solve does not
  increase; the target wait decreases across paired trials with a 95%
  bootstrap interval excluding zero; telemetry health and privacy stay
  green; **and (amended Goodhart guardrails) the silent-decision audit
  passes (no human gate skipped that should have been taken) and the
  mistrial rate does not increase**.
- Never automate AGENTS/skill changes, permissions, MCP enablement,
  architecture decisions, or human gates from anomalous traces.
- Close per the checklist below only after telemetry is trustworthy, every
  finding is dispositioned, and at least one wait is measurably reduced.

## P8 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` /
`complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo
   **tooling**, the **implementation**, and the **goal/prompt**. Capture
   TODOs worth codifying. Frontmatter must validate against
   `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (`reflectionRequired: true`;
   a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json`
   phase statuses + `initiative.status` in the same PR as the final work.

## Execution Notes

- Preserve unrelated worktree changes; the user edits the tree in parallel.
- Keep `SPEC.md` normative; update only when the contract changes.
- Keep this plan current; archive run outputs under `history/`.
- Durable handoffs are files on disk (packet `research/`, `history/`),
  never chat-only summaries.

## Verification Commands

```sh
test "$(wc -m < goals/coding-agent-effectiveness-evidence-loop/GOAL.md)" -le 4000
jq . goals/coding-agent-effectiveness-evidence-loop/ops/manifest.json
rg -n "coding-agent-effectiveness-evidence-loop|GOAL.md|agentLaunchers|packetAnchorDocument" goals/coding-agent-effectiveness-evidence-loop
git diff --check -- goals/coding-agent-effectiveness-evidence-loop
```
