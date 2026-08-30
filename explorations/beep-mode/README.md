# beep-mode: a harness-neutral fork of pstack for beep-effect

## Status

Stage: `align`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

`/add-plugin pstack` put poteto's rigor stack into Cursor only. Work here runs
through Claude Code, Codex, Grok, and Cursor, so the stack has to live in the
repo's shared skill root and carry this repo's own laws, not Cursor's
assumptions (Graphite, `Task` model slugs, `~/.cursor/rules`, cursor-team-kit).

## Next Open Question

None — align frontier empty (18 decisions in `DECISIONS.md`), pending the
operator's shared-understanding confirmation. Next stage: shape (`BRIEF.md`),
then decompose (`MAP.md`) into `goals/beep-mode/` with three phased PRs.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - pstack distillation + in-repo capability inventory (stage 1).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2).
5. [`research/pstack-distillation/`](./research/pstack-distillation/) - four
   Codex distillations of upstream (playbooks, principles vs doctrine,
   situational skills, guide/packaging).

## Trail

- 2026-08-29 (b): grill completed, frontier empty. 18 decisions logged
  (shape, mode identity, vehicle, principle layout, name, Cursor plugin,
  playbook set, conflict handling, six beep principles, scripts, skill set,
  collisions, model roles, agents, autonomy, stickiness, attribution, reply
  style, eval, graduation). Awaiting operator confirmation before shape.
- 2026-08-29 (a): packet opened mid-grill. Rounds 1-2 settled shape, entry point,
  vehicle, principle layout, name, and Cursor plugin fate (six decisions).
  Codex distillation of pstack in flight for round 3.
