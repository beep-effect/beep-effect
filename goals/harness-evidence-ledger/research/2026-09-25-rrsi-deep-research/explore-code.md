# explore-code findings (Opus Explore agent, 2026-09-25) — saved by parent

## 1. AgentEffectiveness (packages/tooling/tool/cli/src/commands/AgentEffectiveness/)
- Subcommands (AgentEffectiveness.command.ts:688-712): doctor; annotations plan|check; datasets|prompts|experiments bundle; evals score (:626); evals compare (:638); phoenix sync. No `evals run`.
- Schemas (AgentEffectiveness.schemas.ts):
  - AgentConventionControls (:342) = the only config fingerprint: repositorySnapshot, harnessDigest, environmentDigest, safetyPolicyDigest, model, reasoningEffort, budgets.
  - AgentConventionVariant (:375): digests for guidance / navigation / handoff surfaces.
  - AgentConventionMeasurements (:407, tokens + elapsed as Option), AgentConventionTrial (:442), AgentConventionDifferences (:482), AgentConventionComparison (:523, TaggedUnion Comparable|Incomparable), AgentEffectivenessEvalScoreReport (:229).
- compareAgentConventionTrials (internal/EvalComparison.ts:~120): Comparable{changedSurface, differences} only when exactly one surface digest differs and controls/pairId/taskId match; else Incomparable with ComparisonRefusal (schemas.ts:458). Differences = candidate − baseline; no winner declared.

## 2. ai-metrics (packages/tooling/library/ai-metrics/src/models.ts)
- ConfigSnapshot (:676) = hash of agent config files (.codex, .claude, AGENTS.md/CLAUDE.md), computed by makeAiMetricsConfigSnapshot (config-snapshot.ts:946). Does NOT record model, effort, tools.
- BenchmarkCase (:936), BenchmarkRun (:975): configSnapshotId is a plain string. Only verdict field: AiMetricsQualityGateStatus (:504).
- BUG (to verify): EvalRecord.ts hashes the score breakdown (the result) into configSnapshotId, so it is not a config fingerprint.
- Closest fingerprint schema: FlightConfigAttribution in flight-record.ts (~:341): observed | last-known | unknown.
- No LiteralKit with accepted/rejected/tombstoned in packages/tooling. Nearest: CodexDisposition (Codex/Findings.triage.schemas.ts:55), DocgenQualityWorkerEvalReviewDisposition.

## 3. SkillOpt
- tools/skillopt/pyproject.toml pins skillopt==0.2.0; code in src/beep_skillopt/{adapter,train}.py; template configs/beeplaw.template.yaml; adapter shells out to `evals score`.
- NOT installed in this clone (beep-effect19); installed in sibling clone beep-effect/tools/skillopt/.venv/.../skillopt.
- Edit-budget schedule ALREADY EXISTS in skillopt 0.2.0: optimizer/scheduler.py supports constant|linear|cosine|autonomous. Config keys: optimizer.learning_rate → edit_budget, optimizer.min_learning_rate → min_edit_budget, optimizer.lr_scheduler (config.py:111-113); trainer.py:821 builds the schedule.
- Parallel gate eval: env.workers → adapter.workers → ThreadPoolExecutor (adapter.py:689). Parallel across items; still one candidate per step.
- P5 config: out/, config.json, run log are gitignored and not on disk; only record is history/p5-training/FINDINGS.md (2 epochs, batch 2, minibatch 2, edit budget 1, patch mode, soft gate, serial workers, Sonnet optimizer via claude_chat, codex_exec target).

## 4. Corpus and scorer
- 12 cases in goals/skillopt-training-pilot/corpus/: benchmark-cases.json, tasks/*.json, fixtures/*, splits/{train,val,test}/items.json.
- Score = completion × mean of three 1/(1+violations) law scores (EvalScoring.ts:185-223).
- The three checks (schema-first, tsgo, biome) run serially in EvalLawLanes.ts:407-409 → cheap parallel speed-up.

## 5. Schema home
- 07-non-slice-families.md:329-350: command-owned schemas in <Group>.schemas.ts; reusable schemas in a tooling library.
- ai-metrics README owns "recorded benchmark runs" → likely home for LedgerRow.
- Rules: LiteralKit for literal unions, S.Class with $I.annote, Option for nullish. Schema-first lint kinds: Lint/Lint.schemas.ts:157.

## 6. Research ledger
- No TypeScript reads/writes research/ledger/**; only the nightly routine writes it.
- Tombstone rows: untyped jsonl, "schema":"beep.research.tombstone/v0", reason "unactioned-3-runs". Nothing to reuse beyond the idea.
