# P2 Explorer + Editor Evidence

Date: 2026-07-09

Branch: `feat/ontology-workbench-p2-explorer-editor`

## Summary

P2 implementation is in place and ready for host verification. The ontology
client and UI packages were generated via architecture codegen and filled in
with RPC-backed atoms, a workbench shell, MUI X Tree View hierarchy explorer,
inspector editing, source preview, metrics, undo/redo, dirty state, and
open/save controls. Professional Desktop now registers ontology RPC handlers
beside chat and exposes a chat/workbench navigation shell.

## App proof

WORKS: Chat ⇄ Workbench navigation; Open (loads Turtle via sidecar FileSystem, worker
metrics computed: 4 quads / 3 resources / 2 classes on the seed pizza file); Add Triple via
inspector (quads 4→5, Dirty state set, undo enabled); Undo (quads 5→4, Dirty cleared, undo
disabled at base); Redo (quads 4→5, Dirty re-set); Save (Dirty cleared, file on disk
contains the authored rdfs:label triple); ABox/TBox toggle (TBox mode: 2 visible == worker
TBox metric 2; ABox: 1 visible; consistent shared classification); search ("Margherita" →
1 match); Turtle source textarea renders the serialized session.

P2 polish fixes applied after the live proof:

- Change-log panel added to the workbench right rail. It renders the applied
  typed change operations with op kind, target, sequence, applied count, redo
  count, and current undo/redo position.
- Undo/redo tooltip triggers now use the repo `TooltipTrigger render={<Button />}`
  composition so React renders exactly one button element per control.
- Turtle prefix maps now flow through N3 parse results, ontology sessions, save
  serialization requests, and the N3 writer. Prefix-preservation assertions cover
  codec parse/serialize and use-case open→save handoff.

## Packages And Modules

- `packages/ontology/domain`
  - real batch delta schemas and helpers in
    `src/aggregates/Session/Session.model.ts`
- `packages/ontology/use-cases`
  - source-aware commands/service updates
  - read-model projections and shared ABox/TBox classification in
    `Session.projections.ts`
  - sidecar RPC contract in `Session.rpc.ts`
  - worker snapshot/metrics protocol extension
  - pizza tutorial typed operation generator in `Session.pizza-tutorial.ts`
- `packages/ontology/client`
  - `OntologyRpcs` AtomRpc client, protocol selector, state atoms, mutations,
    undo/redo, dirty/search/snapshot atoms
- `packages/ontology/ui`
  - `OntologyWorkbench` screen with workbench shell, MUI X Tree View,
    search, inspector/form editing, Turtle source view through `@beep/editor`,
    and metrics panel
- `apps/professional-desktop`
  - ontology RPC handlers in `src/ontology/OntologyOrchestrator.ts`
  - RuntimeLive + sidecar RPC group registration
  - chat/workbench navigation in `src/App.tsx`
- Metadata:
  - root workspaces, `syncpack.config.ts`, `tsconfig.json`,
    `tsconfig.packages.json`, `tstyche.json`
  - app `package.json` / `tsconfig.json`
  - regenerated `standards/fallow.boundaries.generated.jsonc`
  - `.changeset/ontology-workbench-p2-explorer-editor.md`

## Dependencies Added

- `packages/ontology/ui/package.json`
  - workspace: `@beep/editor`, `@beep/lexical-schema`,
    `@beep/ontology-client`, `@beep/ontology-use-cases`, `@beep/rdf`,
    `@beep/ui`
  - catalog: `@effect/atom-react`, `@mui/x-tree-view`
  - peers: `react`, `react-dom` (`^19`)
- `packages/ontology/client/package.json`
  - workspace: `@beep/schema`, `@beep/utils`
- `apps/professional-desktop/package.json`
  - workspace: `@beep/ontology-client`, `@beep/ontology-domain`,
    `@beep/ontology-server`, `@beep/ontology-ui`,
    `@beep/ontology-use-cases`

No new root catalog versions were added.

## Verification

P2 polish local proof passed:

```sh
bun run --cwd packages/drivers/n3 check
bun run --cwd packages/drivers/n3 lint
bun run --cwd packages/drivers/n3 docgen
bun run --cwd packages/ontology/domain check
bun run --cwd packages/ontology/domain lint
bun run --cwd packages/ontology/domain docgen
bun run --cwd packages/ontology/use-cases check
bun run --cwd packages/ontology/use-cases lint
bun run --cwd packages/ontology/use-cases docgen
bun run --cwd packages/ontology/server check
bun run --cwd packages/ontology/server lint
bun run --cwd packages/ontology/server docgen
bun run --cwd packages/ontology/client check
bun run --cwd packages/ontology/client lint
bun run --cwd packages/ontology/client docgen
bun run --cwd packages/ontology/ui check
bun run --cwd packages/ontology/ui lint
bun run --cwd packages/ontology/ui docgen
bun run --cwd apps/professional-desktop check
bun run --cwd apps/professional-desktop lint
node ../../../node_modules/vitest/vitest.mjs run # from packages/drivers/n3
node ../../../node_modules/vitest/vitest.mjs run # from packages/ontology/domain
node ../../../node_modules/vitest/vitest.mjs run # from packages/ontology/use-cases
node ../../../node_modules/vitest/vitest.mjs run # from packages/ontology/server
bun run beep quality jsdoc-inventory
bun run beep quality jsdoc-ratchet
jq . goals/ontology-workbench/ops/manifest.json
git diff --check
git diff --check -- goals/ontology-workbench
```

Node-backed Vitest results:

- `packages/drivers/n3`: 1 file, 2 tests passed.
- `packages/ontology/domain`: 1 file, 4 tests passed.
- `packages/ontology/use-cases`: 3 files, 7 tests passed.
- `packages/ontology/server`: 1 file, 1 test passed.

JSDoc inventory result:

```text
packages=107 openPackages=0 openExports=0 openModules=0 rootPolicyOpen=0
[jsdoc-ratchet] ok: tracked=6 increased=0 current_totals=17
```

Passed:

```sh
bun run --cwd packages/ontology/domain check
bun run --cwd packages/ontology/use-cases check
bun run --cwd packages/ontology/server check
bun run --cwd packages/ontology/client check
bun run --cwd packages/ontology/domain lint
bun run --cwd packages/ontology/use-cases lint
bun run --cwd packages/ontology/client lint
bun run --cwd packages/ontology/ui lint
bun run --cwd apps/professional-desktop lint
bun run fallow:boundaries:write
node ../../../node_modules/vitest/vitest.mjs run # from packages/ontology/domain
node ../../../node_modules/vitest/vitest.mjs run # from packages/ontology/use-cases
node ../../../node_modules/vitest/vitest.mjs run # from packages/ontology/server
```

Blocked in sandbox:

- `bun run --cwd packages/ontology/ui check`
- `bun run --cwd apps/professional-desktop check`

Both reached only the existing `@phosphor-icons/react` export mismatch through
`@beep/editor`/`@beep/ui` (`FileIcon`, `XIcon`, `CaretDownIcon`, etc.).

- `bun run --cwd packages/ontology/domain test`
- `bun run --cwd packages/ontology/use-cases test`

Both Bun-backed Vitest lanes failed before importing tests with
`[vitest-pool]: Failed to start forks worker` and
`Timeout waiting for worker to respond`, matching the P1 sandbox runner
failure mode. `--pool=threads` also failed before imports
(`this._thread.stdout.pipe`). Node-launched Vitest passed for domain,
use-cases, and server. `bun run --cwd packages/ontology/client test` passed
with no test files.

## Host Commands Required

Run on the host orchestrator:

```sh
bun install
bun run --cwd packages/ontology/domain test
bun run --cwd packages/ontology/use-cases test
bun run --cwd packages/ontology/server test
bun run --cwd packages/ontology/client check
bun run --cwd packages/ontology/ui check
bun run --cwd apps/professional-desktop check
bun run --cwd apps/professional-desktop test
bun run --cwd apps/professional-desktop dev:sidecar
bun run --cwd apps/professional-desktop dev
```

Then verify in the running desktop/web shell:

- navigation switches Chat -> Workbench -> Chat
- Open loads a Turtle file through the sidecar
- Add Triple produces a dirty session
- Preview updates Turtle source
- Save writes asserted default-graph Turtle
- Undo/redo changes the session and metrics
- ABox/TBox mode matches search results

## P3 Risks

- P3 cosmos worker should consume `OntologySnapshot` and the extended
  `WorkerCommand.computeSnapshot`/`WorkerResult.computeSnapshotSucceeded`
  protocol rather than duplicate classification rules in the visualizer.
- Real P3 incremental typed-array buffers need to consume
  `SessionChangeDelta.added/removed`; do not diff the full graph on every
  light-edit gesture.
- The metrics panel currently uses the shared projection synchronously through
  atoms. P3 should move heavy metrics/fold computation behind the worker
  protocol before adding large graph benchmarks.
- Turtle serialization still intentionally writes only the asserted default
  graph while preserving the opened document prefix map. Visualizer-derived
  named graphs remain session/domain views and must not become Turtle
  persistence state.
- The app TypeScript lane is currently masked by the Phosphor export drift in
  shared editor/UI packages; host verification should resolve or confirm that
  dependency state before treating app-shell proof as complete.
