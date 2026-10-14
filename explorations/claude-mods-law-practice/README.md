# Claude Code Mods for the Law Practice

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Claude Code mods (plugins that run code inside Claude Code: redraw rows, add
bands, commands and controls, guard tool calls) might turn the attorney's
Claude Code sessions into a lawyer-facing workbench on top of the firm's
practice knowledge graph. Origin: the Notion board items "Explore claude
mods for law-practice use-case" and "Add claude-for-legal to dads claude
setup".

## Next Open Question

None — graduated into [`goals/practice-claude-mod`](../../goals/practice-claude-mod/README.md).
Reopen at `decompose` when the law-time-capture-spine P0 entry schema lands
(gated candidate `practice-claude-mod-time-entries` in MAP.md).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (the Notion triage briefs).
3. [`RESEARCH.md`](./RESEARCH.md) - what a mod is, where it runs, trust model, the Effect-in-mod spike.
4. [`research/repo-inventory.md`](./research/repo-inventory.md) - in-repo law-practice surface (Codex lane).
5. [`DECISIONS.md`](./DECISIONS.md) - D1–D12 from three grilling rounds.
6. [`BRIEF.md`](./BRIEF.md) - shaped pitch.
7. [`MAP.md`](./MAP.md) - decomposition and capability check.

## Trail

- 2026-10-14: graduated into `goals/practice-claude-mod` (SPEC seeded from
  BRIEF + DECISIONS, sources carried); time-entries candidate stays gated.
- 2026-10-14: packet opened from the Notion board item; research (mods docs,
  admin controls, legal plugin, Codex repo inventory); Effect-in-mod spike
  passed `claude plugin validate` and `claude plugin test`; align rounds 1–3
  locked D1–D12; brief confirmed by the operator; MAP names
  `practice-claude-mod` (promised now) and a gated time-entries follow-on.
