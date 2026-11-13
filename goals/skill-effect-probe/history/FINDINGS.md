# Findings, 2026-11-13

## Verdict: Insensitive

Under the decision rule as amended
([amendment](../research/2026-11-13-analysis-rule-amendment.md),
[amendment 2](../research/2026-11-13-analysis-rule-amendment-2.md)), neither
primary candidate qualified on the laws-prompt pilot: no task had a single
all-lanes pass or law pass among its 4 pooled B and C runs
([selection](./p1-laws-pilot/selection.json),
[note](../research/2026-11-13-primary-selection.md)). There is no scored
run, and the verdict is Insensitive.

**This corpus cannot measure the `schema-first-development` skill at Opus
5.5 without tools.**

Consequences, as the rule fixes them:

- No verdict on the trainer question. The SkillOpt tombstones and the
  retirement disposition are unchanged.
- No prune proposal for the skill.
- The source exploration's map records the outcome; see "Gates" below.

## Evidence

| Step | Runs | Cells | Profile | Result |
| --- | ---: | --- | --- | --- |
| [P0 slice](./p0-slice/README.md) | 6 | A, B, C on one task | v1 | Pipeline proven; run-to-kept-directory mapping through `tracePath`; all six runs at 0 on all-lanes. |
| [Preflight](./preflight.json) | — | — | v3 | 12 of 12 tasks pass: each untouched fixture fails its task and each known-good solution scores 1 on every lane. |
| [P2 attempt 1](./p2-attempt-1/README.md) | 180 requested | A, B, C | v1 | Void: 178 runs ended on the seven-day plan limit; 2 completed runs left unscored. |
| [Cell A headroom pilot](./p1-headroom-pilot/README.md) | 24 | A | v2 | No-go: 0 of 12 tasks with an all-lanes pass; completion 0 in every run. Judged the wrong proxy, because the bare prompt names no package. |
| [Laws-prompt pilot](./p1-laws-pilot/README.md) | 48 | B, C | v3 | 0 of 12 tasks with an all-lanes or law pass; completion 1 in 1 of 48 runs. |

The model, Claude Code version and skill and laws hashes were the same for
every pilot run: `claude-opus-5-5`, 2.1.323, skill
`78e11cec…c61813d`, laws `0d1e86e4…ee680142`.

## Why the measure cannot move

The completion contract of every task names repository APIs that a run must
import from `@beep/*` packages or spell exactly: `Fn(...).implementSync`
from `@beep/schema` (fn-schema), `import { O } from "@beep/utils"` and
`O.getSomesStruct` (getsomes-struct), `S.decodeUnknownOption(X)`
(normalization), and the literal `O.some(` and `O.none(` (null-return). Of
the 72 pilot runs, one imported a `@beep/*` package (`@beep/identity`, in a
cell C fn-schema run) and none imported `@beep/schema` or `@beep/utils`. Each prompt that
names a contract also says to keep the fixture standalone and typechecking,
and with Read, Write, Edit, Glob, Grep and Skill only, a run cannot check
whether such an import resolves. The APIs exist under those names today and
the skill names `O.getSomesStruct`, so this is a property of the corpus and
the toolless run configuration, not scorer drift.

Three scorer-drift items and one formatter-only floor were repaired for this
probe before the pilot ([amendment](../research/2026-11-13-analysis-rule-amendment.md),
[amendment 2](../research/2026-11-13-analysis-rule-amendment-2.md)): tsgo
`missingPipeableSignature`, the `S.Class` and `S.decode(` patterns, and the
Biome `format` and `assist/source` findings. With them, Biome passed in
most B and C runs and schema-first passed in both runs of 8 of 12 cell C tasks. The
completion lane stayed at the floor.

## Secondary measures (pilot, descriptive)

Two runs per task and cell. These are not a test of C against B: the rule
reads only pooled passes from the pilot, and no scored run followed.

| Family | B lane fraction | C lane fraction |
| --- | ---: | ---: |
| fn-schema | 0.422 | 0.675 |
| getsomes-struct | 0.201 | 0.299 |
| normalization | 0.647 | 0.611 |
| null-return | 0.692 | 0.728 |
| all 12 tasks | 0.490 | 0.578 |

Per task and cell means with intervals, turns and wall seconds are in the
[pilot report](./p1-laws-pilot/report.json) and its
[lane census](./p1-laws-pilot/README.md). Cell A was piloted under profile
v2 and is not comparable with these numbers.

## Fired rate

The skill fired in 17 of 24 cell C pilot runs: 0.708 [0.523, 0.894]. The rule
reports the fired-rate gate whichever way the decision falls. The rate is
below 0.8, so the gate fires: activation is a measurable problem for this
skill's description on these prompts, independent of the Insensitive
verdict.

## Gates

- **Activation probe (`skill-activation-probe`):** fired by the fired rate
  above. The exploration map marks it and the exploration reopens at
  `decompose`.
- **Corpus sizing (`skill-corpus-sizing`):** not fired; no effect was
  measured.
- **A re-run of this probe** would need a corpus whose prompts name the
  packages their contracts require, or a run configuration that gives the
  agent a type checker. Either is a new goal decision, not a rerun of this
  one.

## Ledger

The Insensitive verdict is recorded as a harness-ledger chain: a `proposed`
row for the hypothesis, superseded by a `deferred` disposition that carries
this evidence and the condition to resume. No prune proposal row is written.
