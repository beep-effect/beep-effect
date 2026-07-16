# GOAL: InfraNodus-style 3D knowledge-graph view on our stack

Repo root: the current working directory (the `beep-effect` checkout you are in).
All paths are repo-relative; several checkouts exist.

Outcome: a React 3D knowledge-graph renderer (dark bg, force-directed 3D,
community-colored nodes, betweenness-proportional distance-faded labels, curved
edges, selection dimming) rendering ~2,500 nodes interactively, wired into the
ontology workbench behind a 2D/3D toggle with cosmos 2D as the default.

Compact `/goal` launcher. The packet files are the contract — read first:

- `goals/graph-3d-view/SPEC.md` (normative), `PLAN.md`, `ops/manifest.json`,
  `README.md`.
- `goals/graph-3d-view/research/` — the clean-room visual spec + integration
  ledger (FROZEN; do not re-research the web).
- Then `AGENTS.md`, `CLAUDE.md`, and the standards `SPEC.md` names. Higher repo
  standards outrank packet prose on conflict.

## Routing (binding)

- **Main agent (Fable)** owns: all design (the P0 gate → `research/DESIGN.md`),
  review of every diff, and ALL user-facing frontend/renderer/UX code (the 3D
  component, labels, interactions, Storybook, toggle UI) — Fable beats codex at
  frontend.
- **Codex** drafts non-visual plumbing (worker 3D layout, projection schema,
  bridge/toggle atoms) via `codex-companion.mjs task --background --write
  --model gpt-5.6-sol --effort medium` — ONE output file per job; Fable reviews
  before commit. Preserves the weekly Fable quota (codex = separate quota, can't
  browse). See the user's codex-companion memory for the full path/poll flow.
- `research/` is frozen, reference-only. NEVER copy or closely paraphrase code
  from `explorations/graph-3d-navigation/research/seed/bundle/**` or any AGPL
  source — implement clean-room from the prose parameters.

## Scope

- In: a NET-NEW 3D engine + component (placement decided at P0 — see
  `research/integration-constraints.md` §5); `Session.visualizer.ts` (+worker,
  add z); `Session.atoms.ts` (3D bridge + toggle + click→selection); the
  workbench toggle UI; `apps/storybook` glob if needed.
- Out: cosmos 2D behavior (stays default, no regression), analytics/AI/NLP,
  text-to-graph, VR/AR, InfraNodus feature parity, data-model changes beyond z.

## Workflow

1. P0: design gate (Fable) → `research/DESIGN.md` with a 2.5k benchmark.
2. P1: generic component on synthetic data — Storybook (six behaviors) + FPS
   probe + `@vitest/browser` test. Codex drafts schema/generator/test assertions;
   Fable writes the renderer/labels/interactions.
3. P2: wire into the workbench behind the toggle (cosmos default). Codex drafts
   worker-z/mapping/bridge atoms; Fable reviews + writes toggle UI + browser +
   Tauri QA + cosmos regression check.
4. P3: `/reflect` closeout; `bun run beep yeet` to a mergeable PR.

## Acceptance

- [ ] `SPEC.md` acceptance criteria satisfied (design gate, 2.5k Storybook +
      FPS, browser test, workbench toggle with cosmos default, clean-room audit).
- [ ] Required verification passes; unrelated failures recorded separately.
- [ ] No unrelated refactors or formatting churn.

## Verification

```sh
test "$(wc -m < goals/graph-3d-view/GOAL.md)" -le 4000
jq . goals/graph-3d-view/ops/manifest.json
git diff --check -- goals/graph-3d-view
```

Stop and report before changing public API, schema, migration, deps/lockfiles,
or cosmos behavior unless `SPEC.md` requires it. Done only when acceptance passes
and verification is complete, or a blocker is reported with file/command
evidence.
