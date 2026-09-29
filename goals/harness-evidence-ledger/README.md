# Harness Evidence Ledger

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Typed per-edit harness evidence ledger with config-fingerprint expiry,
retention-side pruning proposals, and an annealed-budget rerun of the SkillOpt
pilot.

A harness here means prompts + control flow + tools + skills/memory + context
management + subagents. The model is held fixed. The harness is what we edit.

## Why This Packet Exists

On 2026-09-25 we read RRSI (arXiv 2609.24972 v2, "regularized recursive
self-improvement" for agent harnesses). It is convergent prior art. This
repo's own packets predate it by two to eleven weeks:
`goals/agent-effectiveness-loop` (2026-05-20),
`goals/skillopt-training-pilot` (2026-07-06),
`goals/coding-agent-effectiveness-evidence-loop` (2026-07-31), and
`explorations/context-rent-telemetry` (2026-07-31). The repo did not copy the
paper, and the paper did not copy the repo.

The paper does make three mechanisms concrete that the repo only described.
This packet ports those three:

1. A typed ledger row per harness edit: hypothesis, mechanism class, diff,
   score and cost delta, disposition.
2. Evidence expiry by config fingerprint (model id, reasoning effort, hash of
   the always-loaded harness surfaces), not by calendar date.
3. Retention pruning: surfaces that stop earning their place become deletion
   proposals.

It also reruns the parked SkillOpt pilot with an annealed edit budget and
parallel gate evaluation. The rerun writes the first ledger rows.

Two choices deliberately differ from the paper. A human admits every change;
the loop only proposes. Regularization sits on the retention side (what we
keep), not the proposal side (what we may try).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/harness-evidence-ledger/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth, including locked
   decisions D1 to D14.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - papers, session maps, and
   repo precedents.
6. [`history/`](./history/) - rerun evidence and closeouts.
7. [`../../harness-ledger/README.md`](../../harness-ledger/README.md) - the
   tracked ledger surface and its laws.

## Current Phase

All phases are complete (2026-09-29). PR1 (#1253) shipped the schemas, the
ledger CLI, the hook-pulse `surface` field, and the scorer fixes. The closing
PR shipped the regime gate, the rerun controls, the rerun, and this close.

## Verdict

The ledger, fingerprint expiry, and retention pruning are built and in use.
The rerun is closed and no trained skill is adopted: with a scorer that
measures only the agent's edit, the baseline skill scores 0.92 on the
validation set with a measured noise spread of 0.08, so the corpus cannot
separate a better skill from noise at this model strength.

## Latest Evidence

- [`history/p4-rerun/FINDINGS.md`](history/p4-rerun/FINDINGS.md): the closing
  rerun. Four of six candidates were screened out before evaluation, two gate
  accepts sit inside the noise band, and the scorer takes a median of 5.3 s per
  task against roughly 2 minutes in P5.
- [`history/p2-rerun/FINDINGS.md`](history/p2-rerun/FINDINGS.md): the stopped
  first run that exposed the scorer sandbox floor.
- [`2026-09.jsonl`](../../harness-ledger/rows/2026-09.jsonl): fourteen rows.
  Four candidate rows are `proposed` and wait for a human disposition
  (`hl-20260925-873a855c`, `hl-20260925-4fc1962c`, `hl-20260929-df3f0899`,
  `hl-20260929-f88812b2`); four are machine `rejected` as negative evidence.
- [`history/reflections/2026-09-29-claude.md`](history/reflections/2026-09-29-claude.md):
  the closeout reflection.

## One Step Left For A Human

hook-pulse can stamp the harness hash on `SessionStart`, but
`.claude/settings.json` does not run it on that event yet. An agent session is
not allowed to edit its own hook wiring, and D2 reserves harness admission for
a human, so the entry is filed as the `proposed` row `hl-20260929-475be43a`.
To admit it, append this group to `hooks.SessionStart` in
`.claude/settings.json`, using the same command string the `SessionEnd` group
already uses for `hook-pulse.sh`:

```json
{
  "hooks": [
    {
      "type": "command",
      "command": "<the hook-pulse.sh command string from hooks.SessionEnd>",
      "timeout": 5
    }
  ]
}
```

Until then `prune-proposals` reports every session as unstamped and proposes
nothing. After it, the 30-session window fills with real sessions and
`bun run beep harness-ledger prune-proposals --window 30 --write` records the
first pruning proposals. The stamp costs about one second at session start.

## Notes

- The pilot packet `goals/skillopt-training-pilot` stays parked and
  `completed-retained`. The rerun lives here.
- `coding-agent-effectiveness-evidence-loop` P7 records its improvement
  dispositions as rows in this ledger.
- `explorations/context-rent-telemetry` resumes when this packet ships
  `prune-proposals`. It has shipped; the resume trigger is met once the
  `SessionStart` entry above is admitted and a window fills.
