# Analysis rule amendment, 2026-11-13

Amends [`2026-11-12-analysis-rule.md`](./2026-11-12-analysis-rule.md), which
stays as written. Committed before the first scored run record: no run record
exists in `history/` at this commit. Where the two files disagree, this one
holds. Source: the packet author's design review of 2026-11-13, which
authorised the Decision Rule change in `SPEC.md`.

## Why

All six P0 runs scored 0 on the primary measure in every cell. Part of that
floor is scorer drift: lane requirements the corpus never stated, which no
cell could see. A null measured at a floor the scorer created says nothing
about the skill. This amendment repairs that drift for this probe only, adds
an outcome for a measure that cannot move, and fixes the run configuration.

## Scorer profile `skill-probe-scorer/v2`

Every run record carries `scorerProfile`. The probe scores with the shared
law scorer plus these repairs, implemented in
`packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/SkillProbe.ts`
(`repairSkillProbeTask`, `IGNORED_TSGO_RULES`). The shared `evals score`
command is unchanged. Task prompts, the skill and the planted violations are
untouched.

A drift item is a lane requirement that (a) postdates the corpus
(2026-07-06) or names an API that Effect has since renamed, and (b) is stated
by none of the task prompt, the Code Laws text or the skill.

| Item | Evidence | Repair |
| --- | --- | --- |
| tsgo `missingPipeableSignature` (TS377101) | Enabled 2026-08-10 (#639). Stated by none of the prompt, the laws or the skill. Hit in all six P0 runs and in the natural known-good answer. | Ignored in the tsgo lane. |
| `extends\s+S\.Class\b` in the six fn-schema and getsomes-struct tasks | The skill made branded `S.Opaque` the default for plain data on 2026-10-14 (#1758); the schema-first lint scores a data-only `S.Class` below 1. A run that follows the skill fails completion. | The pattern also accepts `extends S.Opaque`. |
| `S\.decode\s*\(` in the three normalization tasks | The skill teaches `S.decodeTo(...)` with `SchemaTransformation` (since 2026-05-01, so this item fails test (a); it is repaired as an author's call). A P0 cell C run that followed the skill wrote `S.decodeTo(..., SchemaTransformation.trim())` and missed the pattern. Both APIs exist; the regex rejects the skill's own idiom and biases the primary measure against cell C. | The pattern also accepts `S.decodeTo(`. |

Not drift, kept as scored: tsgo `schemaSync` (enabled 2026-09-23, but the
skill forbids `S.decodeSync`), tsgo `preferEffectString` (the Code Laws
prefer Effect helper modules over native helpers), and the
`S.decodeUnknownOption(X)` completion patterns (the API exists and is
unchanged).

Preflight was rerun under this profile: 12 of 12 pass
([`history/preflight.json`](../history/preflight.json)).

## Run configuration

Records compare only within this configuration.

| Setting | Value |
| --- | --- |
| Model | `claude-opus-5-5` via `--model` |
| Claude Code | The installed version at run time, recorded per run; the report lists every distinct fingerprint, and a version change mid-run is reported, not mixed silently |
| Tools | Read, Write, Edit, Glob, Grep, Skill; `--allow-tools Write Edit` |
| Budgets | `max_turns: 40`, `timeout_seconds: 900`, `--max-cost-usd` on every invocation |
| Runs | 5 per task and cell |
| Cell A | `sep-empty` plugin (no skills), archived prompt, `--ablation none` |
| Cells B and C | `sep-skill` plugin, laws prompt, `--ablation with-without`; `without` is B, `with` is C |
| Concurrency | 2 |

## Exclusion and rerun cap

The exclusion rules of the 2026-11-12 file stand. Each excluded run is rerun
at most twice. At most 216 scored-run attempts in total (counted and
excluded records together). P0, the headroom pilot and the voided first P2
attempt are outside that count and stay unscored.

## Headroom pilot and go or no-go

Before the scored run: cell A only, 12 tasks by 2 runs, under profile v2,
unscored, recorded under `history/p1-headroom-pilot/` with its lane census
(per task and lane, the pass rate and the diagnostics or completion patterns
each run missed). Cell A only, so the C minus B contrast stays unseen.

If the pilot has no all-lanes pass in cell A on more than 8 of the 12 tasks,
the scored run does not start; the lane census goes to the packet author.
Otherwise the scored run starts without waiting.

## Decision, replacing the 2026-11-12 Decision section

Checked in this order:

1. **Insensitive** when fewer than 4 counted tasks have at least one
   all-lanes pass among their B and C runs. No verdict on the trainer
   question, no prune proposal; the findings carry the lane census. A task
   every run passes is not insensitive: that is evidence the skill is not
   needed.
2. **Effect** when the overall all-lanes difference C minus B is at least
   0.10 and the lower end of its clustered interval is above 0. The source
   exploration reopens at `decompose`.
3. **Null** otherwise. The trainer question closes for lint-enforceable
   skills, the tombstones stay, and the findings carry a prune proposal.
   When the clustered interval on C minus B lies wholly below zero, the Null
   is reported as **harm**, and the prune proposal says so.

The fired-rate gate (below 0.8 of counted cell C runs) is reported whichever
way the decision falls. The report carries a lane census per task and cell
beside the measures.
