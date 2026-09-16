# Cursor Agent Pool

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

A Cursor Ultra subscription sits at 1% used while the three Codex subscriptions drain to 1% every
cycle. Codify a pool order the agents follow: Codex Astra while its pool holds more than 5%, then the
Cursor agent, driven headless with the same hooks, skills, subagents, and metrics the Claude and Codex
lanes already have.

## Next Open Question

None — graduated 2026-09-16 into [`goals/agent-pool-doctrine`](../../goals/agent-pool-doctrine/) (active,
P1 in flight) and [`goals/agent-pool-picker`](../../goals/agent-pool-picker/) (paused until A merges).
The packet reopens at `decompose` if a MAP gate fires.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Prior art

- [`goals/tsgo-045-effect-idiom-sweep/DECISIONS.md`](../../goals/tsgo-045-effect-idiom-sweep/DECISIONS.md)
  D13 admitted Cursor as a headless Bash lane; the smoke test is in that packet's
  `history/2026-09-12-cursor-smoke.md` and the recipe in `ops/prompts/50-cursor-lane.md`.
- `explorations/INBOX.md` bullet **agent-config-canonicalization** (2026-08-29) covers the
  one-manifest-many-harnesses half of the parity problem; this packet hand-mirrors, that bullet
  generalises.

## Trail

- 2026-09-16 (graduate): BRIEF and MAP confirmed; two goal packets scaffolded; first Goal A slice
  (runbook + AGENTS.md pool section) written by a `composer-2.5` lane under the committed deny list in
  118 s with zero git commands; `cursor-cli` literal, env knob, Cursor pulse adapter, hooks.json and
  conformance test added; Opus 5 review lane launched read-only (D18). Status → graduated.
- 2026-09-16 (later): all four lanes landed (three needed a finish/rerun after the harness dropped
  the response at 100+ turns); Composer 2.5 lanes distilled them into briefs; rounds 3-6 closed
  D9-D21 (D4 revised into D16); hooks smoke test and Codex meter proven locally; BRIEF.md and MAP.md
  drafted; stage → shape awaiting confirmation.
- 2026-09-16: opened from a desktop-session capture; four grok-4.6 research lanes launched
  (CLI surface, config parity, quota/models, field reports); align rounds 1-2 settled D1-D8 while
  research ran. Stopped mid-align with three questions blocked on the lane reports.
