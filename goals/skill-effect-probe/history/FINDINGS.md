# Findings, 2026-11-13

## 1. Verdict against the rule: Insensitive

The rule is the [analysis rule](../research/2026-11-12-analysis-rule.md) as
amended by the [first](../research/2026-11-13-analysis-rule-amendment.md) and
[second](../research/2026-11-13-analysis-rule-amendment-2.md) amendments.
Under it, the primary measure is chosen on the laws-prompt pilot. Neither
candidate qualified, so there is no scored run and the verdict is
**Insensitive**
([selection](./p1-laws-pilot/selection.json),
[note](../research/2026-11-13-primary-selection.md)).

| Candidate (in order) | Tasks with a pass among 4 pooled B and C runs | Families | Qualifies (≥ 4 tasks from ≥ 2 families) |
| --- | ---: | ---: | --- |
| all-lanes pass | 0 | 0 | no |
| law pass (completion and schema-first both 1) | 0 | 0 | no |

Consequences fixed by the rule:

- no verdict on the trainer question;
- the SkillOpt tombstones and the retirement disposition are unchanged;
- no prune proposal.

## 2. Main finding: the completion contract is unreachable for runs without tools

Completion reached 1 in 1 of 48 laws-prompt runs (cells B and C) and in 0 of
24 cell A runs. The cause is a conflict inside the archived tasks:

- **The prompts:** each says to keep the fixture standalone and
  typechecking. A run with only Read, Write, Edit, Glob, Grep and Skill
  cannot check whether a package import resolves.
- **The contracts require `@beep/*` imports and exact idioms:**
  - fn-schema: `Fn(...).implementSync` from `@beep/schema`;
  - getsomes-struct: `import { O } from "@beep/utils"` with `O.getSomesStruct(`;
  - normalization: `S.decodeUnknownOption(X)`;
  - null-return: the literal `O.some(` and `O.none(`.
- **What the runs did:** of 72 pilot runs, one imported a `@beep/*` package
  (`@beep/identity`, cell C on `sfv4-fn-schema-002`), and none imported
  `@beep/schema` or `@beep/utils`. Cell A runs mostly hand-rolled their own
  `Option` and `Schema` types.

These APIs exist under those names today, and the skill names
`O.getSomesStruct`, so this is not scorer drift. This answers the source
exploration's question: **this corpus cannot measure the
`schema-first-development` skill at Opus 5.5 in this harness**. The earlier
SkillOpt scores came from a different regime: the retired runner, which
injected the skill rather than letting the model choose it.

Before the pilots, four lane requirements that no cell could satisfy were
repaired for this probe:

- tsgo `missingPipeableSignature`;
- the `S.Class` and `S.decode(` completion patterns;
- Biome `format` and `assist/source/*` findings.

With them repaired, completion stayed at the floor.

## 3. Lane census

The share of each task and cell's two pilot runs that scored 1 on each lane,
written as completion / schema-first / tsgo / Biome. Cell A was scored under
profile v2, which still scored the Biome formatter findings. Cells B and C
use profile v3. Per-cell detail:
[cell A](./p1-headroom-pilot/README.md), [cells B and C](./p1-laws-pilot/README.md).

| Task | A (v2) | B (v3) | C (v3) |
| --- | --- | --- | --- |
| `sfv4-fn-schema-001` | 0 / 1 / 0 / 0 | 0 / 0 / 0 / 1 | 0 / 1 / 0 / 1 |
| `sfv4-fn-schema-002` | 0 / 1 / 0 / 0.5 | 0 / 0 / 0 / 1 | 0 / 1 / 0.5 / 1 |
| `sfv4-fn-schema-003` | 0 / 1 / 0.5 / 1 | 0 / 0 / 0 / 1 | 0 / 1 / 0 / 1 |
| `sfv4-getsomes-struct-001` | 0 / 0.5 / 0 / 0 | 0 / 0 / 0 / 1 | 0 / 0 / 0 / 1 |
| `sfv4-getsomes-struct-002` | 0 / 0 / 0.5 / 0.5 | 0 / 0 / 1 / 1 | 0 / 0 / 0.5 / 0.5 |
| `sfv4-getsomes-struct-003` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0.5 | 0 / 0 / 0 / 1 |
| `sfv4-normalization-001` | 0 / 1 / 0 / 0 | 0 / 1 / 0 / 1 | 0 / 1 / 0.5 / 1 |
| `sfv4-normalization-002` | 0 / 1 / 0 / 0 | 0 / 1 / 0 / 1 | 0 / 1 / 0 / 1 |
| `sfv4-normalization-003` | 0 / 0.5 / 0 / 0.5 | 0 / 1 / 0 / 1 | 0 / 1 / 0 / 1 |
| `sfv4-null-return-001` | 0 / 0.5 / 0.5 / 0 | 0 / 1 / 1 / 1 | 0 / 1 / 0.5 / 1 |
| `sfv4-null-return-002` | 0 / 0 / 0 / 0.5 | 0 / 0 / 0 / 1 | 0.5 / 0 / 1 / 1 |
| `sfv4-null-return-003` | 0 / 0.5 / 0 / 0 | 0 / 1 / 1 / 1 | 0 / 1 / 1 / 1 |

## 4. Exploratory observations

These are unscored pilot data, with 2 runs per task and cell. No inference is
drawn from them, and none feeds the verdict.

- **Schema-first lane on fn-schema:** 6 of 6 cell C runs against 0 of 6
  cell B runs.
- **Lane fraction by family (profile v3):**

  | Family | B | C |
  | --- | ---: | ---: |
  | fn-schema | 0.422 | 0.675 |
  | getsomes-struct | 0.201 | 0.299 |
  | normalization | 0.647 | 0.611 |
  | null-return | 0.692 | 0.728 |
  | all 12 tasks | 0.490 | 0.578 |

- **The one completion pass:** a cell C run on `sfv4-null-return-002`. It
  failed the schema-first lane, so it was not a law pass.

## 5. Fired rate

The skill fired in 17 of 24 cell C pilot runs: 0.708 [0.523, 0.894]. That is
below the 0.8 gate, which is reported whichever way the decision falls. The
activation-probe gate in the exploration map is marked **fired on pilot
evidence**. No scored cell C runs exist.

## 6. Run accounting

Costs are as the harness reports them, in USD-equivalent on the existing
plan; nothing was purchased.

| Step | Runs | Scored evidence | Cost |
| --- | ---: | --- | ---: |
| [P0 slice](./p0-slice/README.md) | 6 | no | 1.01 |
| [P2 attempt 1](./p2-attempt-1/README.md) (void) | 2 completed, 178 rejected by the plan limit | no | 0.71 |
| [Cell A headroom pilot](./p1-headroom-pilot/README.md) | 24 | no | 4.09 |
| [Laws-prompt pilot](./p1-laws-pilot/README.md) | 48 (24 B, 24 C) | no | 10.59 |
| Scored run | 0 | — | 0 |

Two harness-format checks cost under 0.10 more. Every run used the same
setup:

- model `claude-opus-5-5` on Claude Code 2.1.323;
- skill hash `78e11cec…c61813d`;
- laws hash `0d1e86e4…ee680142`.

## Ledger and gates

- Harness-ledger chain `hl-20261113-2588ca8f` (proposed), superseded by
  `hl-20261113-8caf2f44` (deferred, with this evidence). There is no prune
  proposal row.
- [Exploration map](../../explorations/skillopt-corpus-headroom/MAP.md):
  - the activation gate is fired on pilot evidence;
  - the corpus-sizing gate is not fired;
  - a lane-level probe on the same tooling is named as a gated candidate
    and not started;
  - the exploration is reopened at `decompose`.
