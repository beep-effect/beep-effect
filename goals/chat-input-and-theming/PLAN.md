# Chat Input & Green Workbench Theming Plan

## Status

Status: `complete` — merged to `main` via PR #272 (2026-06-21); closeout
paperwork reconciled 2026-07-11 (see README), this status line 2026-07-31.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | completed | Build the research corpus and confirm scope: reference reports, deep-research, Chrome feature-map, green-workbench palette. | `research/` populated; SPEC decisions confirmed; blockers recorded. |
| P1 Implement | completed | Smallest changes satisfying `SPEC.md` across the two lanes. | Acceptance criteria met. |
| P2 Verify | completed | Storybook + app run + claude-in-chrome QA (both modes) + affected checks. | Verification green or blockers documented. |
| P3 Close | completed | PR, review response, closeout reflection, readiness. | Status/evidence updated; reflection exists. |

## P0 Research — deliverables (`research/`)

- `references/` — consolidated session syntheses: implementation surface
  (desktop app, `@beep/ui` theming, `@beep/editor`); lobehub source + Kernel
  plugin-registry pattern; `effect-lexical-chat` POC patterns; lexical-playground
  plugin taxonomy; theming/palette.
- `deep-research-*.md` — cited web report: chat-composer UX/accessibility +
  Lexical plugin/feature-flag architecture.
- `chrome-feature-map.md` — live lobehub chat-input demo (screenshots + state
  transitions); behavioral notes on the deployed `effect-lexical-chat` and the
  trustgraph workbench (no internal-URL screenshots committed — public repo).
- `palette.md` — green-workbench token table (MUI `colorSchemes` + Tailwind oklch)
  from `seed/palette.json` + trustgraph source.

## P1 Implement — work breakdown

- **Lane A (theming, app-local):** green `createAppTheme` override + Tailwind var
  layer in `apps/professional-desktop` (pattern:
  `apps/oip-web/src/components/OipThemeProvider.tsx`); flip `src/main.tsx` default
  to `ThemeMode.Enum.system`; persisted theme toggle in the app shell
  (`useThemeMode().toggleMode`); wire `@beep/ui` `OrbBackground tone="green"`.
- **Lane B (composer mechanism, `@beep/editor`):** feature-flag config + plugin
  infra (fixed toolbar, `/` slash, `@` mention, attachment drop/picker) in
  `src/composer.tsx` + new modules; placeholder fix in
  `packages/foundation/ui-system/ui/src/components/editor/editor-ui/content-editable.tsx`;
  plain-Enter-sends option.
- **Lane B (app assembly):** `apps/professional-desktop/src/chat/ui/Composer.tsx`
  injects formatting/insert slash items + mention source + send/attachment wiring;
  preserve `draftAtoms`/`runTurnAtom`/`editTargetAtom`.
- **Attachments-on-payload (optional):** extend `SendTurnRequest` across
  `@beep/agents-*` + `@beep/anthropic` vision, or apply the degrade path
  (capture UI + upload port, stubbed send) per the Exception Ledger.

## P3 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**,
   the **implementation**, and the **goal/prompt**. Capture TODOs worth codifying.
   Its YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Foundation owns the mechanism; the app owns product meaning.

## Verification Commands

Packet-shape gates (run anytime):

```sh
test "$(wc -m < goals/chat-input-and-theming/GOAL.md)" -le 4000
jq . goals/chat-input-and-theming/ops/manifest.json
rg -n "chat-input-and-theming|GOAL.md|agentLaunchers|packetAnchorDocument" goals/chat-input-and-theming
git diff --check -- goals/chat-input-and-theming
```

Implementation-completion gates (P2 Verify — see `SPEC.md` Verification Matrix for
the authoritative full set incl. Storybook + claude-in-chrome app QA in both
modes):

```sh
bun run check --filter @beep/editor --filter @beep/ui
bun run beep yeet verify
```
