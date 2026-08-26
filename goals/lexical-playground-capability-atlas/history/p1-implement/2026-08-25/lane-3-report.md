# Lane 3 complexity refactor report

## Files changed

- `packages/foundation/ui-system/editor/src/capability/resolver.ts`
  - Split the resolver into ordered `Option` checks and a flat `Result` completion path.
  - Extracted graph node and edge mutation helpers.
  - Replaced the nested cycle visitor with `cycleFromStack`, `visitDependencies`, and `visitCapability`.
- `packages/foundation/ui-system/editor/test/capability-catalog.test.ts`
  - Moved atlas reconciliation into pure mismatch helpers and a `MutableHashMap` index.
  - Kept category, disposition, dependency subset, ordered command id, command field, keybinding, and
    `beep-md` compatibility checks.
- `apps/professional-desktop/src/editor-proof/EditorProofPanel.tsx`
  - Split controls, profile selection, failure display, JSON drawer, and composer rendering into private
    components without changing the rendered DOM contract.
- `apps/professional-desktop/src/editor-proof/EditorProof.atoms.ts`
  - Added `Atom.fnSync` actions for profile selection, import, capture, JSON editing, and reload.
  - This fourth source file is required by the instruction to move import, capture, and reload logic into
    `EditorProof.atoms.ts`; no other source or test files were edited by this lane.
- `goals/lexical-playground-capability-atlas/history/p1-implement/2026-08-25/lane-3-report.md`
  - Added this report.

Concurrent changes remained present in `capability/composer.tsx`, `composer.tsx`, `runtime.ts`,
`stories/fixtures.ts`, and the reflection file. This lane did not edit or revert them.

## Complexity before and after

Thresholds: cyclomatic 20, cognitive 8, CRAP 30, unit size 60.

| Unit | Before | After |
| --- | --- | --- |
| `resolveEditorProfile` | cyclomatic 22, cognitive 32, 134 lines | cyclomatic 1, cognitive 0, 30 lines |
| `Graph.mutate` callback | cognitive 12 | cyclomatic 1, cognitive 0, 4 lines |
| nested `visit` | cognitive 12 | removed; `visitCapability` is cyclomatic 4, cognitive 3, 27 lines |
| catalog reconciliation test body | cognitive 21, CRAP 31.6, 57 lines | cyclomatic 1, cognitive 0, 16 lines; CRAP below the 30 gate |
| `EditorProofPanel` | cognitive 11, 10 custom hooks, JSX depth 5 | cyclomatic 1, cognitive 0, 15 lines, 0 hooks, JSX depth 2 |

The threshold-forced health JSON supplied the after cyclomatic, cognitive, line, hook, and JSX-depth
values. Fallow omits the exact CRAP value for units that no longer meet its finding threshold, so the
after value is reported as the verified bound rather than an invented number.

## Verification

### Editor package

- `bun run --cwd packages/foundation/ui-system/editor lint:fix`
  - `Checked 65 files ... No fixes applied.`
- `bun run --cwd packages/foundation/ui-system/editor check`
  - `tsgo -p tsconfig.check.json`
  - `tsgo -p tsconfig.test.json --noEmit`
  - `tsc -p tsconfig.stories.json --noEmit`
  - Exit 0.
- `bun run --cwd packages/foundation/ui-system/editor test`
  - The default fork pool failed before collection because 16 workers timed out waiting to start.
- Fallback from the package directory:
  - `bunx --bun vitest run --pool=threads --maxWorkers=1`
  - `Test Files 16 passed (16)`
  - `Tests 437 passed (437)`

### Professional Desktop

- `bun run --cwd apps/professional-desktop lint:fix`
  - `Checked 138 files ... No fixes applied.`
- `bun run --cwd apps/professional-desktop check`
  - `tsgo -p tsconfig.check.json`
  - `tsgo -p tsconfig.scripts.json --noEmit`
  - `sync-migration-bundle.ts --check`
  - Exit 0.
- `bun run --cwd apps/professional-desktop test`
  - The default fork pool failed before collection because 45 workers timed out waiting to start.
- Fallback from the package directory:
  - `bunx --bun vitest run --pool=threads --maxWorkers=1 '--exclude=test/integration/**'`
  - `Test Files 45 passed (45)`
  - `Tests 224 passed (224)`

### Fallow

- `bun run beep quality fallow audit`
  - Introduced complexity findings: 0.
  - Remaining findings: 2 introduced dead-code findings owned by the concurrent lane.
  - No duplication or complexity findings remain in the audit envelope.
  - The command exits 1 because the two dead-code findings still gate the combined audit.

## Deviations

- Used the documented single-thread Vitest fallback after the sandbox could not start fork workers.
- The first ad hoc root-level focused Vitest command selected no editor tests because the root workspace
  config resolves each project's `test/**` include relative to that project. The package-scoped fallback
  then ran the complete editor suite.
- One attempted Professional Desktop fallback omitted quotes around the `**` exclusion, and zsh rejected
  the glob before Vitest started. The quoted command immediately replaced it and passed.
- No commit was created.
