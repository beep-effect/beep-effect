# Map

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `skill-effect-probe` | Measure whether `schema-first-development` changes Opus 5.5 output on the 12 archived tasks, across bare, code-laws and code-laws-plus-skill cells, and return a verdict against a rule agreed in advance. | none | Law scorer and trial comparison in `packages/tooling/tool/cli/src/commands/AgentEffectiveness/`; run storage in `packages/tooling/library/ai-metrics`; ledger rows in `packages/tooling/tool/cli/src/commands/HarnessLedger/`; archived corpus in the goals archive; `claude plugin eval` as the runner. NET-NEW: eval cases and scaffold scripts, a plugin wrapper for the skill, kept-directory scoring glue, paired-difference arithmetic. |
| `skill-corpus-sizing` (gated) | Size and build a task corpus from the probe's measured effect and variance. | `skill-effect-probe` reports an effect that meets the rule | Same bricks, plus the probe's glue. NET-NEW: tasks mined from review findings and lint reds. |
| `procedural-skill-probe` (gated) | Repeat the probe for a procedural skill such as yeet or closeout. | `skill-effect-probe` lands its glue; the operator names a skill | Probe glue. NET-NEW: tasks and judge-model graders. |
| `skill-activation-probe` (gate fired 2026-11-13) | Measure whether repo skills fire on natural prompts. | the probe reports a fired rate below 0.8, or the operator asks | `claude plugin eval` native graders. NET-NEW: prompts per skill. Related parked packet: [`remote-skill-activation-conformance`](../remote-skill-activation-conformance/README.md). |

## Outcome of `skill-effect-probe`, 2026-11-13

- **Verdict: Insensitive.** On the laws-prompt pilot, no task had an
  all-lanes or law pass among its pooled B and C runs (0 of 12), so there
  was no scored run. The completion contracts require `@beep/*` packages
  that a toolless, standalone run does not import. No verdict on the
  trainer question and no prune proposal
  ([findings](../../goals/skill-effect-probe/history/FINDINGS.md)).
- **Activation gate: fired.** The skill fired in 17 of 24 cell C pilot runs
  (0.71, below 0.8). `skill-activation-probe` is now open for
  decomposition.
- **Corpus-sizing gate: not fired.** No effect was measured.

Only `skill-effect-probe` was promised at graduation. The three gated candidates stay
here as re-entry points; a fired gate reopens this packet at `decompose`.

## Sequencing

1. `skill-effect-probe` first. Every later candidate needs either its glue or
   its result.
2. On an effect that meets the rule: `skill-corpus-sizing`. The deferred
   question in [`DECISIONS.md`](./DECISIONS.md) is answered there, from a
   measured effect size.
3. On a null: no corpus work. The trainer question closes for law skills, and
   the two gated probes remain available on their own triggers.

A trainer appears nowhere in this map. It would need a new operator decision
that lifts the retirement disposition.

## First Vertical Slice

One task, three cells, two runs each, scored end to end:

- the harness seeds the fixture, runs Opus 5.5 with and without the skill,
  and keeps the run directories;
- the law scorer scores each kept directory, and each score is tied to its
  case, cell and run;
- the scorer preflight passes on that task's untouched fixture and its
  known-good solution;
- a table prints the three cell means and the two paired differences.

Verified by the command output and the kept records, six runs in total. The
remaining 174 runs start only after this slice passes.

## Open Risks Inherited From The Brief

- The mapping from a run to its kept directory is unverified.
- Three cells need a workaround in a two-arm harness.
- Four task families make a cluster-aware interval wide.
- Activation is part of the treatment and may dominate the result.
- Fixtures may have drifted from the current toolchain.
- A rate-limited run scores zero and must be excluded, not counted.
