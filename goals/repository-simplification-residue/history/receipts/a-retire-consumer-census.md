# #1851 tracked-consumer census for every retired A-train surface

Lane `residue-a-retire`, branch `chore/residue-a-retire-census` off `main`
`35faa4a00d2eba0603757b24cc181d32b9c0779d` (2026-10-24). The payload
retirements landed in the first two A-train PRs (#1898, #1900); their records
are `skillopt-retirement-record.md` and `impeccable-retirement-record.md` in this
directory. This receipt answers the last #1851 acceptance clause: "A current
tracked-consumer census is empty for every retired surface".

## Census commands

Run from the worktree root. `git grep` reads tracked content only; `-I` skips
binaries; matching is case-insensitive.

```sh
for pat in 'skillopt' 'impeccable' '\.agents/plugins' 'marketplace\.json' 'sst\.config' '"sst"'; do
  echo "### $pat"
  git grep -I -i -c -E "$pat" -- . ':!:**/history/**' ':!:explorations/**' ':!:research/**' ':!:**/CHANGELOG.md'
done
```

The output matches the orchestrator's raw census at the same sha line for line.
The one exception is `apps/todox/src/app/opengraph-image.png`, which only a
non-`-I` grep reports (classified below).

Supplementary probes (same pathspec, `-P`, case-sensitive) covered paths and
spellings the six words miss: `plugins/(box|github|notion)`, `tools/skillopt`,
`beep_skillopt`, `impeccable:detect`, `\.sst\b`, `sst-env`, `\bsst\b`, `sst\.dev`
and `@?sst/`. Every hit sits in a file that already appears in the tables below
(goal research, completed packets, the IANA subtag registry and its source file
`packages/foundation/modeling/html/data/iana/language-subtag-registry.txt`, which
has the same `sst` subtag). No new consumer was found. Bare `plugins` roots in
config are oxlint, Biome, TypeScript, Tauri and fallow plugin keys. One exception:
the Knowledge refs `GOVERNED_BARE_ROOTS` entry `plugins`, which the 2026-10-17
Decision Log row keeps on purpose so that any leftover `plugins/...` reference
shows up as a broken target. It detects references; it consumes nothing.

## Classes

- **L, live consumer:** reads, runs, imports, configures, globs, lints, documents
  as current or points at a retired path.
- **E, immutable evidence:** records of the past; they stay byte-identical.
- **N, name collision:** the same word with a different, live meaning.

### E policy

Hits are E when they are in:

- goal `research/`, `data/`, `corpus/`, `findings/`, `ops/triage.json` or
  `ops/discovery/`;
- the append-only `harness-ledger/rows/`;
- any file of a packet whose lifecycle is `completed-retained` (its SPEC, PLAN,
  README, GOAL and manifest describe finished work);
- this packet's own dated #1851 context and its 2026-10-17 Decision Log rows.

`goals/knowledge-doctor.baseline.jsonc` is E too. Its two
`prohibition-of-retired-surface` rows accept the dated `tools/skillopt/.venv`
mentions in the completed confidence packet's PLAN and SPEC. Those rows track E
documents, and they leave only when those documents change.

None of these files was edited. `goals/**/history/outputs/**` was not touched.

### N reasoning

- **Retained SkillOpt scorer.** `beep agent-effectiveness evals score`,
  `SkillOptTaskManifest` and the `AgentEffectiveness` modules and test survive by
  name in the retirement record. The runbook, the generated JSDoc inventory and
  schema catalog rows, the EV detector inventory row and the active
  coding-agent-effectiveness packet all cite that scorer. None of them cites the
  retired `tools/skillopt` runner.
- **`QaJudgeSkillOptions`.** This is `QaJudgeSkill` + `Options`, so it matches
  `skillopt` only under case-insensitive matching.
- **Retained pilot packet folders.** The `beep-effect.iml` exclusions name
  `goals/skillopt-training-pilot` and `explorations/skillopt-training-pilot`.
  Both folders still exist as retained evidence.
- **Global Impeccable plugin.** The live user tool is distinct from the retired
  repository Impeccable:
  - `.gitignore` `**/.impeccable/` and the `beep-effect.iml` `.impeccable`
    exclusion keep the global install's state out of commits and out of the
    index (impeccable-retirement-record, Global-install state; the
    `beep-effect.iml` exclusion was restored on purpose by #2091);
  - the four `home.agents.impeccable.*` seats in `Models.seed.ts` point at
    `$HOME/.agents/skills/impeccable/...`, which workstream F owns (F-CLAUDE).
- **PNG metadata.** `apps/todox/src/app/opengraph-image.png` has a `tEXt` key
  `impeccable:prompt`, written by the asset generator.
- **Other `marketplace.json` files.** The practice Claude mod builds its own
  `dist/.claude-plugin/marketplace.json`. `@beep/ai-sync` tracks the SchemaStore
  `claude-code-marketplace.json` schema URL. Cursor and Claude plugin research
  describes the vendors' manifest formats. None of these is
  `.agents/plugins/marketplace.json`.
- **`"sst"`.** This is the IANA language subtag `sst` (Sinasina) in the generated
  `@beep/html` language-tag registry. It is not SST.

## Result at base

| Surface | Surface-file classifications | L | E | N |
| --- | ---: | ---: | ---: | ---: |
| `skillopt` | 115 | 0 | 98 | 17 |
| `impeccable` | 58 (+1 binary) | 0 | 55 | 3 (+1) |
| `\.agents/plugins` | 6 | 0 | 6 | 0 |
| `marketplace\.json` | 13 | 0 | 5 | 8 |
| `sst\.config` | 1 | 0 | 1 | 0 |
| `"sst"` | 1 | 0 | 0 | 1 |

No (L) hit remains at base, so nothing needed a root fix. #1898 and #1900 had
already removed every config, scan root, ignore, IDE entry, script, generated row
and stale test that pointed at the retired surfaces. This lane made no source,
config or generated-projection change and ran no regeneration. The only edits
are this receipt and the packet bookkeeping.

## Per-surface hits

### Surface `skillopt`

115 files: L 0, E 98, N 17.

| File | Hits | Class | Disposition |
| --- | ---: | :---: | --- |
| `beep-effect.iml` | 2 | N | Left untouched. Excludes the retained `goals/` and `explorations/` `skillopt-training-pilot` packet folders (both present); no `tools/skillopt` entry remains. |
| `docs/runbooks/agent-convention-comparisons.md` | 1 | N | Left untouched. Names `SkillOptTaskManifest`, the retained `agent-effectiveness evals score` contract (receipt: What survives). |
| `goals/agent-effectiveness-loop/README.md` | 1 | E | Left byte-identical. Completed-retained packet record (README.md). |
| `goals/agent-effectiveness-loop/SPEC.md` | 1 | E | Left byte-identical. Completed-retained packet record (SPEC.md). |
| `goals/agent-effectiveness-loop/ops/manifest.json` | 1 | E | Left byte-identical. Completed-retained packet record (ops/manifest.json). |
| `goals/agent-effectiveness-loop/research/SOURCES.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/agent-pipeline-velocity/ops/manifest.json` | 1 | E | Left byte-identical. Completed-retained packet record (ops/manifest.json). |
| `goals/agent-pipeline-velocity/research/SOURCES.md` | 2 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r30-main-bed30c/frozen-inputs.json` | 12 | E | Left byte-identical. Goal research/data snapshot (data/). |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r31-main-d68f1a/frozen-inputs.json` | 12 | E | Left byte-identical. Goal research/data snapshot (data/). |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-25-r32-main-28a704/frozen-inputs.json` | 12 | E | Left byte-identical. Goal research/data snapshot (data/). |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-25-r33-main-339da1/frozen-inputs.json` | 12 | E | Left byte-identical. Goal research/data snapshot (data/). |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-25-r34-main-339da1/frozen-inputs.json` | 12 | E | Left byte-identical. Goal research/data snapshot (data/). |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-25-r35-main-5c7685/frozen-inputs.json` | 12 | E | Left byte-identical. Goal research/data snapshot (data/). |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-25-r36-main-2bf1e1/frozen-inputs.json` | 12 | E | Left byte-identical. Goal research/data snapshot (data/). |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-25-r37-main-9a1bd3/frozen-inputs.json` | 12 | E | Left byte-identical. Goal research/data snapshot (data/). |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-25-r38-main-9a1bd3/frozen-inputs.json` | 12 | E | Left byte-identical. Goal research/data snapshot (data/). |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-25-r39-main-782aa4/frozen-inputs.json` | 12 | E | Left byte-identical. Goal research/data snapshot (data/). |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-25-r40-main-5bb775/frozen-inputs.json` | 12 | E | Left byte-identical. Goal research/data snapshot (data/). |
| `goals/codex-security-findings-2026-07-08/findings/CSF-016.md` | 23 | E | Left byte-identical. Dated security findings record. |
| `goals/codex-security-findings-2026-07-08/findings/CSF-027.md` | 12 | E | Left byte-identical. Dated security findings record. |
| `goals/codex-security-findings-2026-07-08/findings/INDEX.md` | 2 | E | Left byte-identical. Dated security findings record. |
| `goals/codex-security-findings-2026-07-08/ops/triage.json` | 69 | E | Left byte-identical. Dated security findings record. |
| `goals/coding-agent-effectiveness-evidence-loop/SPEC.md` | 3 | N | Left untouched. Active packet citing the retained scorer bricks and the retained pilot packet as evidence; no retired path. |
| `goals/effect-vitest-canon/ops/inventory/detector/beep_repo-cli.jsonl` | 1 | N | Left untouched. Detector inventory row for the retained scorer test file. |
| `goals/harness-evidence-ledger/GOAL.md` | 2 | E | Left byte-identical. Completed-retained packet record (GOAL.md). |
| `goals/harness-evidence-ledger/PLAN.md` | 2 | E | Left byte-identical. Completed-retained packet record (PLAN.md). |
| `goals/harness-evidence-ledger/README.md` | 4 | E | Left byte-identical. Completed-retained packet record (README.md). |
| `goals/harness-evidence-ledger/SPEC.md` | 5 | E | Left byte-identical. Completed-retained packet record (SPEC.md). |
| `goals/harness-evidence-ledger/ops/manifest.json` | 1 | E | Left byte-identical. Completed-retained packet record (ops/manifest.json). |
| `goals/harness-evidence-ledger/research/2026-09-25-rrsi-deep-research/bootstrap-plan.json` | 4 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/harness-evidence-ledger/research/2026-09-25-rrsi-deep-research/explore-code.md` | 5 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/harness-evidence-ledger/research/2026-09-25-rrsi-deep-research/explore-packets.md` | 5 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/harness-evidence-ledger/research/2026-09-25-rrsi-deep-research/refs-rsi-memory.md` | 13 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/harness-evidence-ledger/research/2026-09-25-rrsi-deep-research/repo-code-map.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/harness-evidence-ledger/research/2026-09-25-rrsi-deep-research/repo-prose-map.md` | 12 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/harness-evidence-ledger/research/OPPORTUNITIES.md` | 4 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/harness-evidence-ledger/research/SOURCES.md` | 5 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/jsdoc-carrier-migration/data/extract.jsonl` | 3 | E | Left byte-identical. Goal research/data snapshot (data/). |
| `goals/jsdoc-carrier-migration/data/titles.jsonl` | 1 | E | Left byte-identical. Goal research/data snapshot (data/). |
| `goals/knowledge-doctor.baseline.jsonc` | 2 | E | Left byte-identical. Two accepted `prohibition-of-retired-surface` rows for the dated mentions of `tools/skillopt/.venv` in the completed confidence packet PLAN/SPEC; they track E documents and leave only if those change. |
| `goals/knowledge-surface-automation/PLAN.md` | 1 | E | Left byte-identical. Completed-retained packet record (PLAN.md). |
| `goals/knowledge-surface-automation/SPEC.md` | 1 | E | Left byte-identical. Completed-retained packet record (SPEC.md). |
| `goals/knowledge-surface-automation/research/SOURCES.md` | 2 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/knowledge-surface-automation/research/prior-ritual-lessons.md` | 9 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/knowledge-surface-automation/research/surface-inventory.md` | 2 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/quality-gate-ratchets/GOAL.md` | 1 | E | Left byte-identical. Completed-retained packet record (GOAL.md). |
| `goals/quality-gate-ratchets/README.md` | 1 | E | Left byte-identical. Completed-retained packet record (README.md). |
| `goals/quality-gate-ratchets/SPEC.md` | 1 | E | Left byte-identical. Completed-retained packet record (SPEC.md). |
| `goals/quality-gate-ratchets/ops/manifest.json` | 1 | E | Left byte-identical. Completed-retained packet record (ops/manifest.json). |
| `goals/quality-gate-ratchets/research/SOURCES.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/quality-speedup/research/data/fleet-lane-observations.tsv` | 2 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/quality-speedup/research/data/fleet-yeet-runs.tsv` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repo-cli-modularization/ops/discovery/audits.json` | 1 | E | Left byte-identical. Frozen discovery snapshot. |
| `goals/repo-cli-modularization/ops/discovery/files/AgentEffectiveness.json` | 7 | E | Left byte-identical. Frozen discovery snapshot. |
| `goals/repository-simplification-confidence/PLAN.md` | 3 | E | Left byte-identical. Completed-retained packet record (PLAN.md). |
| `goals/repository-simplification-confidence/SPEC.md` | 9 | E | Left byte-identical. Completed-retained packet record (SPEC.md). |
| `goals/repository-simplification-confidence/research/BRIEF-2026-10-09.md` | 2 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/OPPORTUNITIES.md` | 2 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/baseline-2026-10-09.md` | 2 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/A-retained-tools.md` | 5 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/A-retire.md` | 23 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/B-inline-suppressions.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/B-standards.md` | 2 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/E-github.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/INDEX.md` | 3 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/README.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-residue/SPEC.md` | 2 | E | Left byte-identical. Dated #1851 context and the 2026-10-17 retirement Decision Log rows of this packet. |
| `goals/skillopt-training-pilot/GOAL.md` | 11 | E | Left byte-identical. Completed-retained packet record (GOAL.md). |
| `goals/skillopt-training-pilot/PLAN.md` | 12 | E | Left byte-identical. Completed-retained packet record (PLAN.md). |
| `goals/skillopt-training-pilot/README.md` | 7 | E | Left byte-identical. Completed-retained packet record (README.md). |
| `goals/skillopt-training-pilot/SPEC.md` | 11 | E | Left byte-identical. Completed-retained packet record (SPEC.md). |
| `goals/skillopt-training-pilot/corpus/.proofs/json-validation.log` | 73 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/.proofs/sensitive-data-scan.log` | 1 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/.proofs/tsgo-all.log` | 12 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/DERIVATION.md` | 19 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/benchmark-cases.json` | 36 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/splits/train/items.json` | 8 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/splits/val/items.json` | 4 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/tasks/sfv4-fn-schema-001.json` | 2 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/tasks/sfv4-fn-schema-002.json` | 2 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/tasks/sfv4-fn-schema-003.json` | 2 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/tasks/sfv4-getsomes-struct-001.json` | 2 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/tasks/sfv4-getsomes-struct-002.json` | 2 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/tasks/sfv4-getsomes-struct-003.json` | 2 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/tasks/sfv4-normalization-001.json` | 2 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/tasks/sfv4-normalization-002.json` | 2 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/tasks/sfv4-normalization-003.json` | 2 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/tasks/sfv4-null-return-001.json` | 2 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/tasks/sfv4-null-return-002.json` | 2 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/corpus/tasks/sfv4-null-return-003.json` | 2 | E | Left byte-identical. Frozen pilot corpus and proofs. |
| `goals/skillopt-training-pilot/ops/events/00001-packet-created-92e92655aa2e11cf621c3f4f4cc18f77e83cf7937d20efd94dc36227d084b7ea.json` | 1 | E | Left byte-identical. Completed-retained packet record (ops/events/00001-packet-created-92e92655aa2e11cf621c3f4f4cc18f77e83cf7937d20efd94dc36227d084b7ea.json). |
| `goals/skillopt-training-pilot/ops/manifest.json` | 17 | E | Left byte-identical. Completed-retained packet record (ops/manifest.json). |
| `goals/skillopt-training-pilot/ops/trace.json` | 1 | E | Left byte-identical. Completed-retained packet record (ops/trace.json). |
| `goals/skillopt-training-pilot/research/SOURCES.md` | 7 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/skillopt-training-pilot/research/p23-contract.md` | 9 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/time-to-certainty/research/c3-sublane-inputs.md` | 2 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/time-to-certainty/research/economics-close.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/time-to-certainty/research/economics.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/annotated-input-coverage.json` | 3 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `harness-ledger/rows/2026-09.jsonl` | 12 | E | Left byte-identical. Append-only harness ledger rows (pilot reruns and tombstones). |
| `harness-ledger/rows/2026-10.jsonl` | 6 | E | Left byte-identical. Append-only harness ledger rows (pilot reruns and tombstones). |
| `packages/tooling/tool/cli/src/commands/AgentEffectiveness/AgentEffectiveness.command.ts` | 4 | N | Left untouched. Retained SkillOpt scorer (`SkillOptTaskManifest`, eval modules and their test); kept by the retirement record. |
| `packages/tooling/tool/cli/src/commands/AgentEffectiveness/AgentEffectiveness.errors.ts` | 1 | N | Left untouched. Retained SkillOpt scorer (`SkillOptTaskManifest`, eval modules and their test); kept by the retirement record. |
| `packages/tooling/tool/cli/src/commands/AgentEffectiveness/AgentEffectiveness.schemas.ts` | 25 | N | Left untouched. Retained SkillOpt scorer (`SkillOptTaskManifest`, eval modules and their test); kept by the retirement record. |
| `packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalFixture.ts` | 5 | N | Left untouched. Retained SkillOpt scorer (`SkillOptTaskManifest`, eval modules and their test); kept by the retirement record. |
| `packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalRecord.ts` | 8 | N | Left untouched. Retained SkillOpt scorer (`SkillOptTaskManifest`, eval modules and their test); kept by the retirement record. |
| `packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalScorer.ts` | 6 | N | Left untouched. Retained SkillOpt scorer (`SkillOptTaskManifest`, eval modules and their test); kept by the retirement record. |
| `packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalScoring.ts` | 3 | N | Left untouched. Retained SkillOpt scorer (`SkillOptTaskManifest`, eval modules and their test); kept by the retirement record. |
| `packages/tooling/tool/cli/src/commands/Qa/JudgeSkill.ts` | 7 | N | Left untouched. Case-insensitive collision: `QaJudgeSkillOptions` = `QaJudgeSkill` + `Options`. |
| `packages/tooling/tool/cli/src/commands/Qa/Qa.command.ts` | 2 | N | Left untouched. Case-insensitive collision: `QaJudgeSkillOptions` = `QaJudgeSkill` + `Options`. |
| `packages/tooling/tool/cli/test/agent-effectiveness-eval-scorer.test.ts` | 15 | N | Left untouched. Retained SkillOpt scorer (`SkillOptTaskManifest`, eval modules and their test); kept by the retirement record. |
| `packages/tooling/tool/cli/test/qa-judge-skill.test.ts` | 3 | N | Left untouched. Case-insensitive collision: `QaJudgeSkillOptions` = `QaJudgeSkill` + `Options`. |
| `standards/jsdoc-documentation.inventory.jsonc` | 4 | N | Left untouched. Generated rows for `SkillOptTaskManifest` (retained scorer) and `QaJudgeSkillOptions` (collision). |
| `standards/schema-catalog/@beep/repo-cli.generated.jsonc` | 7 | N | Left untouched. Generated catalog rows for the retained scorer schemas and `QaJudgeSkillOptions`. |

### Surface `impeccable`

58 files: L 0, E 55, N 3.

| File | Hits | Class | Disposition |
| --- | ---: | :---: | --- |
| `.gitignore` | 2 | N | Left untouched. `**/.impeccable/` ignores state written by the global Impeccable plugin (retirement record: Global-install state). |
| `beep-effect.iml` | 1 | N | Left untouched. `.impeccable` exclusion for the same git-ignored global-plugin state; restored on purpose by #2091's exclusion reconciliation. |
| `goals/codex-security-findings-2026-08-30/findings/CSF-001.md` | 20 | E | Left byte-identical. Dated security findings record. |
| `goals/codex-security-findings-2026-08-30/findings/INDEX.md` | 1 | E | Left byte-identical. Dated security findings record. |
| `goals/codex-security-findings-2026-08-30/ops/triage.json` | 20 | E | Left byte-identical. Dated security findings record. |
| `goals/codex-security-findings-2026-09-03/findings/CSF-005.md` | 2 | E | Left byte-identical. Dated security findings record. |
| `goals/codex-security-findings-2026-09-03/ops/triage.json` | 1 | E | Left byte-identical. Dated security findings record. |
| `goals/effect-vitest-canon/research/cli-property-boundaries-lineage.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/knowledge-freshness-audit/research/existing-capabilities.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/model-routing-sync/README.md` | 1 | E | Left byte-identical. Completed-retained packet record (README.md). |
| `goals/model-routing-sync/SPEC.md` | 3 | E | Left byte-identical. Completed-retained packet record (SPEC.md). |
| `goals/model-routing-sync/research/2026-09-22-00-aligned-design.md` | 3 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/model-routing-sync/research/2026-09-22-03-surface-census.md` | 3 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/model-routing-sync/research/2026-09-22-04-home-sweep.md` | 5 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/model-routing-sync/research/SOURCES.md` | 2 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/packet-convention-migration/research/OPPORTUNITIES.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/PLAN.md` | 7 | E | Left byte-identical. Completed-retained packet record (PLAN.md). |
| `goals/repository-simplification-confidence/SPEC.md` | 7 | E | Left byte-identical. Completed-retained packet record (SPEC.md). |
| `goals/repository-simplification-confidence/research/BRIEF-2026-10-09.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/OPPORTUNITIES.md` | 3 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/baseline-2026-10-09.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/A-retained-tools.md` | 8 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/A-retire.md` | 45 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/B-inline-suppressions.md` | 15 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/B-skills-stale-api.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/C-ownership-facts.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/E-github.md` | 3 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/INDEX.md` | 7 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/README.md` | 2 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-residue/SPEC.md` | 3 | E | Left byte-identical. Dated #1851 context and the 2026-10-17 retirement Decision Log rows of this packet. |
| `goals/time-to-certainty/research/c3-sublane-inputs.md` | 13 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/time-to-certainty/research/economics-close.json` | 2 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/time-to-certainty/research/economics.json` | 2 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/todox-marketing-site/GOAL.md` | 3 | E | Left byte-identical. Completed-retained packet record (GOAL.md). |
| `goals/todox-marketing-site/PLAN.md` | 6 | E | Left byte-identical. Completed-retained packet record (PLAN.md). |
| `goals/todox-marketing-site/README.md` | 2 | E | Left byte-identical. Completed-retained packet record (README.md). |
| `goals/todox-marketing-site/SPEC.md` | 8 | E | Left byte-identical. Completed-retained packet record (SPEC.md). |
| `goals/todox-marketing-site/research/SOURCES.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/adoption/census.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/alias-file-open-review.json` | 3 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/annotated-input-coverage.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/command-groups-current.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/command-groups-dependency-edge.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/command-groups-ignore-repair.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/command-groups-installed-launcher.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/command-groups-installed-v3.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/command-groups-lane-merge.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/command-groups-pilot.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/command-groups-post-main.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/command-groups-post-merge.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/command-groups-runtime-key.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/command-groups-runtime-routing.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/command-groups.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/executable-census.json` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/impeccable-root-script-baseline-request.json` | 2 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/impeccable-root-script-baseline-review.md` | 3 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/turborepo-task-qualification/research/root-command-boundaries.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `packages/tooling/tool/cli/src/commands/Models/Models.seed.ts` | 8 | N | Left untouched. The four `home.agents.impeccable.*` seats point at `$HOME/.agents/skills/impeccable/...`: global plugin, owned by workstream F (F-CLAUDE). |

### Surface `\.agents/plugins`

6 files: L 0, E 6, N 0.

| File | Hits | Class | Disposition |
| --- | ---: | :---: | --- |
| `goals/codex-security-findings-2026-07-08/findings/CSF-003.md` | 3 | E | Left byte-identical. Dated security findings record. |
| `goals/codex-security-findings-2026-07-08/ops/triage.json` | 3 | E | Left byte-identical. Dated security findings record. |
| `goals/knowledge-freshness-audit/research/SOURCES.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/A-retire.md` | 3 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-residue/SPEC.md` | 1 | E | Left byte-identical. Dated #1851 context and the 2026-10-17 retirement Decision Log rows of this packet. |
| `goals/unified-ai-toolchain/research/claude-web-source-map.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |

### Surface `marketplace\.json`

13 files: L 0, E 5, N 8.

| File | Hits | Class | Disposition |
| --- | ---: | :---: | --- |
| `apps/practice-claude-mod/src/build-plugin.ts` | 2 | N | Left untouched. The practice mod's own build output `dist/.claude-plugin/marketplace.json`. |
| `goals/agent-pool-doctrine/research/SOURCES.md` | 2 | N | Left untouched. Cursor plugin documentation describing the vendor `marketplace.json` format. |
| `goals/agent-pool-picker/research/SOURCES.md` | 2 | N | Left untouched. Cursor plugin documentation describing the vendor `marketplace.json` format. |
| `goals/codex-security-findings-2026-07-08/findings/CSF-003.md` | 3 | E | Left byte-identical. Dated security findings record. |
| `goals/codex-security-findings-2026-07-08/ops/triage.json` | 3 | E | Left byte-identical. Dated security findings record. |
| `goals/knowledge-freshness-audit/research/SOURCES.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/practice-claude-mod/SPEC.md` | 1 | N | Left untouched. The practice mod's own `dist/marketplace/.claude-plugin/marketplace.json`. |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/A-retire.md` | 3 | E | Left byte-identical. Goal research/data snapshot (research/). |
| `goals/repository-simplification-residue/SPEC.md` | 1 | E | Left byte-identical. Dated #1851 context and the 2026-10-17 retirement Decision Log rows of this packet. |
| `goals/unified-ai-toolchain/research/claude-web-source-map.md` | 4 | N | Left untouched. Vendor plugin manifest formats and the SchemaStore marketplace schema URL. |
| `goals/unified-ai-toolchain/research/sources-of-truth.md` | 2 | N | Left untouched. Vendor plugin manifest formats and the SchemaStore marketplace schema URL. |
| `packages/tooling/library/ai-sync/src/_generated/source-metadata.gen.ts` | 1 | N | Left untouched. SchemaStore `claude-code-marketplace.json` schema URL (vendor source map and its generated metadata). |
| `packages/tooling/library/ai-sync/src/source-map.ts` | 1 | N | Left untouched. SchemaStore `claude-code-marketplace.json` schema URL (vendor source map and its generated metadata). |

### Surface `sst\.config`

1 files: L 0, E 1, N 0.

| File | Hits | Class | Disposition |
| --- | ---: | :---: | --- |
| `goals/repository-simplification-confidence/research/sweeps/2026-10-09/A-retire.md` | 1 | E | Left byte-identical. Goal research/data snapshot (research/). |

### Surface `"sst"`

1 files: L 0, E 0, N 1.

| File | Hits | Class | Disposition |
| --- | ---: | :---: | --- |
| `packages/foundation/modeling/html/src/internal/Html.language-tag-registry.generated.ts` | 1 | N | Left untouched. IANA language subtag `sst` (Sinasina) in the generated language-tag registry. |

Binary, outside the `-I` census:

| File | Hits | Class | Disposition |
| --- | ---: | :---: | --- |
| `apps/todox/src/app/opengraph-image.png` | 1 | N | Left untouched. The PNG `tEXt` key `impeccable:prompt` comes from asset generation. |

## Post-fix re-run

I ran the same census command again after this lane's packet edits. Its output
is byte-identical to the census at base (`diff` empty). This receipt sits under
`history/`, and the SPEC, PLAN, README and manifest sentences avoid the six
patterns, so no count moved. All 194 surface-file classifications have the same disposition.
Surfaces overlap, so the base census contains 167 unique matching text files (168 with the one
binary PNG) and 1,056 summed matching lines (1,057 with the PNG).

| Surface | Surface-file classifications | L | E | N |
| --- | ---: | ---: | ---: | ---: |
| `skillopt` | 115 | 0 | 98 | 17 |
| `impeccable` | 58 (+1 binary) | 0 | 55 | 3 (+1) |
| `\.agents/plugins` | 6 | 0 | 6 | 0 |
| `marketplace\.json` | 13 | 0 | 5 | 8 |
| `sst\.config` | 1 | 0 | 1 | 0 |
| `"sst"` | 1 | 0 | 0 | 1 |

Zero (L) hits on every surface.

## Acceptance

Every retired surface has zero (L) hits in the current tracked-consumer census.
#1851's acceptance is met. Its prior proofs are the owner regeneration in
#1898/#1900 (skills lock, Codex config, Biome identity profile, `bun.lock`) and
their package gates and hosted proof. This lane changed only packet Markdown and
the packet manifest. It adds no S31 inventory, baseline or exception row.

Reversal: revert this PR. It touches only this receipt and the packet's SPEC,
PLAN, README and `ops/manifest.json`, so the workstream returns to `pending`.
