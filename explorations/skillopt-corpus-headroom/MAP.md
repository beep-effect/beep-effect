# Map

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `skill-effect-probe` | Measure whether `schema-first-development` changes Opus 5.5 output on the 12 archived tasks, across bare, code-laws and code-laws-plus-skill cells, and return a verdict against a rule agreed in advance. | none | Law scorer and trial comparison in `packages/tooling/tool/cli/src/commands/AgentEffectiveness/`; run storage in `packages/tooling/library/ai-metrics`; ledger rows in `packages/tooling/tool/cli/src/commands/HarnessLedger/`; archived corpus in the goals archive; `claude plugin eval` as the runner. NET-NEW: eval cases and scaffold scripts, a plugin wrapper for the skill, kept-directory scoring glue, paired-difference arithmetic. |
| `skill-corpus-sizing` (gated) | Size and build a task corpus from the probe's measured effect and variance. | `skill-effect-probe` reports an effect that meets the rule | Same bricks, plus the probe's glue. NET-NEW: tasks mined from review findings and lint reds. |
| `procedural-skill-probe` (gated) | Repeat the probe for a procedural skill such as yeet or closeout. | `skill-effect-probe` lands its glue; the operator names a skill | Probe glue. NET-NEW: tasks and judge-model graders. |
| `skill-activation-probe` (gate fired 2026-11-13) | Measure whether repo skills fire on natural prompts. | gate fired on pilot evidence; decomposition deferred until `skill-lane-probe` reports a fired rate from scored runs | `claude plugin eval` native graders. NET-NEW: prompts per skill. Related parked packet: [`remote-skill-activation-conformance`](../remote-skill-activation-conformance/README.md). |
| `skill-lane-probe` (graduated 2026-11-13) | Measure whether `schema-first-development` changes Opus 5.5 lane-fraction scores on the 12 archived tasks, laws prompt with the skill against laws prompt without it, and return a verdict against a rule merged before any scored run. | `skill-effect-probe` (its tooling and scorer profile v3 are on `main`) | Probe commands and schemas in `packages/tooling/tool/cli/src/commands/AgentEffectiveness/` (the SkillProbe modules under its internal directory), the `probe stage`, `preflight`, `score` and `report` subcommands, scorer profile v3, ledger rows in `packages/tooling/tool/cli/src/commands/HarnessLedger/`, the archived corpus. NET-NEW: lane fraction as a selectable primary, a within-task permutation test with a fixed-task interval, the three-outcome verdict, an analysis rule. |

## Outcome of `skill-effect-probe`, 2026-11-13

- **Verdict: Insensitive.** On the laws-prompt pilot, no task had an
  all-lanes or law pass among its pooled B and C runs (0 of 12), so there
  was no scored run. The completion contracts require `@beep/*` packages
  that a toolless, standalone run does not import. No verdict on the
  trainer question and no prune proposal
  ([findings](../../goals/skill-effect-probe/history/FINDINGS.md)).
- **Activation gate: fired on pilot evidence.** The skill fired in 17 of 24
  cell C pilot runs (0.71, below 0.8); no scored cell C runs exist. `skill-activation-probe` is now open for
  decomposition.
- **Corpus-sizing gate: not fired.** No effect was measured.
- **Lane-level probe: graduated 2026-11-13** as
  [`goals/skill-lane-probe`](../../goals/skill-lane-probe/README.md). The
  pilots' lane contrast was seen, so its primary and rule are fixed in the
  goal's `SPEC.md` before any scored run, and every scored run is fresh.

`skill-effect-probe` was promised at the first graduation and `skill-lane-probe`
at the second. The three gated candidates stay here as re-entry points; a fired
gate reopens this packet at `decompose`.

## Sequencing

1. `skill-effect-probe` first. Done 2026-11-13: Insensitive, tooling on
   `main`.
2. `skill-lane-probe` next. It needs only the first probe's tooling and
   answers the question the first could not reach.
3. On an Effect from the lane probe: `skill-corpus-sizing`. The deferred
   question in [`DECISIONS.md`](./DECISIONS.md) is answered there, from a
   measured effect size.
4. On a Small effect or a Null: no corpus work. A Null closes the trainer
   question for law skills.
5. `skill-activation-probe` is decomposed after the lane probe reports its
   fired rate. `procedural-skill-probe` waits for the operator to name a
   skill.

A trainer appears nowhere in this map. It would need a new operator decision
that lifts the retirement disposition.

## First Vertical Slice

For `skill-lane-probe`: the report command reads the committed laws-pilot
records and prints the lane-fraction difference, the permutation p-value and
the fixed-task interval for all 12 tasks.

- The numbers match a hand calculation on three tasks.
- The same seed gives the same p-value twice.
- The output is labelled as pilot data and writes no verdict.

Verified by the command output and its tests, with no new run. The 120 scored
runs start only after this slice passes and the rule is on `main`.

The first probe's slice (one task, three cells, two runs each, scored end to
end) passed on 2026-11-12; its record is
[`p0-slice`](../../goals/skill-effect-probe/history/p0-slice/README.md).

## Open Risks Inherited From The Brief

Settled by `skill-effect-probe`: the run-to-directory mapping, three cells in
a two-arm harness, fixture drift (scorer profile v3) and the exclusion of
rate-limited runs.

Open for `skill-lane-probe`:

- The primary was chosen after the pilot contrast was seen. Fresh runs and a
  rule merged first are the only defence.
- Completion patterns that no run reaches sit inside the lane fraction as a
  constant. They shrink the scale without favouring a cell.
- Activation is part of the treatment. The pilot fired rate was 0.71.
- The skill has changed since the pilot whenever its content hash differs;
  the probe records the hash and measures the live skill.
- Ready pull requests on this repository have been merged by hand within
  minutes, which cost the first probe its readiness receipt three times.
