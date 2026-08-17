# GOAL: Green-workbench theming + a feature-flagged rich chat input

All paths in this packet are repo-relative to the repository root.

Outcome: `apps/professional-desktop` launches with a green "workbench" theme
(near-black green dark + green/parchment light) following the OS preference with a
persisted toggle and the existing `@beep/ui` `OrbBackground tone="green"` glow; its
chat composer becomes a lobehub-style, feature-flagged Lexical input (fixed
formatting toolbar, `/` commands, `@` mentions, attachments, plain-Enter-sends,
char count, send/stop) built on generic `@beep/editor` infra, with the
placeholder/cursor bug fixed.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/chat-input-and-theming/README.md`
- `goals/chat-input-and-theming/SPEC.md`
- `goals/chat-input-and-theming/PLAN.md`
- `goals/chat-input-and-theming/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md`, and
the skills `claude-frontend-lane`, `atom-reactivity-specialist`,
`effect-first-development`. Higher-priority repo standards outrank packet prose
when they conflict.

Scope:

- In (Lane A, theming, app-local): `apps/professional-desktop` — green
  `createAppTheme` override (pattern:
  `apps/oip-web/src/components/OipThemeProvider.tsx`), `src/main.tsx` default →
  `system`, persisted toggle, app-local Tailwind var layer, wire `@beep/ui`
  `OrbBackground`.
- In (Lane B, composer): generic feature-flag config + toolbar/slash/mention/
  attachment infra in `packages/foundation/ui-system/editor` (`src/composer.tsx`
  + new modules); placeholder fix in `packages/foundation/ui-system/ui/src/
  components/editor/editor-ui/content-editable.tsx`; app assembly in
  `apps/professional-desktop/src/chat/ui/Composer.tsx` (inject product slash
  items + mention source; preserve `draftAtoms`/`runTurnAtom`/`editTargetAtom`).
- In (optional, attachments-on-payload): extend `SendTurnRequest` across
  `@beep/agents-*` + `@beep/anthropic` vision, or apply the documented degrade
  (capture UI + upload port, stubbed send).
- Out: block render/stream/viewer/repair (chat-surface-parity);
  `@beep/lexical-schema` node-vocabulary changes; `@beep/ui` default-palette
  change; new chat domain/tables; `@lobehub/editor` as a dependency.

Workflow:

1. Inspect referenced files + current state; read `research/` (reference reports,
   deep-research, Chrome map, palette, `seed/`).
2. Make the smallest change satisfying `SPEC.md`; foundation owns the mechanism,
   the app injects product meaning.
3. Port patterns from the machine-local `effect-lexical-chat` checkout (`Atom.family`
   keyed by `LexicalEditor`; draft `Atom.kvs`).
4. Preserve unrelated worktree changes; tie decisions to file/test/command
   evidence.
5. Build + QA via `claude-frontend-lane` + claude-in-chrome in both modes.
6. At P3 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification passes, or unrelated failures are reproduced and
      recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification (packet-shape):

```sh
test "$(wc -m < goals/chat-input-and-theming/GOAL.md)" -le 4000
jq . goals/chat-input-and-theming/ops/manifest.json
git diff --check -- goals/chat-input-and-theming
```

Implementation gates (after coding): `bun run check` + `bun run beep yeet verify`;
full set (Storybook + app QA in both modes) in the `SPEC.md` Verification Matrix.

Stop and report before changing public API, schema/data migration, auth, infra,
dependencies, lockfiles, or generated files unless `SPEC.md` requires it (the
attachment payload extension is the one named cross-slice change).

Done only when acceptance passes and verification is complete, or a blocker is
reported with file/command evidence.
