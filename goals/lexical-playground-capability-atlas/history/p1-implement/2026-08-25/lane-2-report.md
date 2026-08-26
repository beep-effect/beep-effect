# P1 lane 2 implementation report

Date: 2026-08-25  
Branch: `feat/lexical-atlas-p1-resolver`  
Status: implementation complete; Storybook browser proof remains unverified in this sandbox.

## Files created

- `packages/foundation/ui-system/editor/src/capability/runtime.tsx`
- `packages/foundation/ui-system/editor/src/capability/toolbar.tsx`
- `packages/foundation/ui-system/editor/src/capability/shortcut-help.tsx`
- `packages/foundation/ui-system/editor/src/capability/composer.tsx`
- `packages/foundation/ui-system/editor/stories/capability-profiles.stories.tsx`
- `packages/foundation/ui-system/editor/test/capability-runtime.test.tsx`
- `apps/professional-desktop/src/editor-proof/EditorProof.atoms.ts`
- `apps/professional-desktop/src/editor-proof/EditorProofPanel.tsx`
- `apps/professional-desktop/test/editor-proof-panel.test.tsx`

## Files changed

- `packages/foundation/ui-system/editor/src/capability/index.ts`
- `packages/foundation/ui-system/editor/src/chat/toolbar.tsx`
- `packages/foundation/ui-system/editor/src/nodes.ts`
- `packages/foundation/ui-system/editor/src/composer.tsx`
- `packages/foundation/ui-system/editor/stories/fixtures.ts`
- `packages/foundation/ui-system/editor/package.json`
- `packages/foundation/ui-system/editor/README.md`
- `apps/professional-desktop/src/workspace/dock.atoms.ts`
- `apps/professional-desktop/src/App.tsx`
- `apps/professional-desktop/test/dock-shell.test.tsx`

## Design notes and deviations

- No lane 1 contract symbol required a semantic change.
- `toolbarSelectionAtom` is now exported so the capability toolbar can reuse the existing atom-first
  selection mirror instead of introducing a second source of selection state.
- `commandHandlers` uses a read-only string-keyed record. Lane 1's `CommandId` is branded, so a
  literal object cannot satisfy `Record<CommandId, ...>` without a prohibited type assertion.
  `runCommand` still requires the branded `CommandId` at its public boundary.
- The package export map lists the four TSX capability subpaths explicitly because the existing
  `./capability/*` target expands to `.ts` and cannot resolve `.tsx` files. Source and
  `publishConfig.exports` remain mirrored.
- The one `null` added is the Lexical `TOGGLE_LINK_COMMAND` unlink payload, a required third-party
  boundary value.
- Keybinding registration is owned by an Atom family finalizer mounted with `useAtomMount`; no React
  state/effect hook owns editor state or listener lifetime.

## Verification

### Editor package

- PASS — `bun run --cwd packages/foundation/ui-system/editor lint:fix`
  - Tail: `$ biome check --write .`
- PASS — `bun run --cwd packages/foundation/ui-system/editor check`
  - Tail: `$ tsgo --noEmit`
- ENVIRONMENT-ONLY FAIL — `bun run --cwd packages/foundation/ui-system/editor test`
  - Tail: `Test Files  no tests`, `Tests  no tests`, `Errors  16 errors`, duration `60.07s`.
  - All failures were worker-start timeouts before collection; no test module ran.
- PASS diagnostic lane —
  `bunx --bun vitest run --pool=threads --maxWorkers=1 --config vitest.config.ts`
  - Tail: `Test Files  16 passed (16)`, `Tests  436 passed (436)`.
- PASS focused runtime lane —
  `bunx --bun vitest run --pool=threads --maxWorkers=1 test/capability-runtime.test.tsx`
  - Tail: `Test Files  1 passed (1)`, `Tests  4 passed (4)`.

### Professional desktop

- PASS — `bun run --cwd apps/professional-desktop lint:fix`
  - Tail: `$ biome check --write .`
- PASS — `bun run --cwd apps/professional-desktop check`
  - Tail: `$ tsgo --noEmit`
- ENVIRONMENT-ONLY FAIL — `bun run --cwd apps/professional-desktop test`
  - Tail: `Test Files  no tests`, `Tests  no tests`, `Errors  45 errors`, duration `60.26s`.
  - All failures were worker-start timeouts before collection; no test module ran.
- PASS diagnostic lane —
  `bunx --bun vitest run --pool=threads --maxWorkers=1 --config vitest.config.ts`
  - Tail: `Test Files  45 passed (45)`, `Tests  224 passed (224)`.
- PASS focused panel/dock lane —
  `bunx --bun vitest run --pool=threads --maxWorkers=1 test/editor-proof-panel.test.tsx test/dock-shell.test.tsx`
  - Tail: `Test Files  2 passed (2)`, `Tests  9 passed (9)`.

### Cross-repo and browser proof

- PASS — `bun run docgen:local`
  - Tail: `Tasks: 65 successful, 65 total`; `aggregated 61 package(s)`; exit 0.
- UNVERIFIED — `bun run --cwd apps/storybook test:storybook:editor`
  - The command produced no output and no Chromium result for more than five minutes, so it was
    interrupted. No pass is claimed, and the recorded browser QA round could not start from a
    terminal Storybook result in this sandbox.
- PASS — `git diff --check` (no whitespace errors).

## Open questions

- The orchestrator should rerun the canonical fork-pool tests and Storybook Chromium command in its
  worker-capable environment.
- If a future lane requires exhaustive `commandHandlers` typing, the lane 1 contract would need an
  assertion-free branded-key construction helper; lane 2 does not expand that contract.

No commit was created.
