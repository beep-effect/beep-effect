# Laws-prompt pilot, cells B and C, 2026-11-13

One `--ablation with-without` invocation of the laws prompt against the skill
plugin: 12 tasks by 2 runs, 24 cell B (`without`) and 24 cell C (`with`)
runs. Opus 5.5 (`claude-opus-5-5`), Claude Code 2.1.323, scorer profile
`skill-probe-scorer/v3`, the run configuration of the
[first amendment](../../research/2026-11-13-analysis-rule-amendment.md).
Unscored and outside the 216-attempt cap, under
[amendment 2](../../research/2026-11-13-analysis-rule-amendment-2.md).
Records: [`runs.jsonl`](./runs.jsonl); selection:
[`selection.json`](./selection.json); report: [`report.json`](./report.json).
Cost 10.59 USD-equivalent; 48 counted runs, none excluded.

## Primary selection: neither candidate qualifies

| Candidate | Tasks with a pooled B or C pass | Families | Qualifies |
| --- | ---: | ---: | --- |
| all-lanes pass | 0 | 0 | no |
| law pass (completion and schema-first) | 0 | 0 | no |

No B or C run met its task's completion contract, so neither candidate
passed even once. Under amendment 2 there is no scored run, and the
verdict is Insensitive from this pilot.

## Lane census (share of the task and cell's 2 runs scoring 1 on the lane)

| Task | Cell | Completion | Schema-first | tsgo | Biome | Law pass | All lanes | Lane fraction | Fired |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `sfv4-fn-schema-001` | B | 0 | 0 | 0 | 1 | 0 | 0 | 0.416667 | 0/2 |
| `sfv4-fn-schema-001` | C | 0 | 1 | 0 | 1 | 0 | 0 | 0.625 | 2/2 |
| `sfv4-fn-schema-002` | B | 0 | 0 | 0 | 1 | 0 | 0 | 0.466667 | 0/2 |
| `sfv4-fn-schema-002` | C | 0 | 1 | 0.5 | 1 | 0 | 0 | 0.733333 | 2/2 |
| `sfv4-fn-schema-003` | B | 0 | 0 | 0 | 1 | 0 | 0 | 0.383333 | 0/2 |
| `sfv4-fn-schema-003` | C | 0 | 1 | 0 | 1 | 0 | 0 | 0.666666 | 2/2 |
| `sfv4-getsomes-struct-001` | B | 0 | 0 | 0 | 1 | 0 | 0 | 0.184375 | 0/2 |
| `sfv4-getsomes-struct-001` | C | 0 | 0 | 0 | 1 | 0 | 0 | 0.381944 | 2/2 |
| `sfv4-getsomes-struct-002` | B | 0 | 0 | 1 | 1 | 0 | 0 | 0.208333 | 0/2 |
| `sfv4-getsomes-struct-002` | C | 0 | 0 | 0.5 | 0.5 | 0 | 0 | 0.177083 | 0/2 |
| `sfv4-getsomes-struct-003` | B | 0 | 0 | 0 | 0.5 | 0 | 0 | 0.210194 | 0/2 |
| `sfv4-getsomes-struct-003` | C | 0 | 0 | 0 | 1 | 0 | 0 | 0.338542 | 2/2 |
| `sfv4-normalization-001` | B | 0 | 1 | 0 | 1 | 0 | 0 | 0.694444 | 0/2 |
| `sfv4-normalization-001` | C | 0 | 1 | 0.5 | 1 | 0 | 0 | 0.666667 | 2/2 |
| `sfv4-normalization-002` | B | 0 | 1 | 0 | 1 | 0 | 0 | 0.691358 | 0/2 |
| `sfv4-normalization-002` | C | 0 | 1 | 0 | 1 | 0 | 0 | 0.691358 | 1/2 |
| `sfv4-normalization-003` | B | 0 | 1 | 0 | 1 | 0 | 0 | 0.555556 | 0/2 |
| `sfv4-normalization-003` | C | 0 | 1 | 0 | 1 | 0 | 0 | 0.475309 | 2/2 |
| `sfv4-null-return-001` | B | 0 | 1 | 1 | 1 | 0 | 0 | 0.8 | 0/2 |
| `sfv4-null-return-001` | C | 0 | 1 | 0.5 | 1 | 0 | 0 | 0.733333 | 1/2 |
| `sfv4-null-return-002` | B | 0 | 0 | 0 | 1 | 0 | 0 | 0.575 | 0/2 |
| `sfv4-null-return-002` | C | 0.5 | 0 | 1 | 1 | 0 | 0 | 0.749999 | 0/2 |
| `sfv4-null-return-003` | B | 0 | 1 | 1 | 1 | 0 | 0 | 0.7 | 0/2 |
| `sfv4-null-return-003` | C | 0 | 1 | 1 | 1 | 0 | 0 | 0.7 | 1/2 |

## What blocked completion

Completion was 1 in only 1 of 48 runs (a cell C run on
`sfv4-null-return-002`), and that run failed schema-first. Grouped by family:

- **fn-schema (3 tasks):** every run missed `Fn(...)` and `.implementSync(`
  from `@beep/schema`; cell B also missed the `extends S.Class|S.Opaque`
  input class.
- **getsomes-struct (3 tasks):** every run missed
  `import { O } from "@beep/utils"` and `O.getSomesStruct(`; several still
  used the forbidden `R.getSomes` from `effect/Record`.
- **normalization (3 tasks):** every run missed
  `S.decodeUnknownOption(X)`; on `-001` and `-003` most runs also missed the
  `SchemaTransformation` call the task names.
- **null-return (3 tasks):** most runs returned absence through other
  `Option` helpers and missed the literal `O.none(` pattern, and on `-001`
  and `-003` the `O.some(` pattern too.

One run imported a `@beep/*` package (`@beep/identity`, cell C on `sfv4-fn-schema-002`); none imported `@beep/schema` or `@beep/utils`. Each prompt that names its
contract also says to keep the fixture standalone and typechecking, and a
run without tools cannot check that a `@beep/*` import resolves. Both
`Fn` (`packages/foundation/modeling/schema/src/Fn/Fn.schema.ts`) and
`O.getSomesStruct` (`packages/foundation/modeling/utils/src/Option.ts`)
exist under those names today, and the skill names `O.getSomesStruct`, so
this is not scorer drift by the first amendment's test.

## Fired rate

The skill fired in 17 of 24 cell C runs: 0.708 [0.523, 0.894]. That is below
the 0.8 gate, which is reported whichever way the decision falls.
