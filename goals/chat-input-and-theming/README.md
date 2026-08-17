# Chat Input & Green Workbench Theming

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

### Closeout reconciliation (2026-07-11)

The work shipped as PR #272, merged 2026-06-21 (branch
`feature/editor-chat-enhancements`, now 0 ahead of `main`; `ChatComposer`
lives at `packages/foundation/ui-system/editor/src/chat/`). The closeout
reflection was written the same day
([`history/reflections/2026-06-21-claude.md`](./history/reflections/2026-06-21-claude.md)),
but the manifest was left with P3 Close `in_progress` and lifecycle `active`.
This reconciliation flips the paperwork to match the merged reality; no new
work was done.

## Mission

Give `apps/professional-desktop` a green "workbench" light/dark theme (with a
persisted toggle and the existing `@beep/ui` green orb glow) and a lobehub-style,
feature-flagged Lexical chat input (fixed formatting toolbar, `/` commands, `@`
mentions, attachments, plain-Enter-to-send), with the placeholder/cursor bug
fixed — generic mechanism in `@beep/editor`, product meaning injected by the app.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/chat-input-and-theming/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - reference reports, deep-research, Chrome map,
   palette, and the original seed brief under [`research/seed/`](./research/seed/).
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

All phases **complete** — both capabilities shipped, verified, and merged as
PR #272 (2026-06-21); reflection written. The green workbench theme
(app-local `createAppTheme` + Tailwind var layer, `system` default + persisted
toggle, `OrbBackground tone="green"`) and the feature-flagged `@beep/editor`
`ChatComposer` (toolbar, `/` slash, `@` mentions, attachment capture,
plain-Enter send, character count, send/stop, combobox a11y) are in, with the
placeholder/cursor bug fixed.

## Latest Evidence

Implementation: `@beep/editor/chat` (config, commands, slash-items, typeahead,
toolbar, send, attachments, `ChatComposer`), placeholder fix in `@beep/ui`
`content-editable.tsx`, Lane A theming in `apps/professional-desktop`
(`styles/globals.css`, `theme/WorkbenchThemeProvider.tsx`, `chat/ui/ThemeToggle.tsx`,
`ChatApp.tsx`, `main.tsx`), app assembly in `chat/ui/Composer.tsx`. Verification:
`bun run check` green (29/29); Storybook editor interaction tests 9/9 (new
`chat-composer.stories.tsx` incl. placeholder regression); claude-in-chrome QA
confirmed both theme modes + slash/mention/keyboard/a11y (`role=combobox` +
`aria-activedescendant`) + Enter behaviors. Closeout reflection:
[`history/reflections/2026-06-21-claude.md`](./history/reflections/2026-06-21-claude.md).
Attachment send-transport is the recorded **stubbed-send degrade** (Exception
Ledger).

## Notes

- **Seed:** `research/seed/USER_PROMPT_INITIAL.md` (+ `assets/` PNGs) is the
  original user brief, graduated out of `goals/chat-surface-parity/research/`.
- **Upstream exploration:** `explorations/agent-chat-interface` (locked the
  "build custom, `@lobehub/editor` is reference-only" decision).
- **Sibling completed packets (do not re-open):** `rich-text-foundation`
  (`@beep/editor` + `@beep/lexical-schema`), `desktop-chat-surface` (chat
  substrate/atoms), `chat-surface-parity` (block render/stream/viewer).
- **Closest prior art to port from:** the machine-local `effect-lexical-chat` checkout
  (Atom.family keyed by `LexicalEditor`; draft `Atom.kvs`). Live deploy is a
  behavioral/visual reference.
- **Theme references:** trustgraph `workbench-ui` port + `palette.json`
  (green dark); `apps/oip-web` (parchment light).
