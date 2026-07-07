# SkillOpt P2 Corpus Derivation

## Inventory Survey

`standards/schema-first.inventory.jsonc` was surveyed with:

```sh
rg -o '"ruleId"\s*:\s*"[^"]+"' standards/schema-first.inventory.jsonc | sed 's/.*"\(SFV4-[^"]*\)"/\1/' | sort | uniq -c | sort -nr
```

Observed rule frequency:

| Rule class | Count |
| --- | ---: |
| SFV4-getsomes-struct | 113 |
| SFV4-fn-schema | 22 |
| SFV4-null-return | 15 |
| SFV4-normalization | 13 |
| SFV4-arbitrary-tests | 13 |
| SFV4-precision-audit | 1 |

This corpus uses four rule classes, with three tasks each, balanced across train and validation.

## Task Derivation

| Task id | Rule class | Inventory citation | Why baseline-failing-but-patchable |
| --- | --- | --- | --- |
| sfv4-fn-schema-001 | SFV4-fn-schema | `packages/drivers/ffmpeg/src/FFmpeg.service.ts:330 ruleId SFV4-fn-schema` | The stub exports a plain `interface` input and uncontracted helper. Completion requires a schema-owned class and `Fn` contract, which the skill teaches directly. |
| sfv4-fn-schema-002 | SFV4-fn-schema | `packages/drivers/ffmpeg/src/FFmpeg.service.ts:382 ruleId SFV4-fn-schema` | The stub uses a type literal for extract-frame options and an uncontracted argument builder. A rollout can patch it by moving the input/output shape into schemas and wrapping the helper with `Fn`. |
| sfv4-fn-schema-003 | SFV4-fn-schema | `packages/tooling/tool/cli/src/commands/SyncDataToTs/internal/Source.ts:125 ruleId SFV4-fn-schema` | The stub duplicates metadata input/output as interfaces. The fix is local and mechanical: convert them to schema classes and export an executable constructor contract. |
| sfv4-getsomes-struct-001 | SFV4-getsomes-struct | `apps/oip-web/src/contact/ContactSubmission.model.ts:233 ruleId SFV4-getsomes-struct` | The stub compacts an inline Option object through `R.getSomes` and uses an interface payload. The skill can replace it with a schema class plus the shape-preserving Option utility. |
| sfv4-getsomes-struct-002 | SFV4-getsomes-struct | `packages/drivers/box/src/Box.errors.ts:177 ruleId SFV4-getsomes-struct` | The stub uses a typed escape hatch around heterogeneous Option values. The failure is patchable by preserving literal keys through the repo utility and making the diagnostic detail shape schema-owned. |
| sfv4-getsomes-struct-003 | SFV4-getsomes-struct | `packages/drivers/runpod/src/Runpod.service.ts:580 ruleId SFV4-getsomes-struct` | The stub repeats the heterogeneous Option compaction smell for pod diagnostics. The intended repair is the same transferable rule over a different domain. |
| sfv4-normalization-001 | SFV4-normalization | `packages/tooling/tool/cli/src/commands/Corpus/Corpus.service.ts:879 ruleId SFV4-normalization` | The stub lowercases extensions inside the helper body. The patch moves canonicalization into an exported schema decoder while preserving helper behavior. |
| sfv4-normalization-002 | SFV4-normalization | `packages/drivers/ecfr/scripts/generate.ts:124 ruleId SFV4-normalization` | The stub uppercases operation codes directly. The fix is schema-local normalization via a decoder path, which is exactly the reusable skill rule. |
| sfv4-normalization-003 | SFV4-normalization | `packages/foundation/modeling/html/scripts/generate.ts:174 ruleId SFV4-normalization` | The stub trims generated text in the helper body. A rollout can patch it by exporting a normalized schema and decoder without needing external context. |
| sfv4-null-return-001 | SFV4-null-return | `packages/foundation/modeling/identity/src/Curie.ts:91 ruleId SFV4-null-return` | The stub returns `null` for CURIE expansion misses and uses no schema-derived guard. The patch is local: export a schema, derive the guard, and return explicit absence. |
| sfv4-null-return-002 | SFV4-null-return | `packages/tooling/library/repo-utils/src/JSDoc/models/JSDocTagAnnotation.model.ts:69 ruleId SFV4-null-return` | The stub returns `undefined` for missing metadata. The task is patchable by deriving known-tag validation from a schema and returning an explicit absence type. |
| sfv4-null-return-003 | SFV4-null-return | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts:620 ruleId SFV4-null-return` | The stub returns `undefined` for absent summary text and trims imperatively. The completion checks require an explicit absence return and schema-derived guard, not a bigger refactor. |

## Split Balance

| Split | Items | Rule coverage |
| --- | ---: | --- |
| train | 8 | 2 each of `SFV4-fn-schema`, `SFV4-getsomes-struct`, `SFV4-normalization`, `SFV4-null-return` |
| val | 4 | 1 each of `SFV4-fn-schema`, `SFV4-getsomes-struct`, `SFV4-normalization`, `SFV4-null-return` |
| test | 0 | Empty per P2/P3 contract allowance |

## BenchmarkCase Notes

`benchmark-cases.json` contains one `BenchmarkCase`-shaped row per task:

- `benchmarkCaseId`: task id.
- `expectedChecks`: standalone fixture `tsgo` command plus the future scorer command shape.
- `promptHash`: sha256 over the exact manifest `prompt` string.
- `promptRef`: manifest prompt pointer, not raw transcript content.
- `title`: short static title.

No `BenchmarkCase` field needed an unavailable static value, so no `null` placeholder fields were added.

## Fixture Typecheck Proof

Full proof logs:

- JSON validation: `goals/skillopt-training-pilot/corpus/.proofs/json-validation.log`
- Contract/hash consistency: `goals/skillopt-training-pilot/corpus/.proofs/contract-shape-check.log`
- Fixture typecheck: `goals/skillopt-training-pilot/corpus/.proofs/tsgo-all.log`
- Sensitive-data/local-path scan: `goals/skillopt-training-pilot/corpus/.proofs/sensitive-data-scan.log`

Two standalone fixture samples from the full `tsgo` proof:

```text
$ bunx --bun tsgo -p goals/skillopt-training-pilot/corpus/fixtures/sfv4-fn-schema-001/tsconfig.json
exit=0
$ bunx --bun tsgo -p goals/skillopt-training-pilot/corpus/fixtures/sfv4-getsomes-struct-003/tsconfig.json
exit=0
```

Command list used to check all fixtures:

```text
$ bunx --bun tsgo -p goals/skillopt-training-pilot/corpus/fixtures/sfv4-fn-schema-001/tsconfig.json
$ bunx --bun tsgo -p goals/skillopt-training-pilot/corpus/fixtures/sfv4-fn-schema-002/tsconfig.json
$ bunx --bun tsgo -p goals/skillopt-training-pilot/corpus/fixtures/sfv4-fn-schema-003/tsconfig.json
$ bunx --bun tsgo -p goals/skillopt-training-pilot/corpus/fixtures/sfv4-getsomes-struct-001/tsconfig.json
$ bunx --bun tsgo -p goals/skillopt-training-pilot/corpus/fixtures/sfv4-getsomes-struct-002/tsconfig.json
$ bunx --bun tsgo -p goals/skillopt-training-pilot/corpus/fixtures/sfv4-getsomes-struct-003/tsconfig.json
$ bunx --bun tsgo -p goals/skillopt-training-pilot/corpus/fixtures/sfv4-normalization-001/tsconfig.json
$ bunx --bun tsgo -p goals/skillopt-training-pilot/corpus/fixtures/sfv4-normalization-002/tsconfig.json
$ bunx --bun tsgo -p goals/skillopt-training-pilot/corpus/fixtures/sfv4-normalization-003/tsconfig.json
$ bunx --bun tsgo -p goals/skillopt-training-pilot/corpus/fixtures/sfv4-null-return-001/tsconfig.json
$ bunx --bun tsgo -p goals/skillopt-training-pilot/corpus/fixtures/sfv4-null-return-002/tsconfig.json
$ bunx --bun tsgo -p goals/skillopt-training-pilot/corpus/fixtures/sfv4-null-return-003/tsconfig.json
```
