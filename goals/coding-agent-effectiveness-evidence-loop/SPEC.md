# Coding Agent Effectiveness Evidence Loop Spec

## Objective

Deliver a trustworthy, schema-first evidence loop for developer coding-agent
operations on this workstation: (1) telemetry whose identity, attribution,
coverage, and privacy properties are provable rather than asserted; (2) legible
Yeet verdicts where failure without evidence is unrepresentable; (3) an
assessment and evaluation system that ranks bottlenecks and validates
treatments causally; and (4) at least one dominant agent wait (plan-approval
p95 105 min, input waits p95 14 min, polling at 3.4x tool-execution time)
measurably reduced behind guardrails.

## Ownership Boundary

This packet improves and measures **developer coding-agent execution only**
(Claude Code, Codex CLI/Desktop, OpenClaw as harnesses working on this repo
family). Product-agent state machines and Professional Runtime semantics
remain separate slice-owned work (`packages/agents/*`). Repo-wide
orchestration code lands under `tooling/` per `standards/ARCHITECTURE.md`.

## Non-Goals

- Reopening completed packets (`agent-effectiveness-loop`,
  `agent-pipeline-velocity`, `harness-otel-adoption`,
  `harness-hygiene-mechanical`, `yeet-agent-ergonomics`,
  `skillopt-training-pilot`) — they are retained evidence and reusable bricks.
- Editing `goal-portfolio-driver`'s locked queue (next-wave proposal only).
- Rewriting `ai-metrics-stack` P7f in-flight work; this packet consumes it.
- **Rejected traps** (evidence-dispositioned during planning, see
  `research/2026-07-31-adhd-amendments.md`): patching v1 identity in place;
  retro-mined history as primary experimental evidence (candidate-generation
  only); replacing standing clones with ephemeral checkouts; dissolving goal
  packets into materialized views; speculative execution at approval gates
  (parked as a P7 treatment candidate, not an amendment).
- No new agent framework, observability backend, UI, or command group.
  Reuse Effect services/Schemas, AI Metrics/DuckDB/Parquet/OTel/Phoenix,
  native host hooks, Playwright, Yeet, and retained SkillOpt bricks.

## Source Hierarchy

1. User objective: the 2026-07 agent-bottleneck audit and its approved
   amendments (`research/SOURCES.md` traces provenance).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards (`standards/ARCHITECTURE.md`).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Locked Decisions

Carried from the audit's grill session and the 2026-07-31 amendment interview;
do not re-litigate without a new decision entry:

1. **Identity hierarchy:** work objective → session/thread → semantic turn →
   activity/attempt; missing parent links stay `unknown`. A transcript file is
   never a task; ingest runs are lineage, never identity.
2. **Canonical store:** `${XDG_STATE_HOME:-$HOME/.local/state}/beep/ai-metrics`
   (precedence `--data-root` → `BEEP_AI_METRICS_DATA_ROOT` → XDG default).
   Atomic same-filesystem rename of the ~19.4GB store; no compatibility
   symlink; legacy store retained as rollback evidence.
3. **Lifecycle vocabulary:** state, active phase, wait reason, terminal
   outcome, and evidence tier are independent fields, LiteralKit domains.
4. **Truth model:** first-person witness flight records + coverage
   attestation are the telemetry-v2 write contract; transcript archaeology is
   a tombstone-producing crash-recovery fallback (P2).
5. **Success definition:** terminal status + scoped checks/Yeet evidence +
   edit survival/rework, optional human labels; insufficient evidence yields
   `unknown`, never assumed success.
6. **Experiment ladder:** passive telemetry identifies candidates; a
   time-held-out paired-trial corpus validates causality; only then may one
   treatment enter the disposable-worktree canary.
7. **Canary authority:** disposable worktree only; no push/PR writes,
   credentials, messages, destructive host actions, auto-approval, or
   auto-answering human gates.
8. **Disposition policy:** every improvement item ends shipped / deferred
   with trigger / rejected with reason / explicitly waived, with evidence.
9. **Ponytail scope:** installed `ponytail` + `ponytail-review` skills stay
   byte-identical to upstream; the full plugin/hooks enter only as a
   controlled P7 treatment.
10. **XState posture:** evidence-gated candidate, not a commitment. Direct
    `xstate@5.32.5` may compute pure transitions only; Effect owns
    persistence, fibers, retries, cancellation, durability. `effstate` and
    `@typeonce/effect-xstate` are rejected as dependencies (Effect-peer
    mismatch); `@typeonce/effect-machine` informs the spike only.

## Evidence-Integrity Laws

Schema-level laws for P2 models, gate-level checks in P4. All five adopted
2026-07-31:

1. **Refuse-don't-guess attribution.** An event that fails identity-registry
   lookup lands in a quarantine ledger requiring explicit disposition; the
   collector is structurally unable to assign a default clone/config identity.
2. **Weakest-link evidence-tier propagation.** Every derived metric inherits
   the minimum tier of its inputs; the tier travels into reports and score
   families; a lint forbids `observed`-labeled output with heuristic ancestry.
3. **Privacy by unrepresentability.** Telemetry-v2 schemas have no field that
   can physically hold prompt, command, tool-argument, or tool-result
   content. Privacy is a compile-time fact, then re-verified by scan.
4. **Instrument-class tagging.** Sessions that build, measure, or evaluate
   the metrics system itself are tagged and excluded from effectiveness
   baselines by default.
5. **OIP confidentiality taint chain-of-custody.** Sessions touching
   OIP/corpus paths are taint-flagged at the SourceEvent; telemetry retains
   only timings and counts from them by schema construction; a periodic
   adversarial audit must fail to reconstruct confidential content from the
   store. The centralized store must never become an aggregation point for
   pre-publication patent material.

## Target Surfaces

- `packages/tooling/library/ai-metrics` (telemetry-v2 models, ingestion,
  attestation, assessment projections).
- A new schema-first flight-record surface (inside ai-metrics or a sibling
  tooling library — decided at P2 implementation with
  `architecture-guardian`).
- `packages/tooling/tool/cli` Yeet internals (`Verdict.ts`, `ProofState.ts`,
  `Handler.ts`, `Status.ts`, new `yeet doctor`).
- `.claude/settings.json` hooks + hook scripts; a `codex exec` wrapper.
- `${XDG_STATE_HOME}/beep/` shared operational state (hook-pulse ledger,
  circuit-breaker ledger, kill-switch sentinel).
- This packet's docs and `explorations/agent-effectiveness-pulse` linkage.

## Constraints

- Effect v4, schema-first design order (schema → service contract → impl),
  LiteralKit for literal domains, no plain Set/Map, `Effect.fn`/`fnUntraced`.
- Hooks must be fail-open and cheap; a hook failure must never block agent
  work; the kill-switch sentinel disarms all telemetry hooks in under a
  second and the gap self-labels as `evidenceTier: unknown`.
- Instrument-before-treat: no behavioral treatment ships before its
  measurement instrument is verified (P1 hook-semantics spike first).
- One mutating actor per worktree; canary work is worktree-isolated.
- No always-loaded instruction growth (AGENTS.md/CLAUDE.md stay flat).
- Store migration is stop-the-collector → validate → atomic rename → verify →
  restart; never copy-then-delete, never leave dual live stores.

## Acceptance Criteria

- [ ] Canonical store serves all clones/worktrees; repeated ingest adds zero
      facts; duplicate canonical events are zero; no clone can silently
      create an independent credited store.
- [ ] Coverage attestation: every ingest emits its denominator; seven-day
      fleet coverage ≥ 95% accounted as read / tombstoned / explicitly
      unreachable; no aggregate renders without its denominator.
- [ ] Flight records flow from Claude and Codex sessions with the
      mechanical/semantic split; self-report divergence is a reported metric;
      unclosed sessions receive tombstone terminals.
- [ ] All five evidence-integrity laws hold: quarantine ledger live, tier
      propagation lint green, privacy unrepresentability + clean scans, meta
      sessions excluded from baselines, OIP taint audit passes.
- [ ] Yeet: every terminal verdict is `success`, `failure`-with-exhibits, or
      `mistrial`; exhibit-less failure fails to decode; interrupted publish
      resumes via per-lane proofs (no byte-identical full-proof rerun);
      `yeet doctor` names the blocking edge from checkpoints.
- [ ] Replay determinism proven by replay-twice-diff (zero mismatches) and a
      scheduled delete-and-replay drill; v1 preserved read-only; v1→v2 score
      movement never presented as agent-performance change.
- [ ] Composite 70/20/10 score replaced by separate outcome / quality /
      reliability / wait / rework / cost / evidence-coverage families.
- [ ] Eval corpus (12 held-out tasks, 3 paired repetitions, deterministic
      graders first, memory-ablation profile) is runnable; treatment
      assignment verified from observed config fingerprints.
- [ ] At least one targeted wait reduced across paired trials with a 95%
      bootstrap interval excluding zero, AND Goodhart guardrails green:
      silent-decision audit passes and mistrial rate does not increase.
- [ ] Every improvement-inventory item carries a disposition with evidence.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/coding-agent-effectiveness-evidence-loop/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/coding-agent-effectiveness-evidence-loop/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/coding-agent-effectiveness-evidence-loop` | Passes |
| Goals index | `bun run beep goals index --check` | Passes |
| Goals doctor | `bun run beep goals doctor` | Packet reported healthy |
| Reflection lint | `bun run beep lint reflection-artifacts` | Passes |
| Repo quality | `bun run beep yeet verify` | Green |

Phase-specific instruments (replay diffs, attestation coverage, paired-trial
bootstrap CIs, adversarial privacy audit) are defined per phase in `PLAN.md`
and recorded under `history/` as evidence when run.

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or
  policy approval not named in this spec.
- The same blocker repeats after reasonable investigation.
- The store migration cannot verify counts/DB integrity post-rename.
- Any telemetry surface would capture prompt/command/tool-arg/OIP content —
  stop and redesign the schema; never filter after the fact.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
