# Graph 3D View Plan

## Status

Status: `pending` (graduated 2026-07-14 from
`explorations/graph-3d-navigation`; P0 not started)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Design gate | pending | Consume `research/`; decide stack + placement + label technique + layout location + interaction model + theming + toggle UX, with a 2.5k benchmark. | `research/DESIGN.md` answers all gate decisions with cited evidence + benchmark. |
| P1 Generic component | pending | Build the 3D renderer + labels + interactions on synthetic data; Storybook + FPS probe + browser test. | Storybook 2.5k story shows six behaviors; FPS recorded; `@vitest/browser` test green. |
| P2 Workbench integration | pending | Add z to the projection/worker; parallel 3D bridge + toggle; workbench toggle UI; QA. | Toggle switches cosmos↔3D (cosmos default); selection syncs; cosmos regression empty. |
| P3 Close | pending | PR to mergeable via yeet; closeout reflection. | Packet status/evidence updated; reflection exists; PR mergeable. |

## Task routing (Actor per task)

Routing law in `GOAL.md`: Fable = design + review + all frontend/renderer/UX;
codex `gpt-5.6-sol --effort medium --write` = non-visual plumbing (one output
file per job), reviewed by Fable.

### P0 — Design gate
- Read `research/*`, decide the 7 gate questions, write `research/DESIGN.md`
  with a 2.5k benchmark — **Fable**.
- Optional adversarial critique of `DESIGN.md` → `research/DESIGN-REVIEW.md` —
  **codex** (read-only).

### P1 — Generic component
- Package scaffold + build/deps wiring per DESIGN — **Fable**.
- `Graph3DProjection` schema/types (one file) — **codex `--write`**, Fable
  review (schema-first).
- Synthetic ~2.5k-node graph generator for stories/tests (one file) — **codex
  `--write`**.
- Renderer core, community colors, Sprite/SDF labels + declutter/fade,
  curved edges, raycast/pick interactions, selection dimming — **Fable**.
- Storybook stories (six behaviors) + CosmosSpike-style FPS probe story —
  **Fable**.
- `@vitest/browser` test (mount / node count / `select` dim / `destroy`) —
  **codex** drafts assertions on the test handle, **Fable** finalizes.

### P2 — Workbench integration
- Worker 3D layout (z in `Session.visualizer.ts` + worker/protocol) per DESIGN
  (one file focus) — **codex `--write`**, Fable review (DOM-free worker).
- `graph3dProjectionFromOntology` mapping (community→palette, bc→size,
  label priority) (one file) — **codex `--write`**.
- Parallel 3D render-bridge atom + toggle atom + canvas-click→`selectedOntology
  ResourceIriAtom` sync — **codex `--write`** draft, **Fable** review (atom
  compliance).
- Workbench header toggle UI (cosmos default) — **Fable**.
- Browser + Tauri/WebKitGTK QA; cosmos-default regression check — **Fable**.

### P3 — Close
- `/reflect` closeout reflection — **Fable**.
- README/manifest evidence + status updates — **Fable**.
- `bun run beep yeet` to a mergeable PR — **Fable**.

## P3 Closeout Checklist

Before marking closed (`status` → `completed-retained`):

1. Write a closeout reflection via `/reflect` (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; critique tooling,
   implementation, and goal/prompt; capture codifiable TODOs. Frontmatter must
   validate against `ReflectionFrontmatter`.
2. `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`).
3. Update `README.md` + `ops/manifest.json` phase statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes; keep `SPEC.md` normative.
- The 2.5k target is a benchmark obligation — record the proven ceiling in
  `README.md` even if below ~60fps.
- Verify a single resolved `three` in the lockfile for the chosen candidate.

## Verification Commands

```sh
test "$(wc -m < goals/graph-3d-view/GOAL.md)" -le 4000
jq . goals/graph-3d-view/ops/manifest.json
rg -n "graph-3d-view|GOAL.md|agentLaunchers|packetAnchorDocument" goals/graph-3d-view
git diff --check -- goals/graph-3d-view
bun run beep goals doctor
```
